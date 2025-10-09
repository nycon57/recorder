'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

export type RecordingLayout = 'screenAndCamera' | 'screenOnly' | 'cameraOnly';
export type CameraShape = 'circle' | 'square';

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
      window: Window | null;
    };
  }
}

interface RecordingContextType {
  // Streams
  cameraStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  screenshareStream: MediaStream | null;
  setCameraStream: (stream: MediaStream | null) => void;
  setMicrophoneStream: (stream: MediaStream | null) => void;
  setScreenshareStream: (stream: MediaStream | null) => void;
  requestMediaStreams: () => Promise<boolean>;

  // Layout
  layout: RecordingLayout;
  setLayout: (layout: RecordingLayout) => void;

  // Camera shape
  cameraShape: CameraShape;
  setCameraShape: (shape: CameraShape) => void;

  // Device settings
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  setCameraEnabled: (enabled: boolean) => void;
  setMicrophoneEnabled: (enabled: boolean) => void;

  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  recordingBlob: Blob | null;
  startRecording: () => Promise<void>;
  beginRecordingWithCountdown: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;

  // Picture-in-Picture
  pipWindow: Window | null;
  setPipWindow: (window: Window | null) => void;
  openPipWindow: () => Promise<void>;

  // Teleprompter
  showTeleprompter: boolean;
  setShowTeleprompter: (show: boolean) => void;

  // Countdown
  countdown: number | null;
  setCountdown: (count: number | null) => void;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export function RecordingProvider({ children }: { children: ReactNode }) {
  // Streams
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [screenshareStream, setScreenshareStream] = useState<MediaStream | null>(null);

  // Refs to track latest stream values (to avoid closure issues)
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const screenshareStreamRef = useRef<MediaStream | null>(null);

  // Sync refs with state
  cameraStreamRef.current = cameraStream;
  microphoneStreamRef.current = microphoneStream;
  screenshareStreamRef.current = screenshareStream;

  // Layout
  const [layout, setLayout] = useState<RecordingLayout>('screenAndCamera');

  // Camera shape
  const [cameraShape, setCameraShape] = useState<CameraShape>('circle');

  // Device settings
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Picture-in-Picture
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  // Teleprompter
  const [showTeleprompter, setShowTeleprompter] = useState(false);

  // Countdown
  const [countdown, setCountdown] = useState<number | null>(null);

  // Auto-request camera on mount if layout includes camera
  useEffect(() => {
    const requestInitialCamera = async () => {
      console.log('[RecordingContext] Auto-request camera check:', {
        layout,
        cameraEnabled,
        hasCameraStream: !!cameraStream,
      });

      if (layout !== 'screenOnly' && cameraEnabled && !cameraStream) {
        console.log('[RecordingContext] Requesting initial camera...');
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
          });
          console.log('[RecordingContext] Initial camera obtained:', camStream.id);
          setCameraStream(camStream);
        } catch (error) {
          console.error('[RecordingContext] Failed to get initial camera stream:', error);
        }
      }
    };

