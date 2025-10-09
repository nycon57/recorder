'use client';

import { useRouter } from 'next/navigation';
import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import {
  VideoStreams,
  LayoutSwitcher,
  ShapeSelect,
  CameraSelect,
  MicrophoneSelect,
  TeleprompterSelect,
  MainRecordButton,
  RecordingModal,
  Teleprompter,
  PiPWindow,
} from '@/app/components/recorder';

export default function RecorderInterface() {
  const router = useRouter();
  const { showTeleprompter, setShowTeleprompter } = useRecording();

  const handleUploadComplete = (recordingId: string) => {
    router.push(`/recordings/${recordingId}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Video Streams (includes Placeholder if no stream) */}
        <div className="w-full max-w-5xl mb-8">
          <VideoStreams />
        </div>

        {/* Layout Switcher */}
        <LayoutSwitcher />
      </main>

      {/* Footer - Always visible */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="grid grid-cols-3 items-center">
            {/* Left spacer */}
            <div></div>

            {/* Center - Record Button */}
            <div className="flex justify-center">
              <MainRecordButton />
            </div>

            {/* Right - Device Selectors */}
            <div className="flex items-center justify-end gap-3">
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

      {/* Recording Modal */}
      <RecordingModal onUploadComplete={handleUploadComplete} />

      {/* Teleprompter */}
      <Teleprompter
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
      />
    </div>
  );
}
