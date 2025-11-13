'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { toast } from 'sonner';

import { RECORDING_LIMITS, formatDuration, RECORDING_LIMITS_LABELS } from '@/lib/config/recording';

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
  changeScreenshare: () => Promise<boolean>;
  isEntireScreenShared: boolean;

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
  recordingDuration: number; // Duration in milliseconds
  startRecording: () => Promise<void>;
  beginRecordingWithCountdown: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;

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
  const [recordingDuration, setRecordingDuration] = useState(0); // Duration in ms
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasWarned25Min = useRef(false);
  const isStoppingRef = useRef(false);

  // Picture-in-Picture
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  // Teleprompter
  const [showTeleprompter, setShowTeleprompter] = useState(false);

  // Countdown
  const [countdown, setCountdown] = useState<number | null>(null);

  // Track if entire screen is being shared (to hide baked-in camera)
  const [isEntireScreenShared, setIsEntireScreenShared] = useState(false);

  // Reset entire screen state when screenshare is removed
  useEffect(() => {
    if (!screenshareStream) {
      setIsEntireScreenShared(false);
    }
  }, [screenshareStream]);

  // Auto-request camera and microphone on mount
  useEffect(() => {
    const requestInitialMedia = async () => {
      console.log('[RecordingContext] Auto-request media check:', {
        layout,
        cameraEnabled,
        microphoneEnabled,
        hasCameraStream: !!cameraStream,
        hasMicrophoneStream: !!microphoneStream,
      });

      // Request microphone if enabled and not already present
      if (microphoneEnabled && !microphoneStream) {
        console.log('[RecordingContext] Requesting initial microphone...');
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          console.log('[RecordingContext] Initial microphone obtained:', micStream.id);
          setMicrophoneStream(micStream);
        } catch (error) {
          console.error('[RecordingContext] Failed to get initial microphone stream:', error);
        }
      }

      // Request camera if layout includes it and not already present
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

    requestInitialMedia();
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

        // Check if entire screen is being shared
        const videoTrack = screenStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        const isEntireScreen = settings.displaySurface === 'monitor';
        console.log('[RecordingContext] Screen share displaySurface:', settings.displaySurface);
        setIsEntireScreenShared(isEntireScreen);
      }

      return true;
    } catch (error) {
      // Handle user cancellation gracefully (NotAllowedError is expected when user cancels)
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.log('[RecordingContext] Screen sharing cancelled by user');
        return false;
      }

      // Log unexpected errors
      console.error('[RecordingContext] Failed to get media streams:', error);
      return false;
    }
  };

  const changeScreenshare = async (): Promise<boolean> => {
    try {
      console.log('[RecordingContext] Changing screenshare selection...');

      // Stop current screenshare if it exists
      if (screenshareStreamRef.current) {
        screenshareStreamRef.current.getTracks().forEach(track => track.stop());
        setScreenshareStream(null);
      }

      // Request new screen share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: false,
      });

      console.log('[RecordingContext] New screenshare obtained:', screenStream.id);
      setScreenshareStream(screenStream);

      // Check if entire screen is being shared
      const videoTrack = screenStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const isEntireScreen = settings.displaySurface === 'monitor';
      console.log('[RecordingContext] Screen share displaySurface:', settings.displaySurface);
      setIsEntireScreenShared(isEntireScreen);

      return true;
    } catch (error) {
      // Handle user cancellation gracefully (NotAllowedError is expected when user cancels)
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.log('[RecordingContext] Screen sharing selection cancelled by user');
        return false;
      }

      // Log unexpected errors
      console.error('[RecordingContext] Failed to change screenshare:', error);
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
        width: 500,
        height: 450,
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
    // Ensure microphone is requested if enabled and not present
    if (microphoneEnabled && !microphoneStreamRef.current) {
      console.log('[RecordingContext] Requesting microphone before recording...');
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicrophoneStream(micStream);
        // Give state time to update
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('[RecordingContext] Failed to get microphone:', error);
        toast.error('Microphone access required', {
          description: 'Please allow microphone access to record audio.',
        });
        return;
      }
    }

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

    // Determine whether to open PiP or start recording directly
    const shouldSkipPip =
      layout === 'cameraOnly' ||
      (layout === 'screenOnly' && isEntireScreenShared);

    if (shouldSkipPip) {
      // Start recording directly (no PiP) for:
      // 1. Camera-only mode
      // 2. Screen-only mode with entire screen shared (PiP would be disruptive)
      beginRecordingWithCountdown();
    } else if (layout !== 'cameraOnly' && !pipWindow) {
      // Open PiP for screen-based layouts that need it:
      // 1. Screen+camera mode (always needs PiP for camera display)
      // 2. Screen-only mode with tab/window share (not entire screen)
      await openPipWindow();
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

  const clearRecording = () => {
    setRecordingBlob(null);
  };

  const beginRecording = () => {
    // Clear any previous recording blob
    setRecordingBlob(null);
    setRecordingDuration(0);
    setIsRecording(true);
    hasWarned25Min.current = false;

    // Start recording timer
    recordingStartTimeRef.current = Date.now();
    recordingTimerRef.current = setInterval(() => {
      if (!recordingStartTimeRef.current) return;

      const elapsed = Date.now() - recordingStartTimeRef.current;
      setRecordingDuration(elapsed);

      // Warn at 25 minutes
      if (elapsed >= RECORDING_LIMITS.WARN_DURATION_MS && !hasWarned25Min.current) {
        hasWarned25Min.current = true;
        toast.warning(`Recording limit approaching: ${RECORDING_LIMITS_LABELS.WARN_DURATION} elapsed`, {
          description: `Maximum recording time is ${RECORDING_LIMITS_LABELS.MAX_DURATION}`,
        });
      }

      // Auto-stop at 30 minutes
      if (elapsed >= RECORDING_LIMITS.MAX_DURATION_MS) {
        toast.error(`Recording automatically stopped: ${RECORDING_LIMITS_LABELS.MAX_DURATION} limit reached`);
        stopRecording();
      }
    }, 1000);

    // Import and use the composer dynamically
    // Use refs to get the latest stream values
    import('../services/composer').then(({ composeStreams }) => {
      const composedStream = composeStreams(
        layout === 'screenOnly' ? null : cameraStreamRef.current,
        microphoneStreamRef.current,
        layout === 'cameraOnly' ? null : screenshareStreamRef.current,
        cameraShape,
        isEntireScreenShared // Skip camera overlay when entire screen is shared
      );

      // Validate composed stream
      const videoTracks = composedStream.getVideoTracks();
      const audioTracks = composedStream.getAudioTracks();
      console.log('[RecordingContext] Composed stream validation:', {
        hasVideoTracks: videoTracks.length > 0,
        hasAudioTracks: audioTracks.length > 0,
        videoTrackStates: videoTracks.map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })),
        audioTrackStates: audioTracks.map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })),
      });

      if (videoTracks.length === 0) {
        console.error('[RecordingContext] ❌ Composed stream has no video tracks!');
        toast.error('Recording failed to start', {
          description: 'No video source available. Please try again.',
        });

        // CRITICAL: Clear recording timer to prevent duration incrementing after abort
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = undefined;
        }
        recordingStartTimeRef.current = null;
        setRecordingDuration(0);
        setIsRecording(false);
        return;
      }

      const mediaRecorder = new MediaRecorder(composedStream, {
        mimeType: 'video/webm; codecs=vp9',
        videoBitsPerSecond: 8e6,
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('[RecordingContext] ondataavailable fired, data size:', event.data.size);
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log('[RecordingContext] Chunk added, total chunks:', chunks.length, 'total size:', chunks.reduce((sum, chunk) => sum + chunk.size, 0));
        } else {
          console.warn('[RecordingContext] ondataavailable fired but data is empty');
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[RecordingContext] MediaRecorder error:', event);
        toast.error('Recording error occurred', {
          description: 'An error occurred during recording. Please try again.',
        });
        stopRecording();
      };

      mediaRecorder.onstop = () => {
        console.log('[RecordingContext] MediaRecorder onstop callback triggered');

        // Safely stop composed stream tracks
        // IMPORTANT: Only stop tracks that are NOT from the original source streams
        // (camera, microphone, screenshare) so they can be reused for future recordings
        try {
          composedStream.getTracks().forEach((track) => {
            if (track.readyState !== 'ended') {
              // Check if this track is a generated track (from MediaStreamTrackGenerator)
              // or a source track (from camera/microphone)
              const isSourceTrack =
                microphoneStreamRef.current?.getTracks().some(t => t.id === track.id) ||
                cameraStreamRef.current?.getTracks().some(t => t.id === track.id) ||
                screenshareStreamRef.current?.getTracks().some(t => t.id === track.id);

              if (!isSourceTrack) {
                console.log('[RecordingContext] Stopping generated track:', track.kind, track.id);
                track.stop();
              } else {
                console.log('[RecordingContext] Preserving source track for reuse:', track.kind, track.id);
              }
            }
          });
        } catch (error) {
          console.warn('[RecordingContext] Error stopping tracks:', error);
        }

        const blob = new Blob(chunks, { type: 'video/webm' });
        console.log('[RecordingContext] Recording blob created, size:', blob.size);

        // Check file size limit
        if (blob.size > RECORDING_LIMITS.MAX_FILE_SIZE_BYTES) {
          toast.error('Recording exceeds maximum file size', {
            description: `Maximum size is ${RECORDING_LIMITS_LABELS.MAX_FILE_SIZE}`,
          });
        }

        setRecordingBlob(blob);
        setIsRecording(false);
        setIsPaused(false);

        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        recordingStartTimeRef.current = null;

        // Clear refs
        mediaRecorderRef.current = null;
        isStoppingRef.current = false;

        console.log('[RecordingContext] Recording stopped successfully');
      };

      console.log('[RecordingContext] Starting MediaRecorder...');
      mediaRecorder.start();
      console.log('[RecordingContext] MediaRecorder started, state:', mediaRecorder.state);
      mediaRecorderRef.current = mediaRecorder;
    });
  };

  const stopRecording = () => {
    console.log('[RecordingContext] stopRecording called, mediaRecorder exists:', !!mediaRecorderRef.current);
    console.log('[RecordingContext] mediaRecorder state:', mediaRecorderRef.current?.state);
    console.log('[RecordingContext] isStoppingRef:', isStoppingRef.current);

    // Prevent recursive calls
    if (isStoppingRef.current) {
      console.log('[RecordingContext] Already stopping, ignoring duplicate call');
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      isStoppingRef.current = true;
      console.log('[RecordingContext] Stopping mediaRecorder...');

      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error('[RecordingContext] Error stopping mediaRecorder:', error);
        isStoppingRef.current = false;
      }
    } else {
      console.warn('[RecordingContext] Cannot stop - mediaRecorder is null or already inactive');
    }
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);

    // Pause timer by clearing interval
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);

    // Resume timer - adjust start time to account for pause duration
    if (recordingStartTimeRef.current) {
      const pausedDuration = recordingDuration;
      recordingStartTimeRef.current = Date.now() - pausedDuration;

      recordingTimerRef.current = setInterval(() => {
        if (!recordingStartTimeRef.current) return;

        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingDuration(elapsed);

        // Warn at 25 minutes
        if (elapsed >= RECORDING_LIMITS.WARN_DURATION_MS && !hasWarned25Min.current) {
          hasWarned25Min.current = true;
          toast.warning(`Recording limit approaching: ${RECORDING_LIMITS_LABELS.WARN_DURATION} elapsed`, {
            description: `Maximum recording time is ${RECORDING_LIMITS_LABELS.MAX_DURATION}`,
          });
        }

        // Auto-stop at 30 minutes
        if (elapsed >= RECORDING_LIMITS.MAX_DURATION_MS) {
          toast.error(`Recording automatically stopped: ${RECORDING_LIMITS_LABELS.MAX_DURATION} limit reached`);
          stopRecording();
        }
      }, 1000);
    }
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
        changeScreenshare,
        isEntireScreenShared,
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
        recordingDuration,
        startRecording,
        beginRecordingWithCountdown,
        stopRecording,
        pauseRecording,
        resumeRecording,
        clearRecording,
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