    requestInitialCamera();
  }, []); // Only run on mount

  // Monitor layout changes and request camera if needed (but NOT screenshare - that's user-initiated only)
  useEffect(() => {
    const layoutInfo = {
      layout,
      hasCameraStream: !!cameraStream,
      hasScreenshareStream: !!screenshareStream,
      cameraEnabled,
      cameraStreamId: cameraStream?.id,
      screenshareStreamId: screenshareStream?.id,
    };
    console.log('[RecordingContext] Layout changed:', JSON.stringify(layoutInfo, null, 2));

    const requestCameraForLayout = async () => {
      // Request camera if layout requires it and we don't have it
      const needsCamera = layout !== 'screenOnly' && cameraEnabled && !cameraStream;
      console.log('[RecordingContext] Check camera needs:', {
        needsCamera,
        condition1_notScreenOnly: layout !== 'screenOnly',
        condition2_cameraEnabled: cameraEnabled,
        condition3_noCameraStream: !cameraStream,
      });

      if (needsCamera) {
        console.log('[RecordingContext] Layout requires camera, requesting...');
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
          });
          console.log('[RecordingContext] Camera obtained after layout change:', camStream.id);
          setCameraStream(camStream);
        } catch (error) {
          console.error('[RecordingContext] Failed to get camera for layout:', error);
        }
      }

      // Note: We do NOT automatically request screenshare when layout changes
      // Screenshare is only requested when user explicitly:
      // 1. Clicks "Share screen" button (calls requestMediaStreams)
      // 2. Clicks Record button (calls startRecording -> requestMediaStreams if needed)
    };

    requestCameraForLayout();
  }, [layout]);

  const requestMediaStreams = async (): Promise<boolean> => {
    try {
      let micStream: MediaStream | null = null;
      let camStream: MediaStream | null = null;
      let screenStream: MediaStream | null = null;

      // Request microphone if enabled
      if (microphoneEnabled) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicrophoneStream(micStream);
      }

      // Request camera if needed
      if (layout !== 'screenOnly' && cameraEnabled) {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        setCameraStream(camStream);
      }

      // Request screen share if needed
      if (layout !== 'cameraOnly') {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: false,
        });
        setScreenshareStream(screenStream);
      }

      return true;
    } catch (error) {
      console.error('Failed to get media streams:', error);
      return false;
    }
  };

  const openPipWindow = async () => {
    if (!window.documentPictureInPicture) {
      console.error('Document Picture-in-Picture API not supported');
      return;
    }

    try {
      const pipWindowInstance = await window.documentPictureInPicture.requestWindow({
        width: 400,
        height: 200,
      });

      setPipWindow(pipWindowInstance);

      // Handle window close
      pipWindowInstance.addEventListener('pagehide', () => {
        setPipWindow(null);
        if (isRecording) {
          stopRecording();
        }
      });
    } catch (error) {
      console.error('Failed to open PiP window:', error);
    }
  };

  // This is called by the main record button - just opens PiP, doesn't start recording
  const startRecording = async () => {
    // If no streams available, request them first
    if (!cameraStreamRef.current && !screenshareStreamRef.current) {
      const success = await requestMediaStreams();
      if (!success) {
        console.error('Failed to obtain media streams');
        return;
      }
      // Note: State updates are async, but we need to wait for user to grant permissions
      // and streams to be created. Give a moment for state to update.
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if we got the required streams (use refs for latest values)
      if (!cameraStreamRef.current && !screenshareStreamRef.current) {
        console.error('Failed to obtain required streams');
        return;
      }
    }

    // Only open PiP for screen-based layouts (not cameraOnly)
    if (layout !== 'cameraOnly' && !pipWindow) {
      await openPipWindow();
    } else if (layout === 'cameraOnly') {
      // For camera-only mode, start recording immediately with countdown
      beginRecordingWithCountdown();
    }
  };

  // This is called from the PiP window or for camera-only mode
  const beginRecordingWithCountdown = () => {
    // Start countdown from 3
    setCountdown(3);

    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(countdownInterval);
        setCountdown(null);
        // Start recording after countdown finishes
        beginRecording();
      }
    }, 1000);
  };

  const beginRecording = () => {
    setIsRecording(true);

    // Import and use the composer dynamically
    // Use refs to get the latest stream values
    import('../services/composer').then(({ composeStreams }) => {
      const composedStream = composeStreams(
        layout === 'screenOnly' ? null : cameraStreamRef.current,
        microphoneStreamRef.current,
        layout === 'cameraOnly' ? null : screenshareStreamRef.current,
        cameraShape
      );

      const mediaRecorder = new MediaRecorder(composedStream, {
        mimeType: 'video/webm; codecs=vp9',
        videoBitsPerSecond: 8e6,
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        composedStream.getVideoTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: 'video/webm' });
        setRecordingBlob(blob);
        setIsRecording(false);
        setIsPaused(false);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    });
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
  };

  return (
    <RecordingContext.Provider
      value={{
        cameraStream,
        microphoneStream,
        screenshareStream,
        setCameraStream,
        setMicrophoneStream,
        setScreenshareStream,
        requestMediaStreams,
        layout,
        setLayout,
        cameraShape,
        setCameraShape,
        cameraEnabled,
        microphoneEnabled,
        setCameraEnabled,
        setMicrophoneEnabled,
        isRecording,
        isPaused,
        recordingBlob,
        startRecording,
        beginRecordingWithCountdown,
        stopRecording,
        pauseRecording,
        resumeRecording,
        pipWindow,
        setPipWindow,
        openPipWindow,
        showTeleprompter,
        setShowTeleprompter,
        countdown,
        setCountdown,
      }}
    >
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within RecordingProvider');
  }
  return context;
}
