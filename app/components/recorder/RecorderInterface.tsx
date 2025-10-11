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

export default function RecorderInterface() {
  const { showTeleprompter, setShowTeleprompter, recordingBlob } = useRecording();
  const isReviewing = !!recordingBlob;

  return (
    <div className="flex flex-col bg-background">
      {/* Main Content Area */}
      <main className="flex flex-col items-center p-8 pt-4">
        {/* Video Streams (includes Placeholder if no stream) */}
        <div className="w-full max-w-5xl mb-4">
          <VideoStreams />
        </div>
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
