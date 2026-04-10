/**
 * TRIB-48: Tab recorder using chrome.tabCapture API
 *
 * Wraps MediaRecorder around a tab capture stream.
 * Caller gets a simple {start, stop, isRecording} interface.
 */

const MIME_TYPE = 'video/webm;codecs=vp9,opus';
const TIMESLICE_MS = 1000;

export interface TabRecorder {
  start(): Promise<void>;
  stop(): Promise<Blob>;
  isRecording(): boolean;
}

export function createTabRecorder(): TabRecorder {
  let mediaRecorder: MediaRecorder | null = null;
  let captureStream: MediaStream | null = null;
  let chunks: BlobPart[] = [];

  function isRecording(): boolean {
    return mediaRecorder !== null && mediaRecorder.state === 'recording';
  }

  async function start(): Promise<void> {
    if (isRecording()) {
      throw new Error('Already recording');
    }

    chunks = [];

    // Request tab audio + video capture
    captureStream = await new Promise<MediaStream>((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true, video: true }, (stream) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!stream) {
          reject(new Error('tabCapture returned no stream'));
          return;
        }
        resolve(stream);
      });
    });

    // Use supported mime type (fall back if vp9+opus not available)
    const mimeType = MediaRecorder.isTypeSupported(MIME_TYPE)
      ? MIME_TYPE
      : 'video/webm';

    mediaRecorder = new MediaRecorder(captureStream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    await new Promise<void>((resolve, reject) => {
      if (!mediaRecorder) return reject(new Error('No MediaRecorder'));
      mediaRecorder.onerror = (e) => reject(e);
      mediaRecorder.onstart = () => resolve();
      mediaRecorder.start(TIMESLICE_MS);
    });
  }

  async function stop(): Promise<Blob> {
    if (!mediaRecorder || !captureStream) {
      throw new Error('Not recording');
    }

    const recorder = mediaRecorder;
    const stream = captureStream;

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        resolve(new Blob(chunks, { type: mimeType }));
        chunks = [];
      };
      recorder.onerror = (e) => reject(e);

      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
        chunks = [];
      }
    });

    // Stop all tracks to release the capture
    stream.getTracks().forEach((track) => track.stop());

    mediaRecorder = null;
    captureStream = null;

    return blob;
  }

  return { start, stop, isRecording };
}
