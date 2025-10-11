'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

interface RecordingModalProps {
  isOpen: boolean;
  recordingBlob: Blob | null;
  onClose: () => void;
}

export function RecordingModal({ isOpen, recordingBlob, onClose }: RecordingModalProps) {
  const router = useRouter();
  const { orgId, userId } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isConvertingToMP4, setIsConvertingToMP4] = useState(false);
  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null);

  // Initialize FFMPEG
  useEffect(() => {
    const loadFFmpeg = async () => {
      const ffmpegInstance = new FFmpeg();
      await ffmpegInstance.load({
        coreURL: await toBlobURL(
          'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
          'text/javascript'
        ),
        wasmURL: await toBlobURL(
          'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
          'application/wasm'
        ),
      });
      setFFmpeg(ffmpegInstance);
    };

    if (isOpen) {
      loadFFmpeg();
    }
  }, [isOpen]);

  const handleDownloadWebm = () => {
    if (!recordingBlob) return;

    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMP4 = async () => {
    if (!recordingBlob || !ffmpeg) return;

    setIsConvertingToMP4(true);
    try {
      // Write input file
      await ffmpeg.writeFile('input.webm', await fetchFile(recordingBlob));

      // Convert to MP4
      await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', 'output.mp4']);

      // Read output
      const data = await ffmpeg.readFile('output.mp4');
      const mp4Blob = new Blob([data], { type: 'video/mp4' });

      // Download
      const url = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error converting to MP4:', error);
      alert('Failed to convert to MP4. Please try downloading as WEBM.');
    } finally {
      setIsConvertingToMP4(false);
    }
  };

  const handleUpload = async () => {
    if (!recordingBlob || !orgId || !userId) return;

    setIsUploading(true);
    try {
      // 1. Create recording entry
      const createResponse = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || `Recording ${new Date().toLocaleDateString()}`,
          description,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create recording');
      }

      const { data } = await createResponse.json();
      const { recording, uploadUrl } = data;

      // 2. Upload blob to Supabase Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: recordingBlob,
        headers: {
          'Content-Type': 'video/webm',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload video');
      }

      // 3. Finalize upload (triggers transcription)
      await fetch(`/api/recordings/${recording.id}/finalize`, {
        method: 'POST',
      });

      // Success - redirect to dashboard
      router.push('/dashboard');
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload recording. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen || !recordingBlob) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Recording Complete!</h2>

          {/* Video preview */}
          <video
            src={URL.createObjectURL(recordingBlob)}
            controls
            className="w-full rounded-lg mb-4"
          />

          {/* Title and description */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Recording"
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload & Process'}
            </button>
            <button
              onClick={handleDownloadWebm}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
            >
              Download WEBM
            </button>
            <button
              onClick={handleDownloadMP4}
              disabled={isConvertingToMP4 || !ffmpeg}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50"
            >
              {isConvertingToMP4 ? 'Converting...' : 'Download MP4'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-input rounded-md hover:bg-accent"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
