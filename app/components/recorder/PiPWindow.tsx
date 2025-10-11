'use client';

import { useEffect, useState, useCallback } from 'react';
import { Circle, Square, Pause, Play } from 'lucide-react';
import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  CAMERA_WIDTH,
  CAMERA_HEIGHT,
  CAMERA_MARGIN_RIGHT,
  CAMERA_MARGIN_BOTTOM,
  CAMERA_BORDER_RADIUS,
} from '@/app/(dashboard)/record/services/composer';

export function PiPWindow() {
  const {
    pipWindow,
    setPipWindow,
    layout,
    cameraStream,
    screenshareStream,
    cameraShape,
    isRecording,
    isPaused,
    countdown,
    isEntireScreenShared,
    beginRecordingWithCountdown,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordingBlob,
  } = useRecording();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completedDuration, setCompletedDuration] = useState(0);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // Stopwatch timer
  useEffect(() => {
    if (!isRecording || isPaused) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Save completed duration and reset timer when recording stops
  useEffect(() => {
    if (!isRecording && elapsedTime > 0) {
      // Save the duration before resetting
      setCompletedDuration(elapsedTime);
      setElapsedTime(0);
    }
  }, [isRecording, elapsedTime]);

  // Reset completed duration when new recording starts
  useEffect(() => {
    if (isRecording) {
      setCompletedDuration(0);
    }
  }, [isRecording]);

  // Create composited preview (screenshare + camera overlay)
  // Skip compositing when entire screen is shared - just show camera
  useEffect(() => {
    console.log('[PiPWindow] Compositing effect check:', {
      hasPipWindow: !!pipWindow,
      hasScreenshareStream: !!screenshareStream,
      hasCameraStream: !!cameraStream,
      layout,
      isEntireScreenShared,
      screenshareStreamId: screenshareStream?.id,
      cameraStreamId: cameraStream?.id,
    });

    // Skip compositing if:
    // 1. No pipWindow or screenshare
    // 2. Screen-only mode
    // 3. Entire screen is shared (camera-only in PiP to avoid recursive capture)
    if (!pipWindow || !screenshareStream || layout === 'screenOnly' || isEntireScreenShared) {
      console.log('[PiPWindow] Compositing effect skipped - missing requirements or entire screen mode');
      return;
    }

    const pipDocument = pipWindow.document;

    let waitRafId: number | undefined;
    let renderAnimationId: number | undefined;
    let screenVideo: HTMLVideoElement | undefined;
    let cameraVideo: HTMLVideoElement | null = null;

    // Wait for canvas element to be created by the rendering effect
    const waitForCanvas = () => {
      const canvas = pipDocument.getElementById('preview-canvas') as HTMLCanvasElement;
      if (!canvas) {
        console.log('[PiPWindow] Canvas not found yet, waiting...');
        // Try again on next frame
        waitRafId = requestAnimationFrame(waitForCanvas);
        return;
      }

      console.log('[PiPWindow] Canvas found, starting compositing');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.log('[PiPWindow] Failed to get canvas context');
        return;
      }

      // Create video elements for the streams
      screenVideo = pipDocument.createElement('video');
      screenVideo.srcObject = screenshareStream;
      screenVideo.autoplay = true;
      screenVideo.muted = true;
      screenVideo.playsInline = true;
      // Append to document (hidden) to ensure playback works
      screenVideo.style.display = 'none';
      pipDocument.body.appendChild(screenVideo);

      cameraVideo = cameraStream ? pipDocument.createElement('video') : null;
      if (cameraVideo && cameraStream) {
        console.log('[PiPWindow] Creating camera video element with stream:', cameraStream.id);
        cameraVideo.srcObject = cameraStream;
        cameraVideo.autoplay = true;
        cameraVideo.muted = true;
        cameraVideo.playsInline = true;
        // Append to document (hidden) to ensure playback works
        cameraVideo.style.display = 'none';
        pipDocument.body.appendChild(cameraVideo);

        // Explicitly start playback
        cameraVideo.play().catch(err => {
          console.error('[PiPWindow] Failed to play camera video:', err);
        });
      } else {
        console.log('[PiPWindow] No camera video element created');
      }

      // Explicitly start screenshare playback
      screenVideo.play().catch(err => {
        console.error('[PiPWindow] Failed to play screen video:', err);
      });

      // Track which videos are ready
      let screenVideoReady = false;
      let cameraVideoReady = false;

      const checkAndStartRendering = () => {
        // If we have camera, wait for both. If no camera, just wait for screen
        const readyToRender = screenVideoReady && (!cameraVideo || cameraVideoReady);
        if (readyToRender && !renderAnimationId) {
          console.log('[PiPWindow] Both videos ready, starting render loop');
          renderAnimationId = requestAnimationFrame(render);
        }
      };

      let frameCount = 0;
      const render = () => {
        if (!screenVideo || !screenVideo.videoWidth || !screenVideo.videoHeight) {
          renderAnimationId = requestAnimationFrame(render);
          return;
        }

        frameCount++;
        // Log every 60 frames (about once per second at 60fps)
        const shouldLog = frameCount % 60 === 0;

        // Set canvas size to match screenshare
        canvas.width = screenVideo.videoWidth;
        canvas.height = screenVideo.videoHeight;

        // Draw screenshare as background
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

        // Draw camera overlay if available (always show in PiP, regardless of isEntireScreenShared)
        if (cameraVideo && layout === 'screenAndCamera') {
          const borderRadius = cameraShape === 'circle' ? CAMERA_WIDTH / 2 : CAMERA_BORDER_RADIUS;

          if (shouldLog) {
            console.log('[PiPWindow] Render frame:', {
              frameCount,
              hasCameraVideo: !!cameraVideo,
              cameraVideoWidth: cameraVideo.videoWidth,
              cameraVideoHeight: cameraVideo.videoHeight,
              cameraReadyState: cameraVideo.readyState,
              cameraPaused: cameraVideo.paused,
              cameraCurrentTime: cameraVideo.currentTime,
              layout,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
            });
          }

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(
            canvas.width - CAMERA_WIDTH - CAMERA_MARGIN_RIGHT,
            canvas.height - CAMERA_HEIGHT - CAMERA_MARGIN_BOTTOM,
            CAMERA_WIDTH,
            CAMERA_HEIGHT,
            borderRadius
          );
          ctx.clip();

          // Draw camera feed (centered and cropped to square)
          if (cameraVideo.videoWidth && cameraVideo.videoHeight) {
            ctx.drawImage(
              cameraVideo,
              (cameraVideo.videoWidth - cameraVideo.videoHeight) / 2,
              0,
              cameraVideo.videoHeight,
              cameraVideo.videoHeight,
              canvas.width - CAMERA_WIDTH - CAMERA_MARGIN_RIGHT,
              canvas.height - CAMERA_HEIGHT - CAMERA_MARGIN_BOTTOM,
              CAMERA_WIDTH,
              CAMERA_HEIGHT
            );
          } else if (shouldLog) {
            console.log('[PiPWindow] ⚠️ Camera video dimensions not ready');
          }

          ctx.restore();
        } else if (shouldLog) {
          console.log('[PiPWindow] Not drawing camera:', {
            hasCameraVideo: !!cameraVideo,
            layout,
          });
        }

        renderAnimationId = requestAnimationFrame(render);
      };

      // Wait for both videos to be ready before starting render loop
      screenVideo.addEventListener('loadedmetadata', () => {
        console.log('[PiPWindow] Screen video metadata loaded');
        screenVideoReady = true;
        checkAndStartRendering();
      });

      if (cameraVideo) {
        cameraVideo.addEventListener('loadedmetadata', () => {
          console.log('[PiPWindow] Camera video metadata loaded');
          cameraVideoReady = true;
          checkAndStartRendering();
        });
      }
    };

    // Start waiting for canvas
    waitForCanvas();

    return () => {
      if (waitRafId !== undefined) {
        cancelAnimationFrame(waitRafId);
      }
      if (renderAnimationId !== undefined) {
        cancelAnimationFrame(renderAnimationId);
      }
      if (screenVideo) {
        screenVideo.srcObject = null;
        screenVideo.remove();
      }
      if (cameraVideo) {
        cameraVideo.srcObject = null;
        cameraVideo.remove();
      }
    };
  }, [pipWindow, screenshareStream, cameraStream, layout, cameraShape, isEntireScreenShared]);

  // Initial PiP content setup (only when window/layout/streams change, NOT when recording state changes)
  useEffect(() => {
    if (!pipWindow) return;

    const pipDocument = pipWindow.document;

    console.log('[PiPWindow] Initial setup effect running');

    // Copy styles from parent document
    const styles = Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    // Set up the PiP document
    pipDocument.head.innerHTML = `
      <style>
        ${styles}
        body {
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, sans-serif;
          background: #000;
          display: flex;
          flex-direction: column;
          height: 100vh;
          box-sizing: border-box;
          position: relative;
        }
        .pip-video-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          position: relative;
        }
        .pip-camera {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .pip-preview-canvas {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .pip-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 16px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
        }
        .pip-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .pip-timer {
          font-size: 28px;
          font-weight: bold;
          font-variant-numeric: tabular-nums;
          color: white;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .pip-footer {
          padding: 16px;
          background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
        }
        .pip-controls {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    `;

    // Determine what to show in the preview area
    let previewContent = '';
    if (layout === 'screenOnly') {
      previewContent = '<div style="color: white; font-size: 18px;">Screen Only Mode</div>';
    } else if (layout === 'screenAndCamera' && screenshareStream && !isEntireScreenShared) {
      // Show composited preview (screenshare + camera overlay) - only when NOT entire screen
      previewContent = '<canvas id="preview-canvas" class="pip-preview-canvas"></canvas>';
    } else if (layout === 'cameraOnly' || (layout === 'screenAndCamera' && isEntireScreenShared)) {
      // Show raw camera feed for:
      // 1. Camera-only mode
      // 2. Screen+camera mode with entire screen shared (to avoid recursive capture)
      previewContent = '<video id="pip-camera" class="pip-camera" autoplay playsinline muted></video>';
    } else {
      // Fallback: waiting for streams
      previewContent = '<div style="color: white; font-size: 18px;">Waiting for streams...</div>';
    }

    pipDocument.body.innerHTML = `
      <div class="pip-video-container">
        ${previewContent}
        <div class="pip-overlay">
          <div class="pip-header">
            <div class="pip-timer">00:00</div>
            <div id="pip-status"></div>
          </div>
        </div>
      </div>
      <div class="pip-footer">
        <div class="pip-controls" id="pip-controls"></div>
      </div>
    `;

    // Set camera stream to video element for:
    // 1. Camera-only mode
    // 2. Screen+camera mode with entire screen shared (to avoid recursive capture)
    if (cameraStream && (layout === 'cameraOnly' || (layout === 'screenAndCamera' && isEntireScreenShared))) {
      const videoElement = pipDocument.getElementById('pip-camera') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = cameraStream;
      }
    }
  }, [pipWindow, layout, cameraStream, screenshareStream, isEntireScreenShared]);

  // Auto-close timer for completed state
  useEffect(() => {
    if (!pipWindow || !recordingBlob) return;

    console.log('[PiPWindow] Recording completed, starting auto-close timer');
    const timer = setTimeout(() => {
      console.log('[PiPWindow] Auto-closing PiP after completion');
      setPipWindow(null);
      pipWindow.close();
    }, 15000); // 15 seconds

    return () => clearTimeout(timer);
  }, [pipWindow, recordingBlob, setPipWindow]);

  // Update controls and status (without recreating HTML)
  useEffect(() => {
    if (!pipWindow) return;

    const pipDocument = pipWindow.document;

    console.log('[PiPWindow] Updating controls/status');

    // Stable references to prevent dependency array size changes
    const handleRecord = () => {
      beginRecordingWithCountdown();
    };

    const handlePause = () => {
      if (isPaused) {
        resumeRecording();
      } else {
        pauseRecording();
      }
    };

    const handleStop = () => {
      stopRecording();
    };

    const handleViewRecording = () => {
      // Focus main window (where RecordingModal is already open)
      window.focus();
      // Close PiP
      setPipWindow(null);
      pipWindow.close();
    };

    const handleClosePip = () => {
      setPipWindow(null);
      pipWindow.close();
    };

    // Update status badge
    const statusElement = pipDocument.getElementById('pip-status');
    if (statusElement) {
      if (recordingBlob) {
        // Completed state
        statusElement.innerHTML = `
          <span style="
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            background: #10b981;
            color: white;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
          ">
            <span style="margin-right: 6px;">✓</span>
            Complete
          </span>
        `;
      } else if (countdown !== null) {
        statusElement.innerHTML = `
          <span style="
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            background: #3b82f6;
            color: white;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
          ">Starting...</span>
        `;
      } else if (isPaused) {
        statusElement.innerHTML = `
          <span style="
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            background: #fbbf24;
            color: #78350f;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
          ">Paused</span>
        `;
      } else if (isRecording) {
        statusElement.innerHTML = `
          <span style="
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            background: #ef4444;
            color: white;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
          ">
            <span style="
              width: 8px;
              height: 8px;
              background: white;
              border-radius: 50%;
              margin-right: 6px;
              animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            "></span>
            Recording
          </span>
        `;
      } else {
        statusElement.innerHTML = `
          <span style="
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            background: #6b7280;
            color: white;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
          ">Ready</span>
        `;
      }
    }

    // Render controls
    const controlsElement = pipDocument.getElementById('pip-controls');
    if (controlsElement) {
      if (recordingBlob) {
        // Show completed state with View Recording and Close buttons
        controlsElement.innerHTML = `
          <button id="view-recording-btn" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          ">
            View Recording
          </button>
          <button id="close-pip-btn" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">
            Close
          </button>
        `;

        // Attach event listeners
        const viewBtn = pipDocument.getElementById('view-recording-btn');
        const closeBtn = pipDocument.getElementById('close-pip-btn');

        if (viewBtn) viewBtn.addEventListener('click', handleViewRecording);
        if (closeBtn) closeBtn.addEventListener('click', handleClosePip);
      } else if (isRecording) {
        // Show pause/stop controls when recording
        controlsElement.innerHTML = `
          <button id="pause-btn" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">
            ${isPaused ? '<span>▶</span> Resume' : '<span>⏸</span> Pause'}
          </button>
          <button id="stop-btn" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">
            <span>⏹</span> Stop
          </button>
        `;

        // Attach event listeners
        const pauseBtn = pipDocument.getElementById('pause-btn');
        const stopBtn = pipDocument.getElementById('stop-btn');

        if (pauseBtn) pauseBtn.addEventListener('click', handlePause);
        if (stopBtn) stopBtn.addEventListener('click', handleStop);
      } else {
        // Show record button when not recording
        controlsElement.innerHTML = `
          <button id="record-btn" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            ${countdown !== null ? 'opacity: 0.5; cursor: not-allowed;' : ''}
          " ${countdown !== null ? 'disabled' : ''}>
            <span style="
              width: 12px;
              height: 12px;
              background: white;
              border-radius: 50%;
            "></span>
            ${countdown !== null ? 'Starting...' : 'Start Recording'}
          </button>
        `;

        // Attach event listener
        const recordBtn = pipDocument.getElementById('record-btn');
        if (recordBtn && countdown === null) {
          recordBtn.addEventListener('click', handleRecord);
        }
      }
    }
  }, [pipWindow, isRecording, isPaused, countdown, recordingBlob, beginRecordingWithCountdown, pauseRecording, resumeRecording, stopRecording, setPipWindow]);

  // Update timer separately to avoid recreating the DOM
  useEffect(() => {
    if (!pipWindow) return;

    const pipDocument = pipWindow.document;
    const timerElement = pipDocument.querySelector('.pip-timer');
    if (timerElement) {
      if (recordingBlob && completedDuration > 0) {
        // Show completed duration
        timerElement.textContent = formatTime(completedDuration);
      } else if (countdown !== null) {
        // Show countdown
        timerElement.textContent = String(countdown);
      } else {
        // Show elapsed time
        timerElement.textContent = formatTime(elapsedTime);
      }
    }
  }, [pipWindow, elapsedTime, countdown, recordingBlob, completedDuration, formatTime]);

  // This component doesn't render anything in the main window
  return null;
}
