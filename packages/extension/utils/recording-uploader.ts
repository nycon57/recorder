/**
 * TRIB-48: Recording uploader
 *
 * Uploads a recorded Blob to Supabase Storage via the canonical two-step flow:
 *   1. POST /api/recordings/upload/init  → presigned uploadUrl + recordingId + uploadPath
 *   2. PUT  <uploadUrl>                  → single atomic PUT (no chunking — Supabase signed
 *                                          URLs do not support Content-Range byte-range uploads)
 *   3. POST /api/recordings/<id>/metadata → set title + storagePath, triggers processing
 */

import { apiFetch } from './api-client.js';

export type UploadProgressCallback = (uploaded: number, total: number) => void;

interface UploadInitResponse {
  recordingId: string;
  uploadUrl: string;
  uploadPath: string;
  thumbnailUploadUrl: string | null;
  thumbnailPath: string | null;
  token: string;
}

export interface UploadResult {
  recordingId: string;
}

export async function uploadRecording(
  blob: Blob,
  metadata: { filename: string; mimeType: string; source: 'extension' },
  onProgress?: UploadProgressCallback,
): Promise<UploadResult> {
  // Step 1: Init — create recording entry, get presigned upload URL
  const init = await apiFetch<{ data: UploadInitResponse }>(
    '/api/recordings/upload/init',
    {
      method: 'POST',
      body: JSON.stringify({
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        fileSize: blob.size,
        analysisType: 'general',
        skipAnalysis: false,
      }),
    },
  );

  const { recordingId, uploadUrl, uploadPath } = init.data;

  // Step 2: Single atomic PUT to the presigned URL.
  // Supabase signed uploads require an atomic PUT — Content-Range chunking is NOT supported.
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': metadata.mimeType,
      'x-upsert': 'true',
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  onProgress?.(blob.size, blob.size);

  // Step 3: Post metadata — sets title + storagePath, transitions status to uploaded,
  // and enqueues the first processing job. This is the canonical Step 2 of the
  // upload/init → metadata flow (NOT the legacy /finalize route).
  await apiFetch(
    `/api/recordings/${recordingId}/metadata`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: metadata.filename.replace(/\.[^.]+$/, ''),
        storagePath: uploadPath,
      }),
    },
  );

  return { recordingId };
}
