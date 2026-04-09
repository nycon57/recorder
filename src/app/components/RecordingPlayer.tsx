'use client';

import * as React from 'react';
import { useRef, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  VideoPlayer,
  VideoPlayerContent,
  VideoPlayerControlBar,
  VideoPlayerPlayButton,
  VideoPlayerSeekBackwardButton,
  VideoPlayerSeekForwardButton,
  VideoPlayerMuteButton,
  VideoPlayerTimeDisplay,
  VideoPlayerTimeRange,
  VideoPlayerVolumeRange,
} from '@/app/components/kibo-ui/video-player';
import { AudioScrubber } from '@/app/components/ui/waveform';

interface RecordingPlayerProps {
  videoUrl: string;
  initialTime?: number;
  onDurationChange?: (duration: number) => void;
}

const RecordingPlayer = React.forwardRef<HTMLVideoElement, RecordingPlayerProps>(({ videoUrl, initialTime, onDurationChange }, ref) => {
  const internalRef = useRef<HTMLVideoElement>(null);
  const searchParams = useSearchParams();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Combine refs
  useEffect(() => {
    const node = internalRef.current;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }

    // Cleanup: clear the forwarded ref on unmount
    return () => {
      if (typeof ref === 'function') {
        ref(null);
      } else if (ref && ref.current === node) {
        ref.current = null;
      }
    };
  }, [ref]);

  // Track playback progress for waveform sync
  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
    };
  }, []);

  // Handle video loading, duration extraction, and timestamp
  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      // Extract and communicate duration to parent
      if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
        onDurationChange?.(video.duration);
      }
    };

    const handleLoadedData = () => {
      // Check for 't' query parameter (e.g., ?t=120 for 2 minutes)
      const timeParam = searchParams?.get('t');
      const startTime = timeParam ? parseInt(timeParam, 10) : initialTime;

      if (startTime && !isNaN(startTime) && startTime > 0) {
        video.currentTime = startTime;
        // Auto-play when jumping to timestamp
        video.play().catch((err) => {
          // Ignore autoplay errors (browser policy may block)
          console.debug('Autoplay prevented:', err);
        });
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [searchParams, initialTime, onDurationChange]);

  const handleSeek = (time: number) => {
    const video = internalRef.current;
    if (video) {
      video.currentTime = time;
    }
  };

  return (
    <div className="space-y-3">
      <VideoPlayer className="w-full rounded-lg overflow-hidden border border-border">
        <VideoPlayerContent
          ref={internalRef}
          slot="media"
          src={videoUrl}
          crossOrigin="anonymous"
          preload="metadata"
          className="w-full aspect-video"
        />
        <VideoPlayerControlBar className="bg-card border-t border-border">
          <VideoPlayerPlayButton />
          <VideoPlayerSeekBackwardButton />
          <VideoPlayerSeekForwardButton />
          <VideoPlayerTimeDisplay showDuration />
          <VideoPlayerTimeRange />
          <VideoPlayerVolumeRange />
          <VideoPlayerMuteButton />
        </VideoPlayerControlBar>
      </VideoPlayer>

      {/* Audio Waveform Scrubber */}
      {duration > 0 && (
        <div className="px-2">
          <AudioScrubber
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            height={64}
            barWidth={2}
            barGap={1}
            barRadius={1}
            className="rounded-lg bg-muted/20 border border-border"
          />
        </div>
      )}
    </div>
  );
});

RecordingPlayer.displayName = 'RecordingPlayer';

export default RecordingPlayer;
