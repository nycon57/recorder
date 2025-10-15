import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  validateFileForUpload,
  getFileTypeFromMimeType,
  FILE_EXTENSION_TO_CONTENT_TYPE,
  getProcessingJobs,
} from '@/lib/types/content';
import { generateStoragePath } from '@/lib/validations/library';
import type { ContentType, FileType, JobType } from '@/lib/types/database';

/**
 * POST /api/library/upload
 *
 * Upload one or more files to the library (videos, audio, documents).
 * Creates database records, uploads to Supabase Storage, and enqueues processing jobs.
 *
 * @route POST /api/library/upload
 * @access Protected - Requires organization context
 *
 * @body FormData with:
 *   - files: File[] (1-10 files)
 *   - metadata: string (optional JSON stringified metadata per file)
 *
 * @returns {
 *   uploads: Array<{
 *     id: string;
 *     status: 'success' | 'error';
 *     title: string;
 *     contentType: ContentType;
 *     fileType: FileType;
 *     fileSize: number;
 *     uploadUrl?: string;
 *     error?: string;
 *   }>;
 *   summary: {
 *     total: number;
 *     successful: number;
 *     failed: number;
 *   };
 * }
 *
 * @security
 *   - Validates file types and sizes
 *   - Prevents path traversal in filenames
 *   - Org-level data isolation via requireOrg()
 *   - Rate limiting: Consider wrapping with withRateLimit (10 uploads/min)
 *
 * @errors
 *   - 400: Invalid file type or size
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 413: Payload too large (handled by Next.js)
 *   - 500: Internal server error
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const requestId = generateRequestId();
  const { orgId, userId } = await requireOrg();

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return errors.badRequest('No files provided', undefined, requestId);
    }

    if (files.length > 10) {
      return errors.badRequest(
        'Too many files. Maximum 10 files per request.',
        { maxFiles: 10 },
        requestId
      );
    }

    // Process each file
    const uploadResults = await Promise.all(
      files.map(async (file, index) => {
        try {
          // Validate file
          const validation = validateFileForUpload(file);
          if (!validation.valid) {
            return {
              index,
              status: 'error' as const,
              title: file.name,
              error: validation.error,
            };
          }

          const contentType = validation.contentType!;
          const fileType = validation.fileType!;

          // Prevent recordings from being uploaded via this endpoint
          if (contentType === 'recording') {
            return {
              index,
              status: 'error' as const,
              title: file.name,
              error: 'Screen recordings must be created via /api/recordings endpoint',
            };
          }

          // Sanitize filename to prevent path traversal
          const sanitizedFilename = file.name
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 255);

          // Create recording entry in database
          const { data: recording, error: dbError } = await supabaseAdmin
            .from('recordings')
            .insert({
              org_id: orgId,
              created_by: userId,
              title: sanitizedFilename,
              status: 'uploading',
              content_type: contentType,
              file_type: fileType,
              original_filename: sanitizedFilename,
              mime_type: file.type,
              file_size: file.size,
              metadata: {
                source: 'library_upload',
                uploaded_at: new Date().toISOString(),
              },
            })
            .select()
            .single();

          if (dbError || !recording) {
            console.error('[Library Upload] Database error:', dbError);
            return {
              index,
              status: 'error' as const,
              title: file.name,
              error: 'Failed to create database record',
            };
          }

          // Generate storage path
          const storagePath = generateStoragePath(
            orgId,
            contentType,
            recording.id,
            fileType
          );

          // Upload file to Supabase Storage
          const fileBuffer = await file.arrayBuffer();
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('recordings')
            .upload(storagePath, fileBuffer, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            console.error('[Library Upload] Storage error:', uploadError);

            // Clean up database record
            await supabaseAdmin
              .from('recordings')
              .delete()
              .eq('id', recording.id);

            return {
              index,
              status: 'error' as const,
              title: file.name,
              error: `Storage upload failed: ${uploadError.message}`,
            };
          }

          // Update recording with storage path
          await supabaseAdmin
            .from('recordings')
            .update({
              storage_path_raw: storagePath,
              status: 'uploaded',
            })
            .eq('id', recording.id);

          // Enqueue processing jobs based on content type
          const jobTypes = getProcessingJobs(contentType);
          const firstJobType = jobTypes[0];

          if (firstJobType) {
            await supabaseAdmin.from('jobs').insert({
              type: firstJobType as JobType,
              status: 'pending',
              payload: {
                recordingId: recording.id,
                orgId,
                contentType,
                fileType,
              },
              run_at: new Date().toISOString(),
            });

            // Update recording status based on first job
            let newStatus: typeof recording.status = 'uploaded';
            if (firstJobType === 'transcribe') {
              newStatus = 'transcribing';
            } else if (firstJobType === 'extract_audio') {
              newStatus = 'transcribing';
            } else if (firstJobType.startsWith('extract_text')) {
              newStatus = 'transcribing';
            } else if (firstJobType === 'process_text_note') {
              newStatus = 'transcribing';
            }

            await supabaseAdmin
              .from('recordings')
              .update({ status: newStatus })
              .eq('id', recording.id);
          }

          // Generate signed URL for immediate access
          const { data: signedUrlData } = await supabaseAdmin.storage
            .from('recordings')
            .createSignedUrl(storagePath, 3600); // 1 hour expiry

          return {
            index,
            status: 'success' as const,
            id: recording.id,
            title: sanitizedFilename,
            contentType,
            fileType,
            fileSize: file.size,
            uploadUrl: signedUrlData?.signedUrl,
          };
        } catch (error: any) {
          console.error('[Library Upload] File processing error:', error);
          return {
            index,
            status: 'error' as const,
            title: file.name,
            error: error.message || 'Unknown error occurred',
          };
        }
      })
    );

    // Calculate summary
    const successful = uploadResults.filter((r) => r.status === 'success').length;
    const failed = uploadResults.filter((r) => r.status === 'error').length;

    return successResponse(
      {
        uploads: uploadResults,
        summary: {
          total: uploadResults.length,
          successful,
          failed,
        },
      },
      requestId,
      successful > 0 ? 201 : 400
    );
  } catch (error: any) {
    console.error('[Library Upload] Request error:', error);
    return errors.internalError(requestId);
  }
});

/**
 * GET /api/library/upload
 *
 * Not implemented - use POST for uploads
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use POST to upload files.');
});
