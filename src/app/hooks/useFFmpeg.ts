import { useState, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export function useFFmpeg() {
  const [ffmpeg] = useState(() => new FFmpeg());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string>('');

  // Load FFmpeg on mount
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            'text/javascript',
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            'application/wasm',
          ),
        });
        console.log('[FFmpeg] Loaded successfully');
        setIsLoaded(true);
      } catch (err) {
        console.error('[FFmpeg] Failed to load:', err);
        setError('Failed to load video converter');
      }
    };

    loadFFmpeg();
  }, [ffmpeg]);

  const convertToMP4 = async (blob: Blob): Promise<Blob | null> => {
    if (!isLoaded) {
      setError('Video converter not ready');
      return null;
    }

    setIsConverting(true);
    setError('');

    try {
      console.log('[FFmpeg] Converting WebM to MP4...');

      const data = await fetchFile(blob)
        .then((inputFile) => ffmpeg.writeFile('input.webm', inputFile))
        .then(() =>
          ffmpeg.exec([
            '-i',
            'input.webm',
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-crf',
            '22',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            'output.mp4',
          ]),
        )
        .then(() => ffmpeg.readFile('output.mp4'));
      const mp4Blob = new Blob([data as BlobPart], { type: 'video/mp4' });

      console.log('[FFmpeg] MP4 conversion successful');
      return mp4Blob;
    } catch (err) {
      console.error('[FFmpeg] Conversion failed:', err);
      setError('Failed to convert video');
      return null;
    } finally {
      setIsConverting(false);
    }
  };

  return {
    ffmpeg,
    isLoaded,
    isConverting,
    error,
    convertToMP4,
  };
}
