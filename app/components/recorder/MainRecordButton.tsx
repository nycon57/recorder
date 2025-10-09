'use client';

import { Circle, Square } from 'lucide-react';
import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

export function MainRecordButton() {
  const {
    layout,
    pipWindow,
    isRecording,
    countdown,
    startRecording,
    stopRecording,
  } = useRecording();

  const handleClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Opens PiP window for screen-based layouts, or starts recording for camera-only
      await startRecording();
    }
  };

  // For screen-based layouts with PiP open but not recording, show different state
  const isPipOpenButNotRecording = pipWindow && !isRecording && layout !== 'cameraOnly';

  return (
    <Button
      size="lg"
      onClick={handleClick}
      disabled={countdown !== null}
      className={cn(
        'relative h-20 w-20 rounded-full p-0 transition-all duration-200',
        isRecording
          ? 'bg-destructive hover:bg-destructive/90 text-white'
          : isPipOpenButNotRecording
          ? 'bg-blue-600 hover:bg-blue-700 text-white'
          : 'bg-primary hover:bg-primary/90 text-primary-foreground',
        countdown !== null && 'opacity-50 cursor-not-allowed'
      )}
      aria-label={
        isRecording
          ? 'Stop recording'
          : isPipOpenButNotRecording
          ? 'Recorder open'
          : 'Open recorder'
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
