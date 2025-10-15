'use client';

import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';

// Dynamically import AudioPlayer to avoid SSR issues
const H5AudioPlayer = dynamic(
  () => import('react-h5-audio-player'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
);

interface Word {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

interface Transcript {
  id: string;
  text: string;
  words_json?: Word[] | null;
  language?: string | null;
  confidence?: number | null;
}

interface AudioPlayerProps {
  audioUrl: string;
  downloadUrl?: string | null;
  transcript?: Transcript | null;
  title?: string | null;
  duration?: number | null;
}

export default function AudioPlayer({
  audioUrl,
  downloadUrl,
  transcript,
  title,
  duration
}: AudioPlayerProps) {
  const [currentTime, setCurrentTime] = React.useState(0);
  const [highlightedWordIndex, setHighlightedWordIndex] = React.useState<number>(-1);

  // Sync transcript highlighting with audio playback
  React.useEffect(() => {
    if (!transcript?.words_json || !Array.isArray(transcript.words_json)) {
      return;
    }

    const words = transcript.words_json;
    const currentWordIndex = words.findIndex(
      (word) => currentTime >= word.start && currentTime <= word.end
    );

    setHighlightedWordIndex(currentWordIndex);
  }, [currentTime, transcript]);

  const handleListen = (e: any) => {
    if (e.target) {
      setCurrentTime(e.target.currentTime);
    }
  };

  const handleWordClick = (word: Word) => {
    // Find the audio element in the DOM
    const audioElements = document.querySelectorAll('audio');
    if (audioElements.length > 0) {
      const audioElement = audioElements[0];
      audioElement.currentTime = word.start;
      audioElement.play();
    }
  };

  const handleDownload = async () => {
    const urlToDownload = downloadUrl || audioUrl;
    if (!urlToDownload) {
      toast.error('Audio URL not available');
      return;
    }

    try {
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // Determine extension from URL or default to mp3
      let extension = 'mp3';
      if (urlToDownload.includes('.wav')) extension = 'wav';
      else if (urlToDownload.includes('.m4a')) extension = 'm4a';
      else if (urlToDownload.includes('.ogg')) extension = 'ogg';

      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = `${title || 'audio'}-${Date.now()}.${extension}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Download started (${extension.toUpperCase()})`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed');
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || seconds === 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Audio Player Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-6 space-y-4">
          {/* Header Info */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                Audio
              </Badge>
              {duration && (
                <span className="text-sm text-muted-foreground">
                  {formatDuration(duration)}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={!audioUrl}
            >
              <Download className="size-4" />
              Download
            </Button>
          </div>

          {/* Audio Player */}
          <div className="audio-player-wrapper">
            <H5AudioPlayer
              src={audioUrl}
              autoPlay={false}
              showJumpControls
              customAdditionalControls={[]}
              customVolumeControls={[]}
              layout="horizontal-reverse"
              onListen={handleListen}
              className="rounded-lg"
              style={{
                backgroundColor: 'transparent',
                boxShadow: 'none',
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Transcript with Word Highlighting */}
      {transcript?.words_json && Array.isArray(transcript.words_json) && transcript.words_json.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4">Interactive Transcript</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="leading-relaxed whitespace-pre-wrap">
                {transcript.words_json.map((word, index) => (
                  <React.Fragment key={index}>
                    <span
                      onClick={() => handleWordClick(word)}
                      className={`
                        cursor-pointer transition-colors duration-150
                        ${
                          index === highlightedWordIndex
                            ? 'bg-green-400 dark:bg-green-600 font-semibold text-foreground'
                            : 'hover:bg-muted'
                        }
                      `}
                      title={`${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s`}
                    >
                      {word.word}
                    </span>
                    {' '}
                  </React.Fragment>
                ))}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Click on any word to jump to that point in the audio
            </p>
          </CardContent>
        </Card>
      )}

      <style jsx global>{`
        .rhap_container {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }

        .rhap_main {
          flex-direction: column !important;
        }

        .rhap_progress-section {
          margin: 1rem 0 !important;
        }

        .rhap_progress-bar {
          background-color: hsl(var(--muted)) !important;
          height: 6px !important;
          border-radius: 3px !important;
        }

        .rhap_progress-filled,
        .rhap_progress-indicator {
          background-color: hsl(var(--primary)) !important;
        }

        .rhap_progress-indicator {
          width: 16px !important;
          height: 16px !important;
          top: -5px !important;
        }

        .rhap_time {
          color: hsl(var(--muted-foreground)) !important;
          font-size: 0.875rem !important;
        }

        .rhap_button-clear {
          color: hsl(var(--foreground)) !important;
        }

        .rhap_button-clear:hover {
          color: hsl(var(--primary)) !important;
        }

        .rhap_volume-bar {
          background-color: hsl(var(--muted)) !important;
        }

        .rhap_volume-indicator {
          background-color: hsl(var(--primary)) !important;
        }
      `}</style>
    </div>
  );
}
