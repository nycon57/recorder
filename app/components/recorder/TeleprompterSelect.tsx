'use client';

import { FileText } from 'lucide-react';
import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

export function TeleprompterSelect() {
  const { showTeleprompter, setShowTeleprompter } = useRecording();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setShowTeleprompter(!showTeleprompter)}
      aria-label="Toggle teleprompter"
      title="Toggle teleprompter"
      className={cn('h-9 w-9', showTeleprompter && 'bg-accent')}
    >
      <FileText className="size-4" />
    </Button>
  );
}
