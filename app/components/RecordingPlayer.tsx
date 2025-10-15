'use client';

import { useRef, useEffect } from 'react';
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

interface RecordingPlayerProps {
  videoUrl: string;
  initialTime?: number;
  onDurationChange?: (duration: number) => void;
}

export default function RecordingPlayer({ videoUrl, initialTime, onDurationChange }: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const searchParams = useSearchParams();

  // Handle video loading, duration extraction, and timestamp
  useEffect(() => {
    const video = videoRef.current;
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

  return (
    <VideoPlayer className="w-full rounded-lg overflow-hidden border border-border">
      <VideoPlayerContent
        ref={videoRef}
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
  );
}
