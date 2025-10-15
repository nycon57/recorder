/**
 * File Upload Route
 *
 * POST /api/connectors/upload - Upload single file for processing
 */

import crypto from 'crypto';

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/connectors/upload
 * Upload a single file for processing
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') as string | null;

    if (!file) {
      return errors.badRequest('No file provided');
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return errors.badRequest('File size exceeds maximum allowed (100MB)');
    }

    // Generate file hash for deduplication
    const buffer = await file.arrayBuffer();
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.from(buffer))
      .digest('hex');

    // Check if file already exists
    const { data: existingDoc } = await supabaseAdmin
      .from('imported_documents')
      .select('id')
      .eq('org_id', orgId)
      .eq('content_hash', hash)
      .single();

    if (existingDoc) {
      return errors.badRequest('File already exists', {
        documentId: existingDoc.id,
      });
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

    // Upload file to Supabase Storage
    const storagePath = `${orgId}/uploads/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('imported-files')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Upload] Storage error:', uploadError);
      return errors.internalError();
    }

    // Parse metadata
    const parsedMetadata = metadata ? JSON.parse(metadata) : {};

    // Create imported document record
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
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        },
        first_synced_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        sync_count: 1,
        is_deleted: false,
        metadata: parsedMetadata,
      })
      .select()
      .single();

    if (docError || !document) {
      console.error('[Upload] Document creation error:', docError);
      return errors.internalError();
    }

    // Queue processing job
    await supabaseAdmin.from('jobs').insert({
      type: 'process_imported_document',
      payload: {
        documentId: document.id,
        storagePath,
      },
      org_id: orgId,
      status: 'pending',
      run_after: new Date().toISOString(),
    });

    return successResponse(
      {
        document,
        message: 'File uploaded successfully',
      },
      undefined,
      201
    );
  } catch (error) {
    console.error('[Upload] Error:', error);
    return errors.internalError();
  }
});
