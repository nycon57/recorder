/**
 * TRIB-48 / TRIB-49: Recording uploader with progress tracking + network retry
 *
 * Uploads a recorded Blob to Supabase Storage via the canonical two-step flow:
 *   1. POST /api/recordings/upload/init  -> presigned uploadUrl + recordingId + uploadPath
 *   2. PUT  <uploadUrl>                  -> single atomic PUT (Supabase signed URLs
 *                                           do not support Content-Range chunking)
 *   3. POST /api/recordings/<id>/metadata -> set title + storagePath, triggers processing
 *
 * TRIB-49 additions:
 *   - Real-time upload progress via XMLHttpRequest upload events
 *   - Exponential-backoff retry (3 attempts: 1s, 2s, 4s) for network failures
 *   - Progress + retry state callbacks for the popup UI
 */

import { apiFetch } from './api-client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadProgress {
  /** Bytes uploaded so far */
  uploaded: number;
  /** Total bytes */
  total: number;
  /** Percentage 0-100 */
  percent: number;
}

export interface RetryInfo {
  /** Current attempt (1-indexed) */
  attempt: number;
  /** Maximum attempts */
  maxAttempts: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;
export type RetryCallback = (info: RetryInfo) => void;

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

export interface UploadOptions {
  onProgress?: UploadProgressCallback;
  onRetry?: RetryCallback;
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff.
 * Calls `onRetry` before each retry attempt (not the first attempt).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  onRetry?: RetryCallback,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        onRetry?.({ attempt: attempt + 1, maxAttempts: MAX_ATTEMPTS });
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// XHR upload with progress
// ---------------------------------------------------------------------------

/**
 * Upload a blob via PUT using XMLHttpRequest so we get real progress events.
 * `fetch()` does not expose upload progress.
 */
function xhrPut(
  url: string,
  blob: Blob,
  mimeType: string,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.setRequestHeader('x-upsert', 'true');

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress({
            uploaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          });
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload network error'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.send(blob);
  });
}

// ---------------------------------------------------------------------------
// Main upload function
// ---------------------------------------------------------------------------

export async function uploadRecording(
  blob: Blob,
  metadata: { filename: string; mimeType: string; source: 'extension' },
  options: UploadOptions = {},
): Promise<UploadResult> {
  const { onProgress, onRetry } = options;

  // Step 1: Init -- create recording entry, get presigned upload URL.
  // Retry this too in case of transient network issues.
  const init = await withRetry(
    () =>
      apiFetch<{ data: UploadInitResponse }>('/api/recordings/upload/init', {
        method: 'POST',
        body: JSON.stringify({
          filename: metadata.filename,
          mimeType: metadata.mimeType,
          fileSize: blob.size,
          analysisType: 'general',
          skipAnalysis: false,
        }),
      }),
    onRetry,
  );

  const { recordingId, uploadUrl, uploadPath } = init.data;

  // Step 2: Upload the blob via XHR PUT with progress tracking.
  // Supabase signed uploads require a single atomic PUT -- no chunking.
  // We use XMLHttpRequest instead of fetch to get real-time upload progress.
  await withRetry(
    () => xhrPut(uploadUrl, blob, metadata.mimeType, onProgress),
    onRetry,
  );

  // Ensure 100% is reported
  onProgress?.({ uploaded: blob.size, total: blob.size, percent: 100 });

  // Step 3: Post metadata -- sets title + storagePath, transitions status to
  // uploaded, and enqueues the first processing job.
  await withRetry(
    () =>
      apiFetch(`/api/recordings/${recordingId}/metadata`, {
        method: 'POST',
        body: JSON.stringify({
          title: metadata.filename.replace(/\.[^.]+$/, ''),
          storagePath: uploadPath,
        }),
      }),
    onRetry,
  );

  return { recordingId };
}
