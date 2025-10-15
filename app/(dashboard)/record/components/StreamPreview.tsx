'use client';

import { useEffect, useRef } from 'react';

import { useRecording } from '../contexts/RecordingContext';

export function StreamPreview() {
  const {
    cameraStream,
    screenshareStream,
    layout,
    cameraEnabled,
  } = useRecording();

  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Set up camera preview
  useEffect(() => {
    if (cameraVideoRef.current && cameraStream && cameraEnabled) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraEnabled]);

  // Set up screen preview
  useEffect(() => {
    if (screenVideoRef.current && screenshareStream) {
      screenVideoRef.current.srcObject = screenshareStream;
    }
  }, [screenshareStream]);

  const showCamera = layout !== 'screenOnly' && cameraEnabled;
  const showScreen = layout !== 'cameraOnly';

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Screen preview */}
      {showScreen && screenshareStream && (
        <video
          ref={screenVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
      )}

      {/* Camera preview - only show in camera-only mode or if no screen */}
      {(!showScreen || layout === 'cameraOnly') && showCamera && cameraStream && (
        <video
          ref={cameraVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      )}

      {/* Camera overlay (when screen + camera) */}
      {showScreen && showCamera && cameraStream && screenshareStream && (
        <div className="absolute bottom-10 right-10">
          <video
            ref={cameraVideoRef}
            autoPlay
            playsInline
            muted
            className="w-60 h-60 object-cover rounded-full border-4 border-white shadow-lg"
          />
        </div>
      )}

      {/* Placeholder when no stream */}
      {!cameraStream && !screenshareStream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <svg
              className="mx-auto h-12 w-12 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">Select your devices to start</p>
          </div>
        </div>
      )}
    </div>
  );
}
