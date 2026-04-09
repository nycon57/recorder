'use client';

import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  AudioPlayerProvider,
  AudioPlayerButton,
  AudioPlayerProgress,
  AudioPlayerTime,
  AudioPlayerDuration,
  AudioPlayerSpeed,
  useAudioPlayer,
} from '@/app/components/ui/audio-player';
import { Waveform } from '@/app/components/ui/waveform';

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

// Component that loads audio and uses player context
function AudioPlayerContent({
  audioUrl,
  transcript,
}: {
  audioUrl: string;
  transcript?: Transcript | null;
}) {
  const player = useAudioPlayer();
  const [highlightedWordIndex, setHighlightedWordIndex] = React.useState<number>(-1);

  // Load audio on mount
  React.useEffect(() => {
    player.setActiveItem({
      id: 'audio',
      src: audioUrl,
    });
  }, [audioUrl, player]);

  // Track current time for transcript highlighting
  React.useEffect(() => {
    if (!player.ref.current) return;

    const interval = setInterval(() => {
      if (player.ref.current && transcript?.words_json && Array.isArray(transcript.words_json)) {
        const currentTime = player.ref.current.currentTime;
        const words = transcript.words_json;
        const currentWordIndex = words.findIndex(
          (word) => currentTime >= word.start && currentTime <= word.end
        );
        setHighlightedWordIndex(currentWordIndex);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player.ref, transcript]);

  const handleWordClick = (word: Word) => {
    player.seek(word.start);
    if (!player.isPlaying) {
      player.play();
    }
  };

  return (
    <>
      {/* Player Controls */}
      <div className="flex items-center gap-4">
        <AudioPlayerButton size="lg" />
        <div className="flex-1 space-y-2">
          <AudioPlayerProgress />
          <div className="flex items-center justify-between text-xs">
            <AudioPlayerTime />
            <AudioPlayerDuration />
          </div>
        </div>
        <AudioPlayerSpeed />
      </div>

      {/* Waveform Visualization */}
      <div className="mt-4">
        <Waveform
          height={64}
          barWidth={2}
          barGap={1}
          barRadius={1}
          className="rounded-lg bg-muted/20 border border-border"
        />
      </div>

      {/* Interactive Transcript */}
      {transcript?.words_json && Array.isArray(transcript.words_json) && transcript.words_json.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold mb-3">Interactive Transcript</h3>
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
                          ? 'bg-primary text-primary-foreground font-semibold rounded px-1'
                          : 'hover:bg-muted rounded px-1'
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
          <p className="text-xs text-muted-foreground mt-3">
            Click on any word to jump to that point in the audio
          </p>
        </div>
      )}
    </>
  );
}

// Inner component that has access to audio player context
function AudioPlayerWithRef({
  audioUrl,
  downloadUrl,
  transcript,
  title,
  duration,
  forwardedRef
}: AudioPlayerProps & { forwardedRef: React.ForwardedRef<HTMLAudioElement | null> }) {
  const player = useAudioPlayer();

  // Expose the audio element via the forwarded ref
  React.useImperativeHandle(forwardedRef, () => {
    return player.ref.current!;
  }, [player.ref]);

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

            {/* Audio Player with Waveform and Transcript */}
            <AudioPlayerContent audioUrl={audioUrl} transcript={transcript} />
          </CardContent>
        </Card>
      </div>
  );
}

const AudioPlayer = React.forwardRef<HTMLAudioElement | null, AudioPlayerProps>((props, ref) => {
  return (
    <AudioPlayerProvider>
      <AudioPlayerWithRef {...props} forwardedRef={ref} />
    </AudioPlayerProvider>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
