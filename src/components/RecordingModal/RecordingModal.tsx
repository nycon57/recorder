import { useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type RecordingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  recordingBlob: Blob | null;
};

export const RecordingModal = ({
  isOpen,
  onClose,
  recordingBlob,
}: RecordingModalProps) => {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef(new FFmpeg());

  if (!isOpen || !recordingBlob) return null;

  const downloadWebm = () => {
    const url = URL.createObjectURL(recordingBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recording.webm';
    link.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const convertToMp4 = async () => {
    setIsConverting(true);
    const ffmpeg = ffmpegRef.current;

    // Load ffmpeg
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg log:', message);
      });
      ffmpeg.on('progress', ({ progress }) => {
        console.log('FFmpeg progress:', progress);
        setProgress(Math.round(progress * 100));
      });

      console.log('Loading FFmpeg...');
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
      console.log('FFmpeg loaded');

      console.log('Writing input file...');
      await ffmpeg.writeFile('input.webm', await fetchFile(recordingBlob));
      console.log('Input file written');

      console.log('Starting conversion...');
      await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', 'output.mp4']);
      console.log('Conversion complete');

      console.log('Reading output file...');
      const data = await ffmpeg.readFile('output.mp4');
      console.log('Output file read');

      // Download the converted file
      const url = URL.createObjectURL(
        new Blob([data instanceof Uint8Array ? data : new Uint8Array()], {
          type: 'video/mp4',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'recording.mp4';
      link.click();
      URL.revokeObjectURL(url);

      setIsConverting(false);
      onClose();
    } catch (error) {
      console.error(
        'Error converting video:',
        error instanceof Error ? error.message : error,
      );
      setIsConverting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Recording Complete</h2>
        {isConverting ? (
          <div>
            <p>Converting to MP4... {progress}%</p>
            <div
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#eee',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#007bff',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}
          >
            <button
              onClick={downloadWebm}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              Download (WEBM)
            </button>
            <button
              onClick={convertToMp4}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Convert to MP4
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
