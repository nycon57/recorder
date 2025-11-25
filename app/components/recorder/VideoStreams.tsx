'use client';

/**
 * PERF-FE-002: Code-split heavy components
 *
 * This component dynamically imports ReviewRecording which contains FFmpeg.
 * FFmpeg (~650KB + 4.5MB WASM) is only loaded when the user finishes recording.
 */

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { MonitorPlay, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CAMERA_WIDTH,
  CAMERA_HEIGHT,
  CAMERA_MARGIN_RIGHT,
  CAMERA_MARGIN_BOTTOM,
  CAMERA_BORDER_RADIUS,
} from '@/app/(dashboard)/record/services/composer';

// PERF-FE-002: Dynamically import Review component to avoid loading FFmpeg on initial page load
// This saves ~650KB in the initial bundle + delays loading ~4.5MB WASM until recording is complete
const ReviewRecording = dynamic(
  () => import('@/app/components/recorder/ReviewRecording'),
  {
    loading: () => (
      <div className="w-full space-y-4">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="size-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading video tools...</p>
          </div>
        </div>
      </div>
    ),
    ssr: false, // FFmpeg requires browser APIs
  }
);

type ScreenshareSize = {
  width: number;
  height: number;
};

const percentage = (value: number) => `${value * 100}%`;

// Placeholder component (shown when no stream)
function Placeholder() {
  const [isRequesting, setIsRequesting] = useState(false);
  const { requestMediaStreams, cameraStream, cameraShape, layout } = useRecording();

  const startScreenshare = async () => {
    setIsRequesting(true);
    try {
      await requestMediaStreams();
    } finally {
      setIsRequesting(false);
    }
  };

  // Callback ref to set camera stream immediately when video element mounts
  const setCameraRef = useCallback((videoElement: HTMLVideoElement | null) => {
    const info = {
      hasVideoElement: !!videoElement,
      hasCameraStream: !!cameraStream,
      streamId: cameraStream?.id,
      layout,
    };
    console.log('[Placeholder] Camera ref callback:', JSON.stringify(info, null, 2));

    if (videoElement && cameraStream) {
      console.log('[Placeholder] ✅ Setting camera srcObject');
      videoElement.srcObject = cameraStream;

      // Handle stream errors gracefully
      videoElement.onerror = (e) => {
        console.warn('[Placeholder] Video element error (likely stream closed):', e);
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
      };
    } else if (videoElement && !cameraStream) {
      // Clear srcObject when stream is removed
      videoElement.srcObject = null;
    }
  }, [cameraStream, layout]);

  const placeholderInfo = {
    layout,
    hasCameraStream: !!cameraStream,
    isRequesting,
    cameraStreamId: cameraStream?.id,
  };
  console.log('[Placeholder] Render:', JSON.stringify(placeholderInfo, null, 2));

  return (
    <div className="relative flex flex-col items-center justify-center aspect-video bg-background rounded-lg border border-border">
      <h1 className="text-3xl font-bold text-foreground mb-6">
        Record your screen
      </h1>
      <Button
        size="lg"
        onClick={startScreenshare}
        disabled={isRequesting}
        className="h-14 px-8 text-lg font-medium rounded-full disabled:opacity-50"
      >
        <MonitorPlay className="size-5 mr-2" />
        {isRequesting ? 'Requesting access...' : 'Share screen'}
      </Button>

      {/* Camera preview in bottom-right corner */}
      {(() => {
        const shouldShowCamera = !!(layout !== 'screenOnly' && cameraStream);
        const previewInfo = {
          layout,
          hasCameraStream: !!cameraStream,
          shouldShowCamera,
          cameraStreamId: cameraStream?.id,
        };
        console.log('[Placeholder] Camera preview check:', JSON.stringify(previewInfo, null, 2));
        return shouldShowCamera ? (
          <video
            ref={setCameraRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'absolute z-10 object-cover',
              cameraShape === 'circle' && 'rounded-full',
              cameraShape === 'square' && 'rounded-lg'
            )}
            style={{
              right: '40px',
              bottom: '40px',
              width: '240px',
              height: '240px',
              borderRadius: cameraShape === 'circle' ? '50%' : '8px',
            }}
          />
        ) : null;
      })()}
    </div>
  );
}

