'use client';

import { Circle, Square } from 'lucide-react';
import { toast } from 'sonner';

import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

export function MainRecordButton() {
  const {
    layout,
    pipWindow,
    isRecording,
    countdown,
    screenshareStream,
    recordingBlob,
    startRecording,
    stopRecording,
  } = useRecording();

  // Check if screen sharing is required but not set
  const requiresScreen = layout === 'screenOnly' || layout === 'screenAndCamera';
  const screenMissing = requiresScreen && !screenshareStream;
  const isReviewing = !!recordingBlob;

  const handleClick = async () => {
    console.log('[MainRecordButton] Button clicked, isRecording:', isRecording);
    if (isRecording) {
      console.log('[MainRecordButton] Calling stopRecording()');
      stopRecording();
    } else if (isReviewing) {
      toast.error('Review in progress', {
        description: 'Please finish reviewing your current recording first.',
        duration: 4000,
      });
      return;
    } else {
      // Check if screen is required but missing
      if (screenMissing) {
        toast.error('Screen sharing required', {
          description: 'Please click "Share screen" to select a screen or window before recording.',
          duration: 5000,
        });
        return;
      }

      // Opens PiP window for screen-based layouts, or starts recording for camera-only
      await startRecording();
    }
  };

  return (
    <div className="relative">
      <Button
        size="lg"
        onClick={handleClick}
        disabled={countdown !== null || isReviewing}
        className={cn(
          'relative h-20 w-20 rounded-full p-0 transition-all duration-200 flex items-center justify-center',
          isRecording
            ? 'bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/50'
            : 'bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/30',
          (countdown !== null || isReviewing) && 'opacity-50 cursor-not-allowed',
          screenMissing && !isReviewing && 'opacity-60'
        )}
        aria-label={
          isReviewing
            ? 'Reviewing recording - Finish review first'
            : screenMissing
            ? 'Screen sharing required - Click "Share screen" first'
            : isRecording
            ? 'Stop recording'
            : pipWindow && !isRecording
            ? 'Recorder open'
            : 'Start recording'
        }
        style={{ pointerEvents: 'auto', zIndex: 10 }}
      >
        {/* Countdown display */}
        {countdown !== null ? (
          <span className="text-3xl font-bold">
            {countdown}
          </span>
        ) : isRecording ? (
          <Square className="size-8 fill-current" />
        ) : (
          <Circle className="size-10 fill-current" />
        )}
      </Button>

      {/* Recording pulse ring */}
      {isRecording && (
        <>
          <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-20" />
          <span className="absolute inset-0 rounded-full border-2 border-destructive animate-pulse" />
        </>
      )}
    </div>
  );
}
