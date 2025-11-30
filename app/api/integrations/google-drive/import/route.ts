/**
 * Google Drive Import API
 *
 * POST /api/integrations/google-drive/import
 *
 * Imports selected files from Google Drive into Tribora.
 * Downloads file content, creates content records with source tracking,
 * and enqueues processing jobs for chunking and embedding.
 *
 * Uses the unified content table (Option A architecture) with:
 * - source_type = 'google_drive'
 * - source_connector_id = connector config ID
 * - source_external_id = Google Drive file ID
 * - source_url = Google Drive web link
 *
 * Also creates connector_sync_state entries for sync tracking.
 *
 * Body:
 * - fileIds: string[] - Array of Google Drive file IDs to import
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { requireOrg } from '@/lib/utils/api';
import { GoogleDriveConnector } from '@/lib/connectors/google-drive';
import { ConnectorType } from '@/lib/connectors/base';
import crypto from 'crypto';

interface ImportRequest {
  fileIds: string[];
}

// Supported file types for import
const SUPPORTED_MIME_TYPES = new Set([
  // Google Workspace
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/html',
  // Spreadsheets
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);

// Map MIME types to content_type values
function getContentType(mimeType: string): string {
  // Text files
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return 'text';
  }
  // All other supported types are documents
  return 'document';
}

// Map MIME types to file_type values
function getFileType(mimeType: string): string {
  const mimeToFileType: Record<string, string> = {
    'application/vnd.google-apps.document': 'google_doc',
    'application/vnd.google-apps.spreadsheet': 'google_sheet',
    'application/vnd.google-apps.presentation': 'google_slides',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/html': 'html',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'text/csv': 'csv',
  };
  return mimeToFileType[mimeType] || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, userId } = await requireOrg();
    const supabase = createAdminClient();

    // Parse request body
    const body: ImportRequest = await req.json();
    const { fileIds } = body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'No files selected for import' },
        { status: 400 }
      );
    }

    if (fileIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 files can be imported at once' },
        { status: 400 }
      );
    }

    // Get Google Drive connector config
    const { data: connectorConfig, error: configError } = await supabase
      .from('connector_configs')
      .select('*')
      .eq('org_id', orgId)
      .eq('connector_type', ConnectorType.GOOGLE_DRIVE)
      .eq('is_active', true)
      .single();

    if (configError || !connectorConfig) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 404 }
      );
    }

    // Create connector instance
    const credentials = connectorConfig.credentials as any;
    const connector = new GoogleDriveConnector(
      {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : undefined,
        scopes: credentials.scopes,
      },
      {
        connectorId: connectorConfig.id,
      }
    );

    // Test connection
    const testResult = await connector.testConnection();
    if (!testResult.success) {
      return NextResponse.json(
        { error: 'Failed to connect to Google Drive. Please reconnect.' },
        { status: 401 }
      );
    }

    // Check which files are already imported (using content table with source tracking)
    const { data: existingImports } = await supabase
      .from('content')
      .select('source_external_id')
      .eq('org_id', orgId)
      .eq('source_connector_id', connectorConfig.id)
      .eq('source_type', 'google_drive')
      .in('source_external_id', fileIds);

    const existingFileIds = new Set((existingImports || []).map(d => d.source_external_id));
    const newFileIds = fileIds.filter(id => !existingFileIds.has(id));

    if (newFileIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All selected files are already imported',
        imported: 0,
        skipped: fileIds.length,
      });
    }

    console.log(`[Google Drive Import] Importing ${newFileIds.length} files for org ${orgId}`);

    // Import each file
    const results = {
      imported: [] as string[],
      failed: [] as { fileId: string; error: string }[],
      skipped: fileIds.length - newFileIds.length,
    };

    for (const fileId of newFileIds) {
      try {
        // Download file content
        console.log(`[Google Drive Import] Downloading file ${fileId}`);
        const fileContent = await connector.downloadFile(fileId);

        // Check if file type is supported
        if (!SUPPORTED_MIME_TYPES.has(fileContent.mimeType) &&
            !fileContent.mimeType.startsWith('text/')) {
          results.failed.push({
            fileId,
            error: `Unsupported file type: ${fileContent.mimeType}`,
          });
          continue;
        }

        // Convert content to string
        let textContent: string;
        if (typeof fileContent.content === 'string') {
          textContent = fileContent.content;
        } else if (Buffer.isBuffer(fileContent.content)) {
          textContent = fileContent.content.toString('utf-8');
        } else {
          textContent = String(fileContent.content);
        }

        // Generate content hash for deduplication
        const contentHash = crypto
          .createHash('sha256')
          .update(textContent)
          .digest('hex');

        // Determine content_type and file_type
        const contentType = getContentType(fileContent.mimeType);
        const fileType = getFileType(fileContent.mimeType);

        // Create content record (unified content table - Option A architecture)
        const { data: contentRecord, error: insertError } = await supabase
          .from('content')
          .insert({
            org_id: orgId,
            user_id: userId,
            title: fileContent.title,
            content_type: contentType,
            file_type: fileType,
            status: 'pending',
            // Source tracking columns (new unified architecture)
            source_type: 'google_drive',
            source_connector_id: connectorConfig.id,
            source_external_id: fileId,
            source_url: fileContent.metadata?.webViewLink || null,
            // Metadata
            metadata: {
              originalMimeType: fileContent.mimeType,
              exportedMimeType: fileContent.metadata?.originalMimeType,
              modifiedTime: fileContent.metadata?.modifiedTime,
              createdTime: fileContent.metadata?.createdTime,
              owners: fileContent.metadata?.owners,
              size: fileContent.size,
            },
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[Google Drive Import] Failed to insert content:`, insertError);
          results.failed.push({
            fileId,
            error: insertError.message,
          });
          continue;
        }

        // Create connector_sync_state entry for sync tracking
        const { error: syncStateError } = await supabase
          .from('connector_sync_state')
          .insert({
            content_id: contentRecord.id,
            connector_id: connectorConfig.id,
            external_id: fileId,
            content_hash: contentHash,
            sync_status: 'synced',
            external_modified_at: fileContent.metadata?.modifiedTime || null,
            last_synced_at: new Date().toISOString(),
            sync_metadata: {
              originalMimeType: fileContent.mimeType,
              exportedAs: fileContent.metadata?.originalMimeType,
              webViewLink: fileContent.metadata?.webViewLink,
            },
          });

        if (syncStateError) {
          console.error(`[Google Drive Import] Failed to create sync state:`, syncStateError);
          // Continue anyway - content is created, sync state is supplementary
        }

        // Store the raw text content for processing
        // For documents, we'll create a transcript-like structure for chunking
        const { error: transcriptError } = await supabase
          .from('transcripts')
          .insert({
            content_id: contentRecord.id,
            text: textContent,
            language: 'en', // Could be detected in the future
            source: 'import',
          });

        if (transcriptError) {
          console.error(`[Google Drive Import] Failed to create transcript:`, transcriptError);
          // Update content status to error
          await supabase
            .from('content')
            .update({ status: 'error' })
            .eq('id', contentRecord.id);
          results.failed.push({
            fileId,
            error: 'Failed to store content text',
          });
          continue;
        }

        // Update content status to transcribed (ready for embedding)
        await supabase
          .from('content')
          .update({ status: 'transcribed' })
          .eq('id', contentRecord.id);

        // Enqueue embedding job (same as other content types)
        const { error: jobError } = await supabase.from('jobs').insert({
          type: 'generate_embeddings',
          status: 'pending',
          payload: {
            contentId: contentRecord.id,
            orgId,
          },
          dedupe_key: `generate_embeddings:${contentRecord.id}`,
        });

        if (jobError) {
          console.error(`[Google Drive Import] Failed to create embedding job:`, jobError);
          // Content is created, job failed - update status
          await supabase
            .from('content')
            .update({ status: 'error' })
            .eq('id', contentRecord.id);
        }

        results.imported.push(fileId);
        console.log(`[Google Drive Import] Successfully imported ${fileContent.title}`);
      } catch (fileError) {
        console.error(`[Google Drive Import] Error importing file ${fileId}:`, fileError);
        results.failed.push({
          fileId,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
        });
      }
    }

    // Update connector last sync time
    await supabase
      .from('connector_configs')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectorConfig.id);

    console.log(`[Google Drive Import] Import complete:`, {
      imported: results.imported.length,
      failed: results.failed.length,
      skipped: results.skipped,
    });

    return NextResponse.json({
      success: true,
      imported: results.imported.length,
      failed: results.failed,
      skipped: results.skipped,
      message: `Successfully imported ${results.imported.length} file(s)`,
    });
  } catch (error) {
    console.error('[Google Drive Import] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import files' },
      { status: 500 }
    );
  }
}
