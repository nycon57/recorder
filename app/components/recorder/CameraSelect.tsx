'use client';

import { Video, VideoOff } from 'lucide-react';

import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

export function CameraSelect() {
  const { cameraEnabled, setCameraEnabled } = useRecording();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setCameraEnabled(!cameraEnabled)}
      aria-label="Toggle camera"
      title="Toggle camera"
      className={cn('h-9 w-9', !cameraEnabled && 'text-muted-foreground')}
    >
      {cameraEnabled ? (
        <Video className="size-4" />
      ) : (
        <VideoOff className="size-4" />
      )}
    </Button>
  );
}
