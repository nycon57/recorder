export const CAMERA_WIDTH = 240;
export const CAMERA_HEIGHT = 240;
export const CAMERA_BORDER_RADIUS = 8;
export const CAMERA_MARGIN_RIGHT = 40;
export const CAMERA_MARGIN_BOTTOM = 40;

export type CameraShape = 'circle' | 'square';

const getCameraShapeRadius = (shape: CameraShape) => {
  return shape === 'circle' ? CAMERA_WIDTH / 2 : CAMERA_BORDER_RADIUS;
};

/**
 * Compose multiple media streams into a single recording stream
 *
 * Uses MediaStreamTrackProcessor and MediaStreamTrackGenerator to:
 * 1. Capture screenshare as background
 * 2. Overlay camera feed in bottom-right corner
 * 3. Apply circular or square mask to camera
 * 4. Mix audio from microphone
 */
export const composeStreams = (
  cameraStream: MediaStream | null,
  microphoneStream: MediaStream | null,
  screenshareStream: MediaStream | null,
  cameraShape: CameraShape = 'circle'
): MediaStream => {
  const cameraTrack = cameraStream?.getVideoTracks()[0];
  const microphoneTrack = microphoneStream?.getAudioTracks()[0];
  const screenshareTrack = screenshareStream?.getVideoTracks()[0];

  // Create processors for video tracks
  const screenshareProcessor =
    screenshareTrack &&
    new MediaStreamTrackProcessor({
      track: screenshareTrack,
    });

  const cameraProcessor =
    cameraTrack &&
    new MediaStreamTrackProcessor({
      track: cameraTrack,
    });

  const recordingGenerator = new MediaStreamTrackGenerator({ kind: 'video' });

  // Compose screen + camera
  if (screenshareProcessor && cameraProcessor) {
    const screenshareReader = screenshareProcessor.readable.getReader();

    const canvas = new OffscreenCanvas(0, 0);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas API not supported');
    }

    let latestScreenshareFrame: VideoFrame | undefined;
    let readingScreenshare = false;

    const transformer = new TransformStream({
      async transform(cameraFrame: VideoFrame, controller) {
        if (recordingGenerator.readyState === 'ended') {
          cameraFrame.close();
          latestScreenshareFrame?.close();
          controller.terminate();
          return;
        }

        // Get latest screenshare frame
        if (latestScreenshareFrame) {
          if (!readingScreenshare) {
            readingScreenshare = true;

            // Non-blocking read for next frame
            screenshareReader.read().then(({ value: screenshareFrame }) => {
              readingScreenshare = false;
              latestScreenshareFrame?.close();
              if (recordingGenerator.readyState === 'ended') {
                screenshareFrame?.close();
              } else {
                latestScreenshareFrame = screenshareFrame;
              }
            });
          }
        } else {
          // Wait for first frame to initialize canvas
          const { value: screenshareFrame } = await screenshareReader.read();
          latestScreenshareFrame = screenshareFrame;
        }

        // Draw screenshare as background
        if (latestScreenshareFrame) {
          canvas.width = latestScreenshareFrame.displayWidth;
          canvas.height = latestScreenshareFrame.displayHeight;
          ctx.drawImage(latestScreenshareFrame, 0, 0);
        }

        // Clip camera to shape (circle or rounded square)
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(
          canvas.width - CAMERA_WIDTH - CAMERA_MARGIN_RIGHT,
          canvas.height - CAMERA_HEIGHT - CAMERA_MARGIN_BOTTOM,
          CAMERA_WIDTH,
          CAMERA_HEIGHT,
          getCameraShapeRadius(cameraShape)
        );
        ctx.clip();

        // Draw camera feed (centered and cropped to square)
        ctx.drawImage(
          cameraFrame,
          (cameraFrame.displayWidth - cameraFrame.displayHeight) / 2,
          0,
          cameraFrame.displayHeight,
          cameraFrame.displayHeight,
          canvas.width - CAMERA_WIDTH - CAMERA_MARGIN_RIGHT,
          canvas.height - CAMERA_HEIGHT - CAMERA_MARGIN_BOTTOM,
          CAMERA_WIDTH,
          CAMERA_HEIGHT
        );

        ctx.restore();

        // Create new frame from canvas
        const newFrame = new VideoFrame(canvas, {
          timestamp: cameraFrame.timestamp,
        });
        cameraFrame.close();
        controller.enqueue(newFrame);
      },
    });

    cameraProcessor.readable
      .pipeThrough(transformer)
      .pipeTo(recordingGenerator.writable);
  } else if (cameraProcessor) {
    // Camera only
    cameraProcessor.readable.pipeTo(recordingGenerator.writable);
  } else if (screenshareProcessor) {
    // Screen only
    screenshareProcessor.readable.pipeTo(recordingGenerator.writable);
  }

  // Create recording stream with video + audio
  const recordingStream = new MediaStream([recordingGenerator]);
  if (microphoneTrack) {
    recordingStream.addTrack(microphoneTrack);
  }

  return recordingStream;
};
