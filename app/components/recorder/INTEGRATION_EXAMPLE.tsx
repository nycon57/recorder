/**
 * INTEGRATION EXAMPLE
 *
 * This file demonstrates how to use the new recorder components
 * in your recording page or application.
 *
 * Copy this example to your page and customize as needed.
 */

'use client';

import { useState } from 'react';

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
import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui';
import { Separator } from '@/app/components/ui/separator';

export function RecordingPageExample() {
  const { showTeleprompter, setShowTeleprompter } = useRecording();
  const [uploadedRecordingId, setUploadedRecordingId] = useState<string | null>(null);

  const handleUploadComplete = (recordingId: string) => {
    console.log('Recording uploaded successfully:', recordingId);
    setUploadedRecordingId(recordingId);

    // Optional: Navigate to the recording page
    // router.push(`/recordings/${recordingId}`);

    // Optional: Show success toast
    // toast.success('Recording uploaded and processing started!');
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Record</h1>
          <p className="text-muted-foreground">
            Capture your screen, camera, and audio. Upload for automatic transcription and AI processing.
          </p>
        </div>

        {/* Video Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <VideoStreams />
            </div>
          </CardContent>
        </Card>

        {/* Recording Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Recording Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Layout Mode */}
            <div>
              <h3 className="text-sm font-medium mb-3">Layout Mode</h3>
              <LayoutSwitcher />
            </div>

            <Separator />

            {/* Device Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CameraSelect />
              <MicrophoneSelect />
            </div>

            <Separator />

            {/* Camera Settings */}
            <ShapeSelect />

            <Separator />

            {/* Advanced Features */}
            <div>
              <h3 className="text-sm font-medium mb-3">Advanced</h3>
              <TeleprompterSelect />
            </div>
          </CardContent>
        </Card>

        {/* Record Button */}
        <div className="flex justify-center py-8">
          <MainRecordButton />
        </div>

        {/* Upload Status */}
        {uploadedRecordingId && (
          <Card className="border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="pt-6">
              <p className="text-center text-sm">
                Recording uploaded successfully! Processing ID:{' '}
                <code className="font-mono bg-white dark:bg-black px-2 py-1 rounded">
                  {uploadedRecordingId}
                </code>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Keyboard Shortcuts Help */}
        <Card>
          <CardHeader>
            <CardTitle>Keyboard Shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start/Stop Recording</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">R</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pause/Resume</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">P</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toggle Teleprompter</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">T</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Switch Layout</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">L</kbd>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals and Overlays (rendered conditionally) */}
      {/* <RecordingModal onUploadComplete={handleUploadComplete} /> */}

      <Teleprompter
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
      />

      <PiPWindow />
    </div>
  );
}

/**
 * MINIMAL EXAMPLE
 *
 * If you just need the bare minimum:
 */

export function MinimalRecordingExample() {
  const { showTeleprompter, setShowTeleprompter } = useRecording();

  return (
    <div className="space-y-6 p-6">
      {/* Video preview */}
      <div className="aspect-video">
        <VideoStreams />
      </div>

      {/* Controls */}
      <div className="grid gap-4 md:grid-cols-2">
        <LayoutSwitcher />
        <CameraSelect />
      </div>

      {/* Record button */}
      <div className="flex justify-center">
        <MainRecordButton />
      </div>

      {/* Required modals */}
      {/* <RecordingModal /> */}
      <Teleprompter
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
      />
      <PiPWindow />
    </div>
  );
}

/**
 * CUSTOM LAYOUT EXAMPLE
 *
 * For a more compact or sidebar layout:
 */

export function CompactRecordingExample() {
  const { showTeleprompter, setShowTeleprompter } = useRecording();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Left: Video Preview (2/3 width on desktop) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="aspect-video">
          <VideoStreams />
        </div>

        <div className="flex justify-center">
          <MainRecordButton />
        </div>
      </div>

      {/* Right: Controls Sidebar (1/3 width on desktop) */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Layout</CardTitle>
          </CardHeader>
          <CardContent>
            <LayoutSwitcher />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CameraSelect />
            <MicrophoneSelect />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Camera</CardTitle>
          </CardHeader>
          <CardContent>
            <ShapeSelect />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <TeleprompterSelect />
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {/* <RecordingModal /> */}
      <Teleprompter
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
      />
      <PiPWindow />
    </div>
  );
}
