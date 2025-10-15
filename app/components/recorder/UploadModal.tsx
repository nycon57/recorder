'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UploadModalProps {
  blob: Blob;
  onClose: () => void;
}

export default function UploadModal({ blob, onClose }: UploadModalProps) {
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'creating' | 'uploading' | 'finalizing' | 'complete' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleUpload = async () => {
    try {
      setUploadStatus('creating');
      setError(null);

      // Step 1: Create recording entry and get upload URL
      const createResponse = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || undefined,
          description: description || undefined,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create recording');
      }

      const { data } = await createResponse.json();
      const { recording, uploadUrl, token } = data;
      setRecordingId(recording.id);

      // Step 2: Upload the blob to Supabase Storage
      setUploadStatus('uploading');

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob.type || 'video/webm',
          'x-upsert': 'true', // Supabase storage flag
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload video');
      }

      setUploadProgress(100);

      // Step 3: Finalize the recording
      setUploadStatus('finalizing');

      // Calculate SHA-256 hash of the blob (simplified for now)
      const sha256 = 'placeholder-hash'; // TODO: Implement actual hash calculation

      const finalizeResponse = await fetch(
        `/api/recordings/${recording.id}/finalize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storagePath: data.uploadPath,
            sizeBytes: blob.size,
            sha256,
            durationSec: undefined, // TODO: Extract from video metadata
          }),
        }
      );

      if (!finalizeResponse.ok) {
        throw new Error('Failed to finalize recording');
      }

      setUploadStatus('complete');

      // Redirect to recording page after a short delay
      setTimeout(() => {
        router.push(`/library/${recording.id}`);
      }, 1500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'An error occurred during upload');
      setUploadStatus('error');
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusMessage = () => {
    switch (uploadStatus) {
      case 'creating':
        return 'Creating recording...';
      case 'uploading':
        return `Uploading... ${uploadProgress}%`;
      case 'finalizing':
        return 'Processing...';
      case 'complete':
        return 'Upload complete! Redirecting...';
      case 'error':
        return error || 'Upload failed';
      default:
        return 'Ready to upload';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Recording Complete
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Size: {(blob.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              disabled={
                uploadStatus === 'uploading' || uploadStatus === 'finalizing'
              }
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <video
              src={URL.createObjectURL(blob)}
              controls
              className="w-full rounded-lg bg-black"
            />
          </div>

          {/* Form */}
          {uploadStatus === 'idle' && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a title for this recording"
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description"
                  rows={3}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Progress */}
          {uploadStatus !== 'idle' && uploadStatus !== 'complete' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {getStatusMessage()}
                </span>
                {uploadStatus === 'uploading' && (
                  <span className="text-sm text-muted-foreground">
                    {uploadProgress}%
                  </span>
                )}
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${uploadStatus === 'uploading' ? uploadProgress : uploadStatus === 'finalizing' ? 90 : 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Success Message */}
          {uploadStatus === 'complete' && (
            <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-success mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm font-medium text-success">
                  {getStatusMessage()}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadStatus === 'error' && error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-destructive mr-2 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            {uploadStatus === 'idle' && (
              <>
                <button
                  onClick={handleUpload}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
                >
                  Upload & Process
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition font-medium"
                >
                  Download
                </button>
              </>
            )}

            {uploadStatus === 'error' && (
              <>
                <button
                  onClick={handleUpload}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
                >
                  Retry Upload
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition font-medium"
                >
                  Download
                </button>
              </>
            )}

            {uploadStatus === 'complete' && recordingId && (
              <button
                onClick={() => router.push(`/library/${recordingId}`)}
                className="flex-1 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 transition font-medium"
              >
                View Recording
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
