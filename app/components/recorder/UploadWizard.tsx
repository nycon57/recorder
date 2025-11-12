'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import FileUploadStep from './steps/FileUploadStep';
import MetadataCollectionStep from './steps/MetadataCollectionStep';
import UploadProgressStep from './steps/UploadProgressStep';
import type { ContentType } from '@/lib/types/content';

interface UploadWizardProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Wizard step enum
 */
type WizardStep = 'file_upload' | 'metadata' | 'progress';

/**
 * Step 1 data
 */
interface FileUploadData {
  file: File;
  contentType: ContentType;
  thumbnail?: string;
  durationSec?: number;
}

/**
 * Step 2 data
 */
interface MetadataData {
  title: string;
  description?: string;
  tags: string[];
  thumbnail?: string;
  thumbnailFile?: File;
}

/**
 * Upload state
 */
interface UploadState {
  recordingId?: string;
  uploadUrl?: string;
  thumbnailUploadUrl?: string;
  uploadPath?: string;
  thumbnailPath?: string;
  streamUrl?: string;
}

/**
 * UploadWizard - Multi-step upload flow orchestrator
 *
 * Flow:
 * 1. File Upload - Select file, validate, extract thumbnail/duration
 * 2. Metadata Collection - Enter title, description, tags, optional custom thumbnail
 * 3. Upload & Process - Upload file, save metadata, stream progress, redirect
 *
 * API Calls:
 * - Step 1→2: POST /api/recordings/upload/init (create recording, get presigned URLs)
 * - Step 1→2: PUT to Supabase Storage (upload file using presigned URL)
 * - Step 2→3: POST /api/recordings/[id]/metadata (save metadata, start processing)
 * - Step 3: GET /api/recordings/[id]/upload/stream (SSE progress updates)
 */
