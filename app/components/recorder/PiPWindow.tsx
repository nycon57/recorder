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
    beginRecordingWithCountdown,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useRecording();
  const [elapsedTime, setElapsedTime] = useState(0);

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

  // Reset timer when recording stops
  useEffect(() => {
    if (!isRecording) {
      setElapsedTime(0);
    }
  }, [isRecording]);

  // Create composited preview (screenshare + camera overlay)
  useEffect(() => {
    if (!pipWindow || !screenshareStream || layout === 'screenOnly') return;

    const pipDocument = pipWindow.document;
    const canvas = pipDocument.getElementById('preview-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create video elements for the streams
    const screenVideo = pipDocument.createElement('video');
    screenVideo.srcObject = screenshareStream;
    screenVideo.autoplay = true;
    screenVideo.muted = true;
    screenVideo.playsInline = true;

    const cameraVideo = cameraStream ? pipDocument.createElement('video') : null;
    if (cameraVideo && cameraStream) {
      cameraVideo.srcObject = cameraStream;
      cameraVideo.autoplay = true;
      cameraVideo.muted = true;
      cameraVideo.playsInline = true;
    }

    let animationId: number;

    const render = () => {
      if (!screenVideo.videoWidth || !screenVideo.videoHeight) {
        animationId = requestAnimationFrame(render);
        return;
      }

      // Set canvas size to match screenshare
      canvas.width = screenVideo.videoWidth;
      canvas.height = screenVideo.videoHeight;

      // Draw screenshare as background
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

      // Draw camera overlay if available
      if (cameraVideo && layout === 'screenAndCamera') {
        const borderRadius = cameraShape === 'circle' ? CAMERA_WIDTH / 2 : CAMERA_BORDER_RADIUS;

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
        }

        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    // Start rendering once video is ready
    screenVideo.addEventListener('loadedmetadata', () => {
      animationId = requestAnimationFrame(render);
    });

    return () => {
      cancelAnimationFrame(animationId);
      screenVideo.srcObject = null;
      if (cameraVideo) cameraVideo.srcObject = null;
    };
  }, [pipWindow, screenshareStream, cameraStream, layout, cameraShape]);

  // Render PiP content into the window
  useEffect(() => {
    if (!pipWindow) return;

    const pipDocument = pipWindow.document;

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
        .pip-tip {
          padding: 12px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          color: #3b82f6;
          font-size: 12px;
          text-align: center;
          margin: 0 16px 8px;
        }
      </style>
    `;

    // Determine what to show in the preview area
    let previewContent = '';
    if (layout === 'screenOnly') {
      previewContent = '<div style="color: white; font-size: 18px;">Screen Only Mode</div>';
    } else if (layout === 'screenAndCamera' && screenshareStream) {
      // Show composited preview (screenshare + camera overlay)
      previewContent = '<canvas id="preview-canvas" class="pip-preview-canvas"></canvas>';
    } else if (layout === 'cameraOnly') {
      // Show raw camera feed for camera-only mode
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
            <div class="pip-timer">${countdown !== null ? countdown : formatTime(elapsedTime)}</div>
            <div id="pip-status"></div>
          </div>
        </div>
      </div>
      <div class="pip-footer">
        ${!isRecording ? '<div class="pip-tip">💡 Tip: Share a specific tab or window (not entire screen) to avoid recording this control window</div>' : ''}
        <div class="pip-controls" id="pip-controls"></div>
      </div>
    `;

    // Set camera stream to video element (only for camera-only mode)
    if (layout === 'cameraOnly' && cameraStream) {
      const videoElement = pipDocument.getElementById('pip-camera') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = cameraStream;
      }
    }

    // Update timer
    const timerElement = pipDocument.querySelector('.pip-timer');
    if (timerElement) {
      timerElement.textContent = countdown !== null ? String(countdown) : formatTime(elapsedTime);
    }

    // Update status badge
    const statusElement = pipDocument.getElementById('pip-status');
    if (statusElement) {
      if (countdown !== null) {
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
      if (isRecording) {
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

    // Add pulse animation
    const styleSheet = pipDocument.createElement('style');
    styleSheet.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    pipDocument.head.appendChild(styleSheet);
  }, [pipWindow, layout, cameraStream, screenshareStream, isRecording, isPaused, elapsedTime, countdown, formatTime, beginRecordingWithCountdown, pauseRecording, resumeRecording, stopRecording]);

  // This component doesn't render anything in the main window
  return null;
}
