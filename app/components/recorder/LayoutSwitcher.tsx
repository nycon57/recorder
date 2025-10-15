'use client';

import { Monitor, MonitorPlay, Camera } from 'lucide-react';

import { useRecording, type RecordingLayout } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group';

export function LayoutSwitcher() {
  const { layout, setLayout } = useRecording();

  return (
    <ToggleGroup
      type="single"
      value={layout}
      onValueChange={(value: RecordingLayout) => {
        if (value) {
          setLayout(value);
        }
      }}
      variant="outline"
      className="inline-flex gap-2"
      aria-label="Recording layout mode"
    >
        <ToggleGroupItem
          value="screenOnly"
          aria-label="Screen only"
          className="flex flex-col items-center justify-center gap-2 px-6 py-3.5 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:bg-muted/50 data-[state=on]:hover:bg-primary/90 border border-border min-h-[64px]"
        >
          <Monitor className="size-5 flex-shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">Screen only</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="screenAndCamera"
          aria-label="Screen and camera"
          className="flex flex-col items-center justify-center gap-2 px-6 py-3.5 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:bg-muted/50 data-[state=on]:hover:bg-primary/90 border border-border min-h-[64px]"
        >
          <MonitorPlay className="size-5 flex-shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">Screen and camera</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="cameraOnly"
          aria-label="Camera only"
          className="flex flex-col items-center justify-center gap-2 px-6 py-3.5 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:bg-muted/50 data-[state=on]:hover:bg-primary/90 border border-border min-h-[64px]"
        >
          <Camera className="size-5 flex-shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">Camera only</span>
        </ToggleGroupItem>
      </ToggleGroup>
  );
}
