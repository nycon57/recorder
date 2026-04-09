'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import * as motion from 'motion/react-client';
import {
  Mic,
  FileText,
  Search,
  Copy,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Globe,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';

/**
 * TranscriptionDemo - Matches the real TranscriptPanel UI
 *
 * Bespoke component for the /features/transcription page.
 * Mirrors the actual product interface with:
 * - Card with header (FileText icon, title, language badge)
 * - Search bar with copy/download buttons
 * - ScrollArea with clickable timestamped words
 * - Metadata footer (provider, confidence)
 */

interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

// Mock transcript data
const mockTranscript = {
  id: 'demo-transcript',
  language: 'en',
  confidence: 0.96,
  provider: 'Whisper',
  text: `Welcome to this product demonstration. Today we're going to walk through the key features of our screen recording platform. First, let me show you how easy it is to capture your screen. Just click the record button and select what you want to share. You can choose your entire screen, a specific window, or even just a browser tab. Once you're recording, all your clicks, keystrokes, and navigation are tracked automatically. This makes it perfect for creating tutorials, documentation, or training materials. The AI will transcribe everything you say in real-time with high accuracy. It even handles multiple speakers and technical terminology. When you're done, hit stop and your recording is instantly processed. Within minutes, you'll have a searchable transcript and AI-generated documentation ready to share with your team.`,
  words: [] as Word[],
};

// Generate words with timestamps from the text
const generateWords = (text: string): Word[] => {
  const words = text.split(/\s+/);
  let currentTime = 0;
  return words.map((word) => {
    const duration = 0.3 + Math.random() * 0.2; // 0.3-0.5s per word
    const start = currentTime;
    currentTime += duration;
    return {
      word,
      start,
      end: currentTime,
      confidence: 0.85 + Math.random() * 0.15,
    };
  });
};

mockTranscript.words = generateWords(mockTranscript.text);

export function TranscriptionDemo() {
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndices, setHighlightedIndices] = useState<number[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const words = mockTranscript.words;

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setHighlightedIndices([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matches: number[] = [];

    words.forEach((word, index) => {
      if (word.word.toLowerCase().includes(query)) {
        matches.push(index);
      }
    });

    setHighlightedIndices(matches);
  }, [searchQuery, words]);

  // Auto-play simulation
  useEffect(() => {
    const autoPlayTimer = setTimeout(() => {
      setIsPlaying(true);
      startTimeRef.current = Date.now();
    }, 2000);

    return () => clearTimeout(autoPlayTimer);
  }, []);

  // Playback animation
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now() - currentTime * 1000;
      }

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const loopDuration = words[words.length - 1]?.end || 60;

      // Loop playback
      const loopedTime = elapsed % loopDuration;
      setCurrentTime(loopedTime);

      // Find active word
      const activeIdx = words.findIndex(
        (w) => loopedTime >= w.start && loopedTime <= w.end
      );
      if (activeIdx !== activeWordIndex) {
        setActiveWordIndex(activeIdx);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, words, activeWordIndex, currentTime]);

  const togglePlayback = () => {
    if (isPlaying) {
      startTimeRef.current = null;
    }
    setIsPlaying(!isPlaying);
  };

  const handleWordClick = (wordData: Word) => {
    setCurrentTime(wordData.start);
    startTimeRef.current = Date.now() - wordData.start * 1000;
    setIsPlaying(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2
            w-[800px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_60%)]
            blur-[100px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="text-center mb-12"
          >
            <div
              className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full
                bg-accent/10 border border-accent/30"
            >
              <Mic className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">AI Transcription</span>
            </div>
            <h3 className="font-outfit text-2xl sm:text-3xl font-light mb-2">
              Watch words{' '}
              <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                appear
              </span>
            </h3>
            <p className="text-muted-foreground">
              95%+ accuracy with automatic speaker detection
            </p>
          </motion.div>

          {/* Transcript Interface - Matches TranscriptPanel.tsx */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.2 }}
          >
            {/* Mini Player */}
            <div
              className={cn(
                'mb-4 p-4 rounded-xl',
                'bg-card/80 border border-accent/20',
                'shadow-[0_0_40px_rgba(0,223,130,0.1)]'
              )}
            >
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={togglePlayback}
                  className="h-10 w-10 rounded-full"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </Button>

                {/* Progress bar */}
                <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                  <motion.div
                    className="h-full bg-accent"
                    style={{
                      width: `${(currentTime / (words[words.length - 1]?.end || 60)) * 100}%`,
                    }}
                  />
                </div>

                <span className="text-sm font-mono text-muted-foreground min-w-[80px] text-right">
                  {formatTime(currentTime)} / {formatTime(words[words.length - 1]?.end || 0)}
                </span>
              </div>
            </div>

            {/* Transcript Card - Exact match to TranscriptPanel */}
            <Card
              className={cn(
                'overflow-hidden',
                'border-accent/20',
                'shadow-[0_0_80px_rgba(0,223,130,0.15)]'
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base">Transcript</CardTitle>
                    <Badge variant="outline" className="uppercase">
                      {mockTranscript.language}
                    </Badge>
                    {highlightedIndices.length > 0 && (
                      <Badge variant="secondary">
                        {highlightedIndices.length} match
                        {highlightedIndices.length !== 1 ? 'es' : ''}
                      </Badge>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4">
                  {/* Search Bar */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search transcript..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-9"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSearch}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      title="Copy transcript"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      title="Download as TXT"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" title="Download as VTT subtitles">
                      VTT
                    </Button>
                  </div>

                  {/* Transcript Content */}
                  <ScrollArea className="h-[400px] rounded-md border p-4" ref={scrollAreaRef}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {words.map((word, index) => {
                          const isSearchMatch =
                            searchQuery &&
                            word.word.toLowerCase().includes(searchQuery.toLowerCase());
                          const isActiveWord = index === activeWordIndex;

                          return (
                            <Fragment key={index}>
                              <span
                                onClick={() => handleWordClick(word)}
                                className={cn(
                                  'cursor-pointer transition-all duration-150 rounded px-0.5',
                                  isSearchMatch &&
                                    'bg-yellow-300 dark:bg-yellow-700 font-semibold text-foreground',
                                  isActiveWord &&
                                    !isSearchMatch &&
                                    'bg-accent/30 text-accent font-medium',
                                  !isSearchMatch && !isActiveWord && 'hover:bg-muted'
                                )}
                                title={`${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s`}
                              >
                                {word.word}
                              </span>{' '}
                            </Fragment>
                          );
                        })}
                      </p>
                    </div>
                  </ScrollArea>

                  {/* Helper Text */}
                  <p className="text-xs text-muted-foreground">
                    Click on any word to jump to that point in the recording
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      Provider: {mockTranscript.provider}
                    </span>
                    <span>
                      Confidence: {(mockTranscript.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            50+ languages · Speaker detection · Export to TXT, VTT, SRT
          </motion.p>
        </div>
      </div>
    </section>
  );
}