export function VideoStreams() {
  const { cameraStream, screenshareStream, layout, cameraShape, changeScreenshare, isRecording, isEntireScreenShared, recordingBlob } = useRecording();
  const [screenshareSize, setScreenshareSize] = useState<ScreenshareSize | null>(null);
  const [isChangingScreen, setIsChangingScreen] = useState(false);

  // Show notification when camera overlay is auto-hidden due to entire screen sharing
  useEffect(() => {
    if (isEntireScreenShared && layout === 'screenAndCamera' && cameraStream) {
      toast.info('Camera overlay disabled', {
        description: 'When sharing your entire screen, the camera overlay is hidden to prevent recursive capture. Your camera will only appear in the Picture-in-Picture window.',
        duration: 6000,
      });
    }
  }, [isEntireScreenShared, layout, cameraStream]);

  const handleChangeScreen = async () => {
    setIsChangingScreen(true);
    try {
      await changeScreenshare();
    } finally {
      setIsChangingScreen(false);
    }
  };

  // Callback ref for main camera view (camera-only mode)
  const setMainCameraRef = useCallback((videoElement: HTMLVideoElement | null) => {
    const info = {
      hasVideoElement: !!videoElement,
      hasCameraStream: !!cameraStream,
      streamId: cameraStream?.id,
      layout,
      context: 'main-camera',
    };
    console.log('[VideoStreams] Main camera ref callback:', JSON.stringify(info, null, 2));

    if (videoElement && cameraStream) {
      console.log('[VideoStreams] ✅ Setting main camera srcObject');
      videoElement.srcObject = cameraStream;

      // Handle stream errors gracefully (e.g., when stream is closed after recording stops)
      videoElement.onerror = (e) => {
        console.warn('[VideoStreams] Video element error (likely stream closed):', e);
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
      };
    } else if (videoElement && !cameraStream) {
      // Clear srcObject when stream is removed
      videoElement.srcObject = null;
    }
  }, [cameraStream, layout]);

  // Callback ref for screenshare view (screen modes)
  const setScreenshareRef = useCallback((videoElement: HTMLVideoElement | null) => {
    const info = {
      hasVideoElement: !!videoElement,
      hasScreenshareStream: !!screenshareStream,
      streamId: screenshareStream?.id,
      layout,
      context: 'main-screenshare',
    };
    console.log('[VideoStreams] Screenshare ref callback:', JSON.stringify(info, null, 2));

    if (videoElement && screenshareStream) {
      console.log('[VideoStreams] ✅ Setting screenshare srcObject');
      videoElement.srcObject = screenshareStream;
    }
  }, [screenshareStream, layout]);

  // Callback ref for camera overlay (screen-and-camera mode)
  const setCameraOverlayRef = useCallback((videoElement: HTMLVideoElement | null) => {
    const info = {
      hasVideoElement: !!videoElement,
      hasCameraStream: !!cameraStream,
      streamId: cameraStream?.id,
      layout,
      context: 'overlay',
    };
    console.log('[VideoStreams] Camera overlay ref callback:', JSON.stringify(info, null, 2));

    if (videoElement && cameraStream) {
      console.log('[VideoStreams] ✅ Setting camera overlay srcObject');
      videoElement.srcObject = cameraStream;
    }
  }, [cameraStream, layout]);

  // Reset screenshare size when stream is removed
  if (!screenshareStream && screenshareSize) {
    setScreenshareSize(null);
  }

  const screenshareWidth = screenshareSize?.width ?? 1920;
  const screenshareHeight = screenshareSize?.height ?? 1080;

  // Show placeholder when no streams available
  const shouldShowPlaceholder = layout === 'cameraOnly'
    ? !cameraStream
    : !screenshareStream;

  const renderInfo = {
    layout,
    hasCameraStream: !!cameraStream,
    hasScreenshareStream: !!screenshareStream,
    shouldShowPlaceholder,
    cameraShape,
    cameraStreamId: cameraStream?.id,
    screenshareStreamId: screenshareStream?.id,
  };
  console.log('[VideoStreams] Render check:', JSON.stringify(renderInfo, null, 2));

  // Show Review mode when recording is complete (after all hooks)
  // PERF-FE-002: ReviewRecording is dynamically imported to avoid loading FFmpeg on initial page load
  if (recordingBlob) {
    return <ReviewRecording />;
  }

  if (shouldShowPlaceholder) {
    console.log('[VideoStreams] Showing placeholder');
    return <Placeholder />;
  }

  // Determine which stream to show in main view
  const mainStream = layout === 'cameraOnly' ? cameraStream : screenshareStream;

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* Change screen button (only show when screenshare is active and NOT recording) */}
      {screenshareStream && layout !== 'cameraOnly' && !isRecording && (
        <div className="absolute top-4 right-4 z-20">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleChangeScreen}
            disabled={isChangingScreen}
            className="shadow-lg"
          >
            <RefreshCw className={cn('size-4 mr-2', isChangingScreen && 'animate-spin')} />
            {isChangingScreen ? 'Selecting...' : 'Change screen'}
          </Button>
        </div>
      )}

      {/* Main video stream */}
      {mainStream ? (
        <video
          ref={layout === 'cameraOnly' ? setMainCameraRef : setScreenshareRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'w-full h-full',
            // Camera only: use object-contain to show full frame without cropping
            // Screen modes: use object-contain for screen share
            'object-contain'
          )}
          onResize={(event) => {
            if (layout !== 'cameraOnly' && event.currentTarget.videoWidth > 0) {
              setScreenshareSize({
                width: event.currentTarget.videoWidth,
                height: event.currentTarget.videoHeight,
              });
            }
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted/50">
          <p className="text-muted-foreground text-sm">
            {layout === 'screenOnly' ? 'Select screen to share' : 'No video stream'}
          </p>
        </div>
      )}

      {/* Picture-in-Picture camera overlay (only in screenAndCamera mode) */}
      {/* Hide overlay when entire screen is shared to avoid recursive PiP capture */}
      {(() => {
        const shouldShowCameraOverlay = !!(layout === 'screenAndCamera' && cameraStream && !isEntireScreenShared);
        const overlayInfo = {
          layout,
          hasCameraStream: !!cameraStream,
          isEntireScreenShared,
          shouldShowCameraOverlay,
          screenshareWidth,
          screenshareHeight,
          cameraStreamId: cameraStream?.id,
        };
        console.log('[VideoStreams] Camera overlay check:', JSON.stringify(overlayInfo, null, 2));

        return shouldShowCameraOverlay ? (
          <video
            ref={setCameraOverlayRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'absolute z-10 object-cover',
              cameraShape === 'circle' && 'rounded-full',
              cameraShape === 'square' && 'rounded-lg'
            )}
            style={{
              right: percentage(CAMERA_MARGIN_RIGHT / screenshareWidth),
              bottom: percentage(CAMERA_MARGIN_BOTTOM / screenshareHeight),
              width: percentage(CAMERA_WIDTH / screenshareWidth),
              aspectRatio: '1', // Maintain 1:1 aspect ratio for perfect circle/square
              borderRadius:
                cameraShape === 'circle'
                  ? '50%'
                  : [
                      percentage(CAMERA_BORDER_RADIUS / CAMERA_WIDTH),
                      percentage(CAMERA_BORDER_RADIUS / CAMERA_HEIGHT),
                    ].join('/'),
            }}
          />
        ) : null;
      })()}
    </div>
  );
}
