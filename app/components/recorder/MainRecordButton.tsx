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
    if (isRecording) {
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
    <Button
      size="lg"
      onClick={handleClick}
      disabled={countdown !== null || isReviewing}
      className={cn(
        'relative h-20 w-20 rounded-full p-0 transition-all duration-200',
        isRecording
          ? 'bg-destructive hover:bg-destructive/90 text-white'
          : 'bg-primary hover:bg-primary/90 text-primary-foreground',
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
    >
      {/* Countdown display */}
      {countdown !== null ? (
        <span className="text-3xl font-bold">{countdown}</span>
      ) : isRecording ? (
        <Square className="size-7 fill-current" />
      ) : (
        <Circle className="size-7 fill-current" />
      )}

      {/* Recording pulse animation */}
      {isRecording && (
        <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-25" />
      )}
    </Button>
  );
}
