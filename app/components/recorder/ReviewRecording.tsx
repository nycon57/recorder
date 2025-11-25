'use client';

/**
 * PERF-FE-002: Code-split Review component
 *
 * This component is loaded dynamically to avoid bundling FFmpeg (~650KB + 4.5MB WASM)
 * with the initial page load. FFmpeg is only needed after recording is complete.
 */

import { useCallback, useEffect, useState } from 'react';
import { Download, Save, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { useFFmpeg } from '@/app/hooks/useFFmpeg';
import { SaveRecordingModal } from '@/app/components/recorder/SaveRecordingModal';
import { Button } from '@/app/components/ui/button';

export function ReviewRecording() {
  const { recordingBlob, clearRecording } = useRecording();
  const { convertToMP4, isConverting, error: ffmpegError } = useFFmpeg();
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Create video URL from blob
  useEffect(() => {
    if (recordingBlob) {
      console.log('[Review] Creating blob URL for recording, size:', recordingBlob.size);

      // Check for empty blob
      if (recordingBlob.size === 0) {
        console.error('[Review] Recording blob is empty (0 bytes)');
        toast.error('Recording failed', {
          description: 'The recording is empty. Please try recording again.',
        });
        // Clear the empty recording
        clearRecording();
        return;
      }

      const url = URL.createObjectURL(recordingBlob);
      setVideoUrl(url);
      return () => {
        console.log('[Review] Revoking blob URL:', url);
        URL.revokeObjectURL(url);
      };
    } else {
      // Clear video URL when blob is cleared
      console.log('[Review] Recording blob cleared, clearing video URL');
      setVideoUrl('');
    }
  }, [recordingBlob, clearRecording]);

  // Warn user about unsaved recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have an unsaved recording. Leaving will discard it.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleDownload = async () => {
    if (!recordingBlob) return;

    const mp4Blob = await convertToMP4(recordingBlob);
    if (!mp4Blob) {
      toast.error('Failed to convert video');
      return;
    }

    // Download the MP4 file
    const url = URL.createObjectURL(mp4Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recording-${Date.now()}.mp4`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Video downloaded');
  };

  const handleSave = () => {
    setShowSaveModal(true);
  };

  const handleSaveComplete = () => {
    clearRecording();
    toast.success('Recording saved successfully');
  };

  const handleDiscard = () => {
    clearRecording();
    toast.info('Recording discarded');
  };

  return (
    <>
      <div className="w-full space-y-4">
        {/* Video Preview */}
        {videoUrl && (
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
              aria-label="Recording preview"
            />
          </div>
        )}

        {/* Actions Area */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Recording Complete</h3>
              <p className="text-sm text-muted-foreground">
                Choose how you'd like to proceed with your recording
              </p>
            </div>
          </div>

          {/* Error message */}
          {ffmpegError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {ffmpegError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isConverting}
              className="w-full"
            >
              {isConverting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Download
                </>
              )}
            </Button>

            <Button
              onClick={handleSave}
              disabled={isConverting}
              className="w-full"
            >
              <Save className="size-4" />
              Save Recording
            </Button>

            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={isConverting}
              className="w-full"
            >
              <RotateCcw className="size-4" />
              Discard
            </Button>
          </div>
        </div>
      </div>

      {/* Save Recording Modal */}
      <SaveRecordingModal
        isOpen={showSaveModal}
        recordingBlob={recordingBlob}
        onClose={() => setShowSaveModal(false)}
        onSaveComplete={handleSaveComplete}
      />
    </>
  );
}

export default ReviewRecording;
