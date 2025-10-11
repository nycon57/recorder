'use client';

import { useRef, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface RecordingPlayerProps {
  videoUrl: string;
  initialTime?: number;
}

export default function RecordingPlayer({ videoUrl, initialTime }: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const searchParams = useSearchParams();

  // Set up video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      // Update duration when metadata is loaded
      if (isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const handleDurationChange = () => {
      // Update duration when it changes (more reliable for some video formats)
      if (isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const handleLoadedData = () => {
      // Ensure duration is set when data is loaded
      if (isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }

      // Check for 't' query parameter (e.g., ?t=120 for 2 minutes)
      const timeParam = searchParams?.get('t');
      const startTime = timeParam ? parseInt(timeParam, 10) : initialTime;

      if (startTime && !isNaN(startTime) && startTime > 0) {
        video.currentTime = startTime;
        video.play(); // Auto-play when jumping to timestamp
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    // Add all event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [searchParams, initialTime]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Video */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onClick={togglePlayPause}
          crossOrigin="anonymous"
          preload="metadata"
        />
      </div>

      {/* Controls */}
      <div className="p-3">
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlayPause}
            className="p-1.5 hover:bg-accent rounded-full transition flex-shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg
                className="w-5 h-5 text-foreground"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-foreground"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-muted rounded-lg appearance-none cursor-pointer"
              aria-label="Volume"
            />
          </div>

          {/* Current Time */}
          <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[40px]">
            {formatTime(currentTime)}
          </span>

          {/* Progress Bar */}
          <input
            type="range"
            min="0"
            max={isFinite(duration) && duration > 0 ? duration : 100}
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer"
            aria-label="Seek"
            step="0.1"
          />

          {/* Duration */}
          <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[40px]">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
