'use client';

import { Monitor, MonitorPlay, Camera } from 'lucide-react';
import { useRecording, type RecordingLayout } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group';

export function LayoutSwitcher() {
  const { layout, setLayout } = useRecording();

  return (
    <div className="w-full">
      <ToggleGroup
        type="single"
        value={layout}
        onValueChange={(value: RecordingLayout) => {
          if (value) {
            setLayout(value);
          }
        }}
        variant="outline"
        className="inline-flex w-full rounded-lg bg-background/50 backdrop-blur-sm border border-border/50 p-1 gap-0.5 shadow-sm hover:border-border/80 transition-colors"
        aria-label="Recording layout mode"
      >
        <ToggleGroupItem
          value="screenOnly"
          aria-label="Screen only"
          className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-md transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:bg-muted/50 data-[state=on]:hover:bg-primary/90"
        >
          <Monitor className="size-4 flex-shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">Screen only</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="screenAndCamera"
          aria-label="Screen and camera"
          className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-md transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:bg-muted/50 data-[state=on]:hover:bg-primary/90"
        >
          <MonitorPlay className="size-4 flex-shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">Screen and camera</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="cameraOnly"
          aria-label="Camera only"
          className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-md transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:bg-muted/50 data-[state=on]:hover:bg-primary/90"
        >
          <Camera className="size-4 flex-shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">Camera only</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
