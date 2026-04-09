'use client';

import { Circle, Square } from 'lucide-react';

import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Button } from '@/app/components/ui/button';

export function ShapeSelect() {
  const { cameraShape, setCameraShape } = useRecording();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setCameraShape(cameraShape === 'circle' ? 'square' : 'circle')}
      aria-label={`Camera shape: ${cameraShape}`}
      title={`Camera shape: ${cameraShape}`}
      className="h-9 w-9"
    >
      {cameraShape === 'circle' ? (
        <Circle className="size-4" />
      ) : (
        <Square className="size-4" />
      )}
    </Button>
  );
}
