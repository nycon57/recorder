'use client';

import { useEffect, useState, useMemo } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';

interface RecordingModalProps {
  onUploadComplete?: (recordingId: string) => void;
}

export function RecordingModal({ onUploadComplete }: RecordingModalProps) {
  const { recordingBlob, clearRecording } = useRecording();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [ffmpeg] = useState(() => new FFmpeg());

  // Load FFmpeg on component mount
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        console.log('[FFmpeg] Loaded successfully');
      } catch (err) {
        console.error('[FFmpeg] Failed to load:', err);
      }
    };

    loadFFmpeg();
  }, [ffmpeg]);

  // Show modal when recording blob is available
  useEffect(() => {
    if (recordingBlob) {
      setIsOpen(true);
      const url = URL.createObjectURL(recordingBlob);
      setVideoUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [recordingBlob]);

  const handleClose = () => {
    setIsOpen(false);
    setIsUploading(false);
    setIsConverting(false);
    setUploadProgress(0);
    setError('');
    // Clear the recording blob so PiP doesn't show completed state
    clearRecording();
  };

  const handleDownload = async () => {
    if (!recordingBlob) return;

    setIsConverting(true);
    setError('');

    try {
      // Convert WebM to MP4 using FFmpeg
      console.log('[Download] Converting WebM to MP4...');

      // Write input file to FFmpeg's virtual file system
      await ffmpeg.writeFile('input.webm', await fetchFile(recordingBlob));

      // Run FFmpeg conversion
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '128k',
        'output.mp4'
      ]);

      // Read the output file
      const data = await ffmpeg.readFile('output.mp4');
      const mp4Blob = new Blob([data], { type: 'video/mp4' });

      // Download the MP4 file
      const url = URL.createObjectURL(mp4Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recording-${Date.now()}.mp4`;
      link.click();
      URL.revokeObjectURL(url);

      console.log('[Download] MP4 conversion successful');
      handleClose();
    } catch (err) {
      console.error('[Download] Conversion failed:', err);
      setError('Failed to convert video. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleUpload = async () => {
    if (!recordingBlob) return;

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Step 1: Create recording metadata and get upload URL
      setUploadProgress(10);
      const createResponse = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Recording ${new Date().toLocaleString()}`,
          duration: 0, // Will be updated after processing
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create recording');
      }

      const { data } = await createResponse.json();
      const { recording, uploadUrl } = data;
      const recordingId = recording.id;
      setUploadProgress(20);

      // Step 2: Upload blob to storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: recordingBlob,
        headers: {
          'Content-Type': 'video/webm',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload recording');
      }

      setUploadProgress(70);

      // Step 3: Finalize upload and trigger processing
      const finalizeResponse = await fetch(`/api/recordings/${recordingId}/finalize`, {
        method: 'POST',
      });

      if (!finalizeResponse.ok) {
        throw new Error('Failed to finalize recording');
      }

      setUploadProgress(100);

      // Success - call completion handler
      onUploadComplete?.(recordingId);
      handleClose();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recording Complete</DialogTitle>
          <DialogDescription>
            Your recording is ready. Download it or upload for processing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video preview */}
          {videoUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video
                src={videoUrl}
                controls
                className="h-full w-full"
                aria-label="Recording preview"
              />
            </div>
          )}

          {/* Converting progress */}
          {isConverting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-muted-foreground">Converting to MP4...</span>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={isUploading || isConverting}
          >
            {isConverting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Download MP4
              </>
            )}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || isConverting}
          >
            {isUploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Upload & Process
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
