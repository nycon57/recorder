/**
 * TRIB-48: Recording uploader
 *
 * Uploads a recorded Blob to R2 via the existing two-step upload process:
 *   1. POST /api/recordings/upload/init  → presigned uploadUrl + recordingId
 *   2. PUT  <uploadUrl>                  → upload the blob (chunked if >10 MB)
 *   3. POST /api/recordings/<id>/finalize → mark uploaded, enqueue processing
 */

import { apiFetch } from './api-client.js';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

export type UploadProgressCallback = (uploaded: number, total: number) => void;

interface UploadInitResponse {
  recordingId: string;
  uploadUrl: string;
  uploadPath: string;
  token: string;
}

interface FinalizeResponse {
  recording: Record<string, unknown>;
  message: string;
}

export interface UploadResult {
  recordingId: string;
}

export async function uploadRecording(
  blob: Blob,
  metadata: { filename: string; mimeType: string; source: 'extension' },
  onProgress?: UploadProgressCallback,
): Promise<UploadResult> {
  // Step 1: Init — get presigned URL + recordingId
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

  const { recordingId, uploadUrl } = init.data;

  // Step 2: Upload the blob to the presigned URL
  if (blob.size > CHUNK_SIZE) {
    await uploadChunked(blob, uploadUrl, onProgress);
  } else {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': metadata.mimeType },
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    onProgress?.(blob.size, blob.size);
  }

  // Step 3: Finalize — trigger processing
  await apiFetch<{ data: FinalizeResponse }>(
    `/api/recordings/${recordingId}/finalize`,
    {
      method: 'POST',
      body: JSON.stringify({ startProcessing: true }),
    },
  );

  return { recordingId };
}

async function uploadChunked(
  blob: Blob,
  uploadUrl: string,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  const total = blob.size;
  let uploaded = 0;

  let start = 0;
  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total);
    const chunk = blob.slice(start, end);

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: chunk,
      headers: {
        'Content-Range': `bytes ${start}-${end - 1}/${total}`,
        'Content-Type': blob.type,
      },
    });

    if (!response.ok && response.status !== 308) {
      throw new Error(
        `Chunk upload failed at bytes ${start}-${end}: ${response.status} ${response.statusText}`,
      );
    }

    uploaded = end;
    onProgress?.(uploaded, total);
    start = end;
  }
}
