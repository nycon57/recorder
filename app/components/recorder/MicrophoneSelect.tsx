'use client';

import { Mic, MicOff } from 'lucide-react';

import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

export function MicrophoneSelect() {
  const { microphoneEnabled, setMicrophoneEnabled } = useRecording();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setMicrophoneEnabled(!microphoneEnabled)}
      aria-label="Toggle microphone"
      title="Toggle microphone"
      className={cn('h-9 w-9', !microphoneEnabled && 'text-muted-foreground')}
    >
      {microphoneEnabled ? (
        <Mic className="size-4" />
      ) : (
        <MicOff className="size-4" />
      )}
    </Button>
  );
}
