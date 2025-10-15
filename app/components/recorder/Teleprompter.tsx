'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Slider } from '@/app/components/ui/slider';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';

interface TeleprompterProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SPEED = 1;
const MIN_SPEED = 0.1;
const MAX_SPEED = 5;

export function Teleprompter({ isOpen, onClose }: TeleprompterProps) {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [showInput, setShowInput] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  // Auto-scroll logic
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) return;

    const scroll = () => {
      if (!scrollContainerRef.current) return;

      const container = scrollContainerRef.current;
      const maxScroll = container.scrollHeight - container.clientHeight;

      if (scrollPosition >= maxScroll) {
        setIsPlaying(false);
        return;
      }

      const newPosition = scrollPosition + speed;
      setScrollPosition(newPosition);
      container.scrollTop = newPosition;

      animationFrameRef.current = requestAnimationFrame(scroll);
    };

    animationFrameRef.current = requestAnimationFrame(scroll);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, speed, scrollPosition]);

  const handleTogglePlay = () => {
    if (showInput) {
      setShowInput(false);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setScrollPosition(0);
    setSpeed(DEFAULT_SPEED);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handleSeek = (direction: 'up' | 'down') => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const seekAmount = container.clientHeight * 0.1;
    const newPosition = direction === 'down'
      ? Math.min(scrollPosition + seekAmount, container.scrollHeight - container.clientHeight)
      : Math.max(scrollPosition - seekAmount, 0);

    setScrollPosition(newPosition);
    container.scrollTop = newPosition;
  };

  const handleClose = () => {
    setIsPlaying(false);
    setShowInput(true);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl h-[80vh] p-0 gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <DialogTitle className="text-lg font-semibold">Teleprompter</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            aria-label="Close teleprompter"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {showInput ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your script here..."
              className="h-full resize-none border-0 rounded-none text-lg p-6 focus-visible:ring-0"
              aria-label="Teleprompter script input"
            />
          ) : (
            <div
              ref={scrollContainerRef}
              className="h-full overflow-y-auto bg-black text-white px-12 py-24"
              style={{ scrollBehavior: 'smooth' }}
            >
              <div className="text-3xl leading-relaxed whitespace-pre-wrap">
                {text || 'Your script will appear here...'}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t bg-card">
          <div className="flex flex-col gap-4">
            {/* Speed control */}
            <div className="flex items-center gap-4">
              <Label htmlFor="speed-slider" className="min-w-16">
                Speed: {speed.toFixed(1)}x
              </Label>
              <Slider
                id="speed-slider"
                value={[speed]}
                onValueChange={(values) => setSpeed(values[0])}
                min={MIN_SPEED}
                max={MAX_SPEED}
                step={0.1}
                className="flex-1"
                aria-label="Scroll speed"
              />
            </div>

            <Separator />

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSeek('up')}
                disabled={showInput}
                aria-label="Scroll up"
              >
                <ChevronUp className="size-4" />
              </Button>

              <Button
                size="sm"
                onClick={handleTogglePlay}
                disabled={!text.trim()}
                className="min-w-24"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <>
                    <Pause className="size-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    {showInput ? 'Start' : 'Resume'}
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSeek('down')}
                disabled={showInput}
                aria-label="Scroll down"
              >
                <ChevronDown className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                aria-label="Reset teleprompter"
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
