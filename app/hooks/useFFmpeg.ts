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
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
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

      // Write input file to FFmpeg's virtual file system
      await ffmpeg.writeFile('input.webm', await fetchFile(blob));

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
