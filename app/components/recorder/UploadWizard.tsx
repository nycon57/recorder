'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import FileUploadStep from './steps/FileUploadStep';
import MetadataCollectionStep from './steps/MetadataCollectionStep';
import UploadProgressStep from './steps/UploadProgressStep';
import type { ContentType } from '@/lib/types/content';
import type { AnalysisType } from '@/lib/services/analysis-templates';

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
  analysisType?: AnalysisType;
  skipAnalysis?: boolean;
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
  uploadCompleted?: boolean;
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
   * Add beforeunload warning when user has an incomplete upload
   * This prevents accidental data loss if user closes browser/tab
   */
  useEffect(() => {
    const shouldWarn = (currentStep === 'metadata' || currentStep === 'progress') &&
                       uploadState.recordingId &&
                       !uploadState.uploadCompleted;

    if (!shouldWarn) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers require returnValue to be set
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    console.log('[UploadWizard] 🔔 Adding beforeunload warning - upload in progress');
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('[UploadWizard] 🔕 Removing beforeunload warning');
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentStep, uploadState.recordingId, uploadState.uploadCompleted]);

  /**
   * Log step changes for debugging
   */
  useEffect(() => {
    console.log('[UploadWizard] 📍 Step changed:', currentStep, {
      hasFileData: !!fileData,
      hasMetadataData: !!metadataData,
      recordingId: uploadState.recordingId,
      isUploading,
    });
  }, [currentStep, fileData, metadataData, uploadState.recordingId, isUploading]);

  /**
   * Cleanup orphan recording if user closes modal after file upload but before completion
   * Uses soft delete (moves to trash) to properly release quota and respect safety checks
   */
  const cleanupOrphanRecording = useCallback(async () => {
    const { recordingId } = uploadState;

    if (!recordingId) {
      console.log('[UploadWizard] 🧹 No orphan recording to cleanup');
      return; // No recording to cleanup
    }

    console.log('[UploadWizard] 🧹 Cleaning up orphan recording (soft delete):', recordingId);

    try {
      // Use soft delete (no permanent flag) - moves to trash and releases quota
      // This respects the DELETE endpoint's safety checks and properly releases quota
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('[UploadWizard] ✅ Orphan recording moved to trash (quota released)');
      } else {
        const errorText = await response.text();
        console.warn('[UploadWizard] ⚠️ Failed to cleanup orphan recording:', errorText);
      }
    } catch (err) {
      console.error('[UploadWizard] ❌ Error cleaning up orphan recording:', err);
    }
  }, [uploadState]);

  /**
   * Handle wizard close
   */
  const handleClose = useCallback(async () => {
    console.log('[UploadWizard] 🚪 Close requested', { currentStep, isUploading, recordingId: uploadState.recordingId });

    // Only allow close if not actively uploading
    if (isUploading) {
      console.log('[UploadWizard] 🚫 Close blocked - upload in progress');
      return;
    }

    // If user is at metadata step (Step 2), they've uploaded a file but haven't completed the wizard
    // This leaves an orphan recording in the database - we should clean it up
    if (currentStep === 'metadata' && uploadState.recordingId) {
      console.log('[UploadWizard] 🗑️ User closing modal at metadata step - cleaning up orphan recording');
      await cleanupOrphanRecording();
    }

    console.log('[UploadWizard] ✅ Closing wizard and resetting state');
    resetWizard();
    onClose();
  }, [isUploading, currentStep, uploadState.recordingId, cleanupOrphanRecording, resetWizard, onClose]);

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
        let thumbnailPath: string | undefined;
        console.log('[UploadWizard] Checking for thumbnail file:', {
          hasThumbnailFile: !!data.thumbnailFile,
          thumbnailFileName: data.thumbnailFile?.name,
          thumbnailFileType: data.thumbnailFile?.type,
          thumbnailFileSize: data.thumbnailFile?.size,
        });
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
            thumbnailPath = urlData.data.path; // Capture the storage path

            console.log('[UploadWizard] Got fresh upload URL, uploading thumbnail...', {
              thumbnailPath,
              uploadUrlPreview: freshUploadUrl?.substring(0, 100) + '...',
            });

            // Upload thumbnail with fresh URL
            console.log('[UploadWizard] Starting PUT request to storage...');
            const thumbnailResponse = await fetch(freshUploadUrl, {
              method: 'PUT',
              body: data.thumbnailFile,
              headers: {
                'Content-Type': data.thumbnailFile.type,
                'x-upsert': 'true',
              },
            });

            console.log('[UploadWizard] Thumbnail upload response:', {
              ok: thumbnailResponse.ok,
              status: thumbnailResponse.status,
              statusText: thumbnailResponse.statusText,
            });

            if (thumbnailResponse.ok) {
              thumbnailUploaded = true;
              console.log('[UploadWizard] Custom thumbnail uploaded successfully', { thumbnailPath });
            } else {
              const errorText = await thumbnailResponse.text().catch(() => 'Unable to read error');
              console.warn('[UploadWizard] Thumbnail upload failed:', {
                status: thumbnailResponse.status,
                statusText: thumbnailResponse.statusText,
                errorText,
              });
              thumbnailPath = undefined; // Clear path on failure
            }
          } catch (err) {
            console.warn('[UploadWizard] Custom thumbnail upload failed (non-fatal):', err);
            thumbnailPath = undefined; // Clear path on failure
          }
        }

        // Save metadata and trigger processing
        console.log('[UploadWizard] Saving metadata and starting processing...', {
          analysisType: data.analysisType,
          skipAnalysis: data.skipAnalysis,
          thumbnailUploaded,
          thumbnailPath,
        });

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
              thumbnailPath, // Pass the storage path for correct URL generation
              storagePath: uploadPath,
              analysisType: data.analysisType,
              skipAnalysis: data.skipAnalysis,
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
  const handleMetadataBack = useCallback(async () => {
    console.log('[UploadWizard] ⬅️ Back button clicked from metadata step');

    // User is going back from Step 2 to Step 1
    // This means they want to select a different file, so we should cleanup the current orphan recording
    if (uploadState.recordingId) {
      console.log('[UploadWizard] 🗑️ Cleaning up current recording before going back');
      await cleanupOrphanRecording();
    }

    console.log('[UploadWizard] 📍 Returning to file upload step (preserving file data)');
    setCurrentStep('file_upload');
    setMetadataData(null);
    // Reset upload state since we're starting over
    setUploadState({});
    // NOTE: We keep fileData so the uploaded file is still visible
  }, [uploadState.recordingId, cleanupOrphanRecording]);

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
   * Get step indicator - Clean, minimal stepper with progress feedback
   * Shows loading animation when uploading/validating
   */
  const getStepIndicator = () => {
    const steps = [
      {
        label: 'Upload',
        description: 'Select your file',
        loadingText: 'Uploading file...'
      },
      {
        label: 'Details',
        description: 'Add information',
        loadingText: 'Saving metadata...'
      },
      {
        label: 'Processing',
        description: 'Finalizing upload',
        loadingText: 'Processing...'
      },
    ];
    const stepIndex = ['file_upload', 'metadata', 'progress'].indexOf(currentStep);

    return (
      <div className="w-full max-w-2xl mx-auto mb-8 px-4">
        {/* Progress feedback bar during upload */}
        {isUploading && (
          <div className="mb-4 text-center animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-primary">
                {steps[stepIndex]?.loadingText || 'Processing...'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-0">
          {steps.map((step, index) => {
            const isActive = index === stepIndex;
            const isCompleted = index < stepIndex;
            const isPending = index > stepIndex;
            const isActiveAndLoading = isActive && isUploading;

            return (
              <div key={step.label} className="flex items-center">
                {/* Step Container */}
                <div className="flex flex-col items-center w-32">
                  {/* Step Circle */}
                  <div
                    className={cn(
                      'relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200',
                      isCompleted && 'bg-muted border-muted',
                      isActive && !isUploading && 'bg-foreground border-foreground ring-2 ring-foreground/20',
                      isActiveAndLoading && 'bg-primary border-primary ring-2 ring-primary/20',
                      isPending && 'bg-transparent border-border'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-background" />
                    ) : isActiveAndLoading ? (
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isActive && 'text-background',
                          isPending && 'text-muted-foreground'
                        )}
                      >
                        {index + 1}
                      </span>
                    )}
                    {/* Pulse animation for active uploading step */}
                    {isActiveAndLoading && (
                      <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="mt-2 text-center w-full px-2">
                    <div
                      className={cn(
                        'text-sm font-medium transition-colors',
                        isCompleted && 'text-foreground',
                        isActive && 'text-foreground',
                        isActiveAndLoading && 'text-primary',
                        isPending && 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                      {step.description}
                    </div>
                  </div>
                </div>

                {/* Connector Line - animated fill during upload */}
                {index < steps.length - 1 && (
                  <div className="w-16 -mt-6 sm:w-20 relative">
                    {/* Background line */}
                    <div className="h-0.5 w-full bg-border" />
                    {/* Filled line for completed steps */}
                    <div
                      className={cn(
                        'absolute top-0 left-0 h-0.5 transition-all duration-500',
                        index < stepIndex ? 'w-full bg-muted' : 'w-0'
                      )}
                    />
                    {/* Animated fill for current step when uploading */}
                    {isActiveAndLoading && index === stepIndex && (
                      <div className="absolute top-0 left-0 h-0.5 w-full overflow-hidden">
                        <div className="h-full w-full bg-primary/50 animate-pulse origin-left" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto p-0"
        showCloseButton={!isUploading}
      >
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
              initialFileData={fileData}
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
              onComplete={() => setUploadState((prev) => ({ ...prev, uploadCompleted: true }))}
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
