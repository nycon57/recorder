/**
 * Google Drive Import API
 *
 * POST /api/integrations/google-drive/import
 *
 * Imports selected files from Google Drive into Tribora.
 * Downloads file content, creates content records with source tracking,
 * and enqueues processing jobs for document generation and recall indexing.
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

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { ConnectorType } from '@/lib/connectors/base';
import { GoogleDriveConnector } from '@/lib/connectors/google-drive';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import {
  SOURCE_STATUS,
  getQueuedSourceStatusForJob,
  type SourceLifecycleJobType,
} from '@/lib/utils/status-helpers';
import { requireOrg } from '@/lib/utils/api';
import { generateStoragePath } from '@/lib/validations/library';

interface ImportRequest {
  fileIds: string[];
}

interface GoogleDriveCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string | Date;
  scopes?: string[];
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
  'text/plain',
  'text/markdown',
  'text/html',
  // Spreadsheets
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
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/html': 'html',
    'text/csv': 'csv',
  };
  return mimeToFileType[mimeType] || 'unknown';
}

function isTextLikeMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.spreadsheet' ||
    mimeType === 'application/vnd.google-apps.presentation'
  );
}

function isBinaryDocumentMimeType(mimeType: string): boolean {
  return (
    mimeType === 'application/pdf' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function toBuffer(content: string | Buffer): Buffer {
  return Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
}

function toText(content: string | Buffer): string {
  return Buffer.isBuffer(content) ? content.toString('utf-8') : content;
}

function getExtractionJob(
  mimeType: string,
  recordingId: string,
  orgId: string,
  storagePath: string,
): {
  type: Extract<SourceLifecycleJobType, 'extract_text_pdf' | 'extract_text_docx'>;
  payload: {
    recordingId: string;
    orgId: string;
    pdfPath?: string;
    docxPath?: string;
  };
} | null {
  if (mimeType === 'application/pdf') {
    return {
      type: 'extract_text_pdf',
      payload: {
        recordingId,
        orgId,
        pdfPath: storagePath,
      },
    };
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return {
      type: 'extract_text_docx',
      payload: {
        recordingId,
        orgId,
        docxPath: storagePath,
      },
    };
  }

  return null;
}

async function rollbackCreatedImport(
  supabase: ReturnType<typeof createAdminClient>,
  contentId: string,
  storagePath?: string,
): Promise<void> {
  if (storagePath) {
    const { error: storageDeleteError } = await supabase.storage
      .from('content')
      .remove([storagePath]);

    if (storageDeleteError) {
      console.error(
        `[Google Drive Import] Failed to delete storage object during rollback:`,
        storageDeleteError,
      );
    }
  }

  const { error: syncDeleteError } = await supabase
    .from('connector_sync_state')
    .delete()
    .eq('content_id', contentId);

  if (syncDeleteError) {
    console.error(
      `[Google Drive Import] Failed to delete sync state during rollback:`,
      syncDeleteError,
    );
  }

  const { error: contentDeleteError } = await supabase
    .from('content')
    .delete()
    .eq('id', contentId);

  if (contentDeleteError) {
    console.error(
      `[Google Drive Import] Failed to delete content during rollback:`,
      contentDeleteError,
    );
  }
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
        { status: 400 },
      );
    }

    if (fileIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 files can be imported at once' },
        { status: 400 },
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
        { status: 404 },
      );
    }

    // Create connector instance
    const credentials =
      connectorConfig.credentials as GoogleDriveCredentials;
    const connector = new GoogleDriveConnector(
      {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt
          ? new Date(credentials.expiresAt)
          : undefined,
        scopes: credentials.scopes,
      },
      {
        connectorId: connectorConfig.id,
      },
    );

    // Test connection
    const testResult = await connector.testConnection();
    if (!testResult.success) {
      return NextResponse.json(
        { error: 'Failed to connect to Google Drive. Please reconnect.' },
        { status: 401 },
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

    const existingFileIds = new Set(
      (existingImports || []).map((d) => d.source_external_id),
    );
    const newFileIds = fileIds.filter((id) => !existingFileIds.has(id));

    if (newFileIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All selected files are already imported',
        imported: 0,
        skipped: fileIds.length,
      });
    }

    console.log(
      `[Google Drive Import] Importing ${newFileIds.length} files for org ${orgId}`,
    );

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
        if (
          !SUPPORTED_MIME_TYPES.has(fileContent.mimeType) &&
          !fileContent.mimeType.startsWith('text/')
        ) {
          results.failed.push({
            fileId,
            error: `Unsupported file type: ${fileContent.mimeType}`,
          });
          continue;
        }

        const textLike = isTextLikeMimeType(fileContent.mimeType);
        const binaryDocument = isBinaryDocumentMimeType(fileContent.mimeType);

        if (!textLike && !binaryDocument) {
          results.failed.push({
            fileId,
            error: `Import processing is not available for file type: ${fileContent.mimeType}`,
          });
          continue;
        }

        // Generate content hash for deduplication
        const hash = crypto.createHash('sha256');
        if (textLike) {
          hash.update(toText(fileContent.content), 'utf-8');
        } else {
          hash.update(new Uint8Array(toBuffer(fileContent.content)));
        }
        const contentHash = hash.digest('hex');

        // Determine content_type and file_type
        const contentType = getContentType(fileContent.mimeType);
        const fileType = getFileType(fileContent.mimeType);

        // Create content record (unified content table - Option A architecture)
        const { data: contentRecord, error: insertError } = await supabase
          .from('content')
          .insert({
            org_id: orgId,
            created_by: userId,
            title: fileContent.title,
            content_type: contentType,
            file_type: fileType,
            status: SOURCE_STATUS.UPLOADED,
            // Source tracking columns (new unified architecture)
            source_type: 'google_drive',
            source_connector_id: connectorConfig.id,
            source_external_id: fileId,
            source_url: fileContent.metadata?.webViewLink || null,
            // Metadata
            metadata: {
              originalMimeType:
                fileContent.metadata?.originalMimeType || fileContent.mimeType,
              importedMimeType: fileContent.mimeType,
              exportedMimeType:
                fileContent.metadata?.originalMimeType &&
                fileContent.metadata.originalMimeType !== fileContent.mimeType
                  ? fileContent.mimeType
                  : null,
              modifiedTime: fileContent.metadata?.modifiedTime,
              createdTime: fileContent.metadata?.createdTime,
              owners: fileContent.metadata?.owners,
              size: fileContent.size,
              source: 'google_drive',
              sourceFileId: fileId,
              sourceConnectorId: connectorConfig.id,
            },
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(
            `[Google Drive Import] Failed to insert content:`,
            insertError,
          );
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
              originalMimeType:
                fileContent.metadata?.originalMimeType || fileContent.mimeType,
              importedMimeType: fileContent.mimeType,
              exportedAs:
                fileContent.metadata?.originalMimeType &&
                fileContent.metadata.originalMimeType !== fileContent.mimeType
                  ? fileContent.mimeType
                  : null,
              webViewLink: fileContent.metadata?.webViewLink,
            },
          });

        if (syncStateError) {
          console.error(
            `[Google Drive Import] Failed to create sync state:`,
            syncStateError,
          );
          // Continue anyway - content is created, sync state is supplementary
        }

        let jobError: { message: string } | null = null;
        let uploadedStoragePath: string | undefined;

        if (textLike) {
          const textContent = toText(fileContent.content);
          const { data: transcript, error: transcriptError } = await supabase
            .from('transcripts')
            .insert({
              content_id: contentRecord.id,
              text: textContent,
              language: 'en', // Could be detected in the future
              provider: 'google_drive_import',
              words_json: {
                importSource: 'google_drive',
                sourceFileId: fileId,
                sourceConnectorId: connectorConfig.id,
                originalMimeType:
                  fileContent.metadata?.originalMimeType ||
                  fileContent.mimeType,
                importedMimeType: fileContent.mimeType,
              },
            })
            .select('id')
            .single();

          if (transcriptError || !transcript) {
            console.error(
              `[Google Drive Import] Failed to create transcript:`,
              transcriptError,
            );
            await rollbackCreatedImport(supabase, contentRecord.id);
            results.failed.push({
              fileId,
              error: 'Failed to store content text',
            });
            continue;
          }

          const { error } = await supabase.from('jobs').insert({
            type: 'doc_generate',
            status: 'pending',
            content_id: contentRecord.id,
            payload: {
              recordingId: contentRecord.id,
              transcriptId: transcript.id,
              orgId,
            },
            dedupe_key: `doc_generate:${contentRecord.id}`,
          });
          jobError = error;

          await supabase
            .from('content')
            .update({
              status:
                getQueuedSourceStatusForJob('doc_generate') ??
                SOURCE_STATUS.DOCUMENT_GENERATING,
            })
            .eq('id', contentRecord.id);
        } else {
          const storagePath = generateStoragePath(
            orgId,
            'document',
            contentRecord.id,
            fileType,
          );
          const rawContent = toBuffer(fileContent.content);
          const { error: uploadError } = await supabase.storage
            .from('content')
            .upload(storagePath, rawContent, {
              contentType: fileContent.mimeType,
              upsert: false,
            });

          if (uploadError) {
            console.error(
              `[Google Drive Import] Failed to upload binary document:`,
              uploadError,
            );
            await rollbackCreatedImport(supabase, contentRecord.id);
            results.failed.push({
              fileId,
              error: 'Failed to store binary document',
            });
            continue;
          }

          await supabase
            .from('content')
            .update({
              storage_path_raw: storagePath,
              status: SOURCE_STATUS.UPLOADED,
            })
            .eq('id', contentRecord.id);

          const extractionJob = getExtractionJob(
            fileContent.mimeType,
            contentRecord.id,
            orgId,
            storagePath,
          );

          if (!extractionJob) {
            await rollbackCreatedImport(
              supabase,
              contentRecord.id,
              storagePath,
            );
            results.failed.push({
              fileId,
              error: `No extraction job is available for file type: ${fileContent.mimeType}`,
            });
            continue;
          }
          uploadedStoragePath = storagePath;

          const { error } = await supabase.from('jobs').insert({
            type: extractionJob.type,
            status: 'pending',
            content_id: contentRecord.id,
            payload: extractionJob.payload,
            dedupe_key: `${extractionJob.type}:${contentRecord.id}`,
          });
          jobError = error;

          await supabase
            .from('content')
            .update({
              status:
                getQueuedSourceStatusForJob(extractionJob.type) ??
                SOURCE_STATUS.UPLOADED,
            })
            .eq('id', contentRecord.id);
        }

        if (jobError) {
          console.error(
            `[Google Drive Import] Failed to create processing job:`,
            jobError,
          );
          // Content is created, job failed - update status
          await rollbackCreatedImport(
            supabase,
            contentRecord.id,
            uploadedStoragePath,
          );
          results.failed.push({
            fileId,
            error: jobError.message,
          });
          continue;
        }

        results.imported.push(fileId);
        console.log(
          `[Google Drive Import] Successfully imported ${fileContent.title}`,
        );
      } catch (fileError) {
        console.error(
          `[Google Drive Import] Error importing file ${fileId}:`,
          fileError,
        );
        results.failed.push({
          fileId,
          error:
            fileError instanceof Error ? fileError.message : 'Unknown error',
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
      {
        error:
          error instanceof Error ? error.message : 'Failed to import files',
      },
      { status: 500 },
    );
  }
}
