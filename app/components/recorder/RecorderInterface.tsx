'use client';

import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import {
  VideoStreams,
  LayoutSwitcher,
  ShapeSelect,
  CameraSelect,
  MicrophoneSelect,
  TeleprompterSelect,
  MainRecordButton,
  Teleprompter,
  PiPWindow,
} from '@/app/components/recorder';
import { LiveWaveform } from '@/app/components/ui/live-waveform';
import { Card, CardContent } from '@/app/components/ui/card';

export default function RecorderInterface() {
  const { showTeleprompter, setShowTeleprompter, recordingBlob, isRecording, microphoneEnabled } = useRecording();
  const isReviewing = !!recordingBlob;

  return (
    <div className="flex flex-col bg-background">
      {/* Main Content Area */}
      <main className="flex flex-col items-center p-8 pt-4">
        {/* Video Streams (includes Placeholder if no stream) */}
        <div className="w-full max-w-5xl mb-4">
          <VideoStreams />
        </div>

        {/* Live Audio Waveform Visualization */}
        {microphoneEnabled && (isRecording || isReviewing) && (
          <Card className="w-full max-w-5xl mb-4">
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">
                    {isRecording ? 'Recording Audio' : 'Recording Preview'}
                  </h3>
                  {isRecording && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                      <span className="text-xs text-muted-foreground">Live</span>
                    </div>
                  )}
                </div>
                <LiveWaveform
                  active={isRecording}
                  height={80}
                  barWidth={3}
                  barGap={2}
                  barRadius={2}
                  sensitivity={1.5}
                  mode="static"
                  className="rounded-lg bg-muted/30 border border-border"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer - Always visible */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="grid grid-cols-3 items-center gap-4">
            {/* Left - Layout Switcher */}
            <div className="flex items-center justify-start">
              <div className={isReviewing ? 'opacity-50 pointer-events-none' : ''}>
                <LayoutSwitcher />
              </div>
            </div>

            {/* Center - Record Button */}
            <div className="flex justify-center">
              <MainRecordButton />
            </div>

            {/* Right - Device Selectors */}
            <div className={`flex items-center justify-end gap-3 ${isReviewing ? 'opacity-50 pointer-events-none' : ''}`}>
              <TeleprompterSelect />
              <ShapeSelect />
              <MicrophoneSelect />
              <CameraSelect />
            </div>
          </div>
        </div>
      </footer>

      {/* Picture-in-Picture Window */}
      <PiPWindow />

      {/* Teleprompter */}
      <Teleprompter
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
      />
    </div>
  );
}