export default function UploadWizard({ open, onClose }: UploadWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('file_upload');
  const [fileData, setFileData] = useState<FileUploadData | null>(null);
  const [metadataData, setMetadataData] = useState<MetadataData | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({});
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Reset wizard state
   */
  const resetWizard = useCallback(() => {
    setCurrentStep('file_upload');
    setFileData(null);
    setMetadataData(null);
    setUploadState({});
    setError(null);
    setIsUploading(false);
  }, []);

  /**
   * Handle wizard close
   */
  const handleClose = useCallback(() => {
    // Only allow close if not actively uploading
    if (!isUploading) {
      resetWizard();
      onClose();
    }
  }, [isUploading, resetWizard, onClose]);

  /**
   * Step 1 Complete: Initialize upload and upload file
   */
  const handleFileUploadComplete = useCallback(
    async (data: FileUploadData) => {
      console.log('[UploadWizard] File upload step complete', {
        fileName: data.file.name,
        fileSize: data.file.size,
        contentType: data.contentType,
      });

      setFileData(data);
      setError(null);
      setIsUploading(true);

      try {
        // Step 1: Initialize upload (create recording entry, get presigned URLs)
        console.log('[UploadWizard] Initializing upload...');

        const initResponse = await fetch('/api/recordings/upload/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: data.file.name,
            mimeType: data.file.type,
            fileSize: data.file.size,
            durationSec: data.durationSec,
          }),
        });

        if (!initResponse.ok) {
          const errorData = await initResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to initialize upload');
        }

        const initData = await initResponse.json();
        const {
          recordingId,
          uploadUrl,
          uploadPath,
          thumbnailUploadUrl,
          thumbnailPath,
        } = initData.data;

        console.log('[UploadWizard] Upload initialized', { recordingId });

        setUploadState({
          recordingId,
          uploadUrl,
          uploadPath,
          thumbnailUploadUrl,
          thumbnailPath,
        });

        // Step 2: Upload file to Supabase Storage
        console.log('[UploadWizard] Uploading file to storage...');

        const fileUploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: data.file,
          headers: {
            'Content-Type': data.file.type,
            'x-upsert': 'true',
          },
        });

        if (!fileUploadResponse.ok) {
          throw new Error('Failed to upload file to storage');
        }

        console.log('[UploadWizard] File uploaded successfully');

        // Step 3: Upload thumbnail if available
        if (data.thumbnail && thumbnailUploadUrl) {
          console.log('[UploadWizard] Uploading auto-generated thumbnail...');

          try {
            // Detect thumbnail format and handle appropriately
            let thumbnailBlob: Blob;

            if (data.thumbnail.startsWith('data:')) {
              // Data URL - fetch to convert to blob
              thumbnailBlob = await (await fetch(data.thumbnail)).blob();
            } else if (data.thumbnail.startsWith('blob:')) {
              // Blob URL - fetch to get blob
              thumbnailBlob = await (await fetch(data.thumbnail)).blob();
            } else if (data.thumbnail.startsWith('http://') || data.thumbnail.startsWith('https://')) {
              // Remote URL - fetch to get blob
              thumbnailBlob = await (await fetch(data.thumbnail)).blob();
            } else {
              // Unknown format - skip upload
              console.warn('[UploadWizard] Unknown thumbnail format, skipping upload');
              thumbnailBlob = new Blob(); // Empty blob to skip upload
            }

            if (thumbnailBlob.size > 0) {
              const thumbnailResponse = await fetch(thumbnailUploadUrl, {
                method: 'PUT',
                body: thumbnailBlob,
                headers: {
                  'Content-Type': 'image/jpeg',
                  'x-upsert': 'true',
                },
              });

              if (thumbnailResponse.ok) {
                console.log('[UploadWizard] Thumbnail uploaded successfully');
              }
            }
          } catch (err) {
            console.warn('[UploadWizard] Thumbnail upload failed (non-fatal):', err);
          }
        }

        // Proceed to metadata collection step
        setCurrentStep('metadata');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[UploadWizard] Upload initialization failed:', err);
        setError(message);

        // Cleanup: Delete orphan recording if it was created
        if (uploadState.recordingId) {
          console.log('[UploadWizard] Cleaning up orphan recording:', uploadState.recordingId);
          try {
            await fetch(`/api/recordings/${uploadState.recordingId}`, {
              method: 'DELETE',
            });
            console.log('[UploadWizard] Orphan recording cleaned up successfully');
          } catch (cleanupErr) {
            console.error('[UploadWizard] Failed to cleanup orphan recording:', cleanupErr);
          }
        }
      } finally {
        setIsUploading(false);
      }
    },
    [uploadState.recordingId]
  );

  /**
   * Step 2 Complete: Save metadata and start processing
   */
  const handleMetadataComplete = useCallback(
    async (data: MetadataData) => {
      console.log('[UploadWizard] Metadata step complete', {
        title: data.title,
        tagCount: data.tags.length,
        hasCustomThumbnail: !!data.thumbnailFile,
      });

      setMetadataData(data);
      setError(null);
      setIsUploading(true);

      try {
        const { recordingId, uploadPath, thumbnailUploadUrl } = uploadState;

        if (!recordingId || !uploadPath) {
          throw new Error('Invalid upload state');
        }

        // Upload custom thumbnail if provided
        let thumbnailUploaded = false;
        if (data.thumbnailFile) {
          console.log('[UploadWizard] Uploading custom thumbnail...');

          try {
            // Get fresh presigned URL (original URL may have expired)
            console.log('[UploadWizard] Requesting fresh thumbnail upload URL...');
            const urlResponse = await fetch(
              `/api/recordings/${recordingId}/thumbnail/upload-url?contentType=${encodeURIComponent(data.thumbnailFile.type)}`
            );

            if (!urlResponse.ok) {
              throw new Error('Failed to get thumbnail upload URL');
            }

            const urlData = await urlResponse.json();

            // Validate response shape
            if (
              !urlData ||
              typeof urlData !== 'object' ||
              !urlData.data ||
              typeof urlData.data !== 'object' ||
              typeof urlData.data.uploadUrl !== 'string' ||
              !urlData.data.uploadUrl
            ) {
              console.error('[UploadWizard] Invalid thumbnail upload URL response:', urlData);
              throw new Error('Invalid response from thumbnail upload URL endpoint');
            }

            const freshUploadUrl = urlData.data.uploadUrl;

            console.log('[UploadWizard] Got fresh upload URL, uploading thumbnail...');

            // Upload thumbnail with fresh URL
            const thumbnailResponse = await fetch(freshUploadUrl, {
              method: 'PUT',
              body: data.thumbnailFile,
              headers: {
                'Content-Type': data.thumbnailFile.type,
                'x-upsert': 'true',
              },
            });

            if (thumbnailResponse.ok) {
              thumbnailUploaded = true;
              console.log('[UploadWizard] Custom thumbnail uploaded successfully');
            } else {
              console.warn('[UploadWizard] Thumbnail upload failed with status:', thumbnailResponse.status);
            }
          } catch (err) {
            console.warn('[UploadWizard] Custom thumbnail upload failed (non-fatal):', err);
          }
        }

        // Save metadata and trigger processing
        console.log('[UploadWizard] Saving metadata and starting processing...');

        const metadataResponse = await fetch(
          `/api/recordings/${recordingId}/metadata`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: data.title,
              description: data.description,
              tags: data.tags,
              metadata: {},
              thumbnailUploaded,
              storagePath: uploadPath,
            }),
          }
        );

        if (!metadataResponse.ok) {
          const errorData = await metadataResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to save metadata');
        }

        const metadataResult = await metadataResponse.json();
        const { streamUrl } = metadataResult.data;

        console.log('[UploadWizard] Metadata saved, processing started', { streamUrl });

        setUploadState((prev) => ({ ...prev, streamUrl }));

        // Proceed to progress step
        setCurrentStep('progress');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[UploadWizard] Metadata save failed:', err);
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [uploadState]
  );

  /**
   * Handle back from metadata step
   */
  const handleMetadataBack = useCallback(() => {
    setCurrentStep('file_upload');
    setMetadataData(null);
  }, []);

  /**
   * Handle retry from progress step
   */
  const handleProgressRetry = useCallback(() => {
    resetWizard();
  }, [resetWizard]);

  /**
   * Handle cancel from progress step
   */
  const handleProgressCancel = useCallback(() => {
    resetWizard();
    onClose();
  }, [resetWizard, onClose]);

  /**
   * Get step indicator
   */
  const getStepIndicator = () => {
    const steps = [
      { label: 'Upload', shortLabel: 'Upload File' },
      { label: 'Details', shortLabel: 'Add Details' },
      { label: 'Processing', shortLabel: 'Processing' },
    ];
    const stepIndex = ['file_upload', 'metadata', 'progress'].indexOf(currentStep);

    return (
      <div className="flex items-center justify-between max-w-md mx-auto mb-8">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              {/* Step Circle */}
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-all duration-200',
                  index === stepIndex
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                    : index < stepIndex
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-muted text-muted-foreground border-2 border-muted'
                )}
              >
                {index < stepIndex ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {/* Step Label */}
              <div
                className={cn(
                  'mt-2 text-xs font-medium transition-colors',
                  index === stepIndex
                    ? 'text-foreground'
                    : index < stepIndex
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                {step.label}
              </div>
            </div>
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 px-2 pb-6">
                <div
                  className={cn(
                    'h-0.5 w-full transition-all duration-300',
                    index < stepIndex
                      ? 'bg-primary'
                      : 'bg-muted'
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <VisuallyHidden>
            <DialogTitle>
              {currentStep === 'file_upload' && 'Upload File'}
              {currentStep === 'metadata' && 'Add Details'}
              {currentStep === 'progress' && 'Processing Upload'}
            </DialogTitle>
            <DialogDescription>
              Multi-step upload wizard for adding content to your library
            </DialogDescription>
          </VisuallyHidden>
          {getStepIndicator()}
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Step 1: File Upload */}
          {currentStep === 'file_upload' && (
            <FileUploadStep
              onNext={handleFileUploadComplete}
              onCancel={handleClose}
            />
          )}

          {/* Step 2: Metadata Collection */}
          {currentStep === 'metadata' && fileData && (
            <MetadataCollectionStep
              defaultTitle={fileData.file.name.replace(/\.[^/.]+$/, '')}
              defaultThumbnail={fileData.thumbnail}
              onNext={handleMetadataComplete}
              onBack={handleMetadataBack}
            />
          )}

          {/* Step 3: Upload Progress */}
          {currentStep === 'progress' && uploadState.recordingId && uploadState.streamUrl && (
            <UploadProgressStep
              recordingId={uploadState.recordingId}
              streamUrl={uploadState.streamUrl}
              onRetry={handleProgressRetry}
              onCancel={handleProgressCancel}
            />
          )}

          {/* Global Error Display */}
          {error && currentStep !== 'progress' && (
            <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
