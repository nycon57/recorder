/**
 * Batch File Upload Route
 *
 * POST /api/connectors/upload/batch - Upload multiple files in a batch
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';

/**
 * POST /api/connectors/upload/batch
 * Upload multiple files in a batch
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const batchName = formData.get('batchName') as string | null;
    const metadata = formData.get('metadata') as string | null;

    if (!files || files.length === 0) {
      return errors.badRequest('No files provided');
    }

    if (files.length > 100) {
      return errors.badRequest('Maximum 100 files per batch');
    }

    // Validate total size (max 500MB per batch)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxBatchSize = 500 * 1024 * 1024;
    if (totalSize > maxBatchSize) {
      return errors.badRequest('Total batch size exceeds maximum (500MB)');
    }

    // Get or create file_upload connector
    let { data: connector } = await supabaseAdmin
      .from('connector_configs')
      .select('id')
      .eq('org_id', orgId)
      .eq('connector_type', 'file_upload')
      .single();

    if (!connector) {
      const { data: newConnector } = await supabaseAdmin
        .from('connector_configs')
        .insert({
          org_id: orgId,
          connector_type: 'file_upload',
          name: 'File Uploads',
          credentials: {},
          settings: {},
          sync_status: 'idle',
          is_active: true,
          created_by: userId,
        })
        .select()
        .single();

      connector = newConnector;
    }

    if (!connector) {
      return errors.internalError();
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('file_upload_batches')
      .insert({
        org_id: orgId,
        user_id: userId,
        batch_name: batchName || `Batch ${new Date().toISOString()}`,
        total_files: files.length,
        processed_files: 0,
        failed_files: 0,
        status: 'uploading',
        progress_percent: 0,
        metadata: metadata ? JSON.parse(metadata) : {},
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error('[Batch Upload] Batch creation error:', batchError);
      return errors.internalError();
    }

    const uploadedDocuments = [];
    const failedUploads = [];

    // Process files
    for (const file of files) {
      try {
        // Validate individual file size (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
          failedUploads.push({
            fileName: file.name,
            error: 'File exceeds 100MB limit',
          });
          continue;
        }

        // Generate file hash
        const buffer = await file.arrayBuffer();
        const hash = crypto
          .createHash('sha256')
          .update(Buffer.from(buffer))
          .digest('hex');

        // Check for duplicates
        const { data: existingDoc } = await supabaseAdmin
          .from('imported_documents')
          .select('id')
          .eq('org_id', orgId)
          .eq('content_hash', hash)
          .single();

        if (existingDoc) {
          failedUploads.push({
            fileName: file.name,
            error: 'Duplicate file',
            documentId: existingDoc.id,
          });
          continue;
        }

        // Upload to storage
        const storagePath = `${orgId}/batches/${batch.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('imported-files')
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          failedUploads.push({
            fileName: file.name,
            error: uploadError.message,
          });
          continue;
        }

        // Create document record
        const { data: document, error: docError } = await supabaseAdmin
          .from('imported_documents')
          .insert({
            connector_id: connector.id,
            org_id: orgId,
            external_id: storagePath,
            external_url: storagePath,
            title: file.name,
            file_type: file.type,
            file_size: file.size,
            content_hash: hash,
            processing_status: 'pending',
            chunks_generated: false,
            embeddings_generated: false,
            source_metadata: {
              originalName: file.name,
              batchId: batch.id,
              uploadedBy: userId,
              uploadedAt: new Date().toISOString(),
            },
            first_synced_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
            sync_count: 1,
            is_deleted: false,
            metadata: {},
          })
          .select()
          .single();

        if (docError || !document) {
          failedUploads.push({
            fileName: file.name,
            error: 'Failed to create document record',
          });
          continue;
        }

        // Queue processing job
        await supabaseAdmin.from('jobs').insert({
          type: 'process_imported_document',
          payload: {
            documentId: document.id,
            storagePath,
            batchId: batch.id,
          },
          org_id: orgId,
          status: 'pending',
          run_after: new Date().toISOString(),
        });

        uploadedDocuments.push(document);
      } catch (error) {
        console.error(`[Batch Upload] Error processing ${file.name}:`, error);
        failedUploads.push({
          fileName: file.name,
          error: 'Processing error',
        });
      }
    }

    // Update batch status
    const processedCount = uploadedDocuments.length;
    const failedCount = failedUploads.length;
    const progressPercent = Math.round((processedCount / files.length) * 100);

    await supabaseAdmin
      .from('file_upload_batches')
      .update({
        processed_files: processedCount,
        failed_files: failedCount,
        status: failedCount === files.length ? 'failed' : 'processing',
        progress_percent: progressPercent,
      })
      .eq('id', batch.id);

    return successResponse(
      {
        batchId: batch.id,
        totalFiles: files.length,
        uploadedFiles: processedCount,
        failedFiles: failedCount,
        documents: uploadedDocuments,
        failures: failedUploads,
        message: `Uploaded ${processedCount} of ${files.length} files`,
      },
      undefined,
      201
    );
  } catch (error) {
    console.error('[Batch Upload] Error:', error);
    return errors.internalError();
  }
});
