'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as motion from 'motion/react-client';
import {
  Video,
  Monitor,
  Circle,
  Play,
  Upload,
  Check,
  Mic,
  Camera,
  Maximize2,
  Layout,
  Square,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';

/**
 * RecordingDemo - Matches the real RecorderInterface UI
 *
 * Bespoke component for the /features/recording page.
 * Mirrors the actual product interface with:
 * - RecordingSteps indicator (setup → ready → recording → review)
 * - VideoStreams preview area
 * - LiveWaveform visualization
 * - Device controls footer
 */

type RecordingStep = 'setup' | 'ready' | 'recording' | 'review';

const steps = [
  { id: 'setup', label: 'Setup', icon: Monitor, description: 'Configure your recording' },
  { id: 'ready', label: 'Ready', icon: Circle, description: 'Screen shared' },
  { id: 'recording', label: 'Recording', icon: Play, description: 'Capturing content' },
  { id: 'review', label: 'Review', icon: Upload, description: 'Save or discard' },
] as const;

const stepOrder: Record<RecordingStep, number> = {
  setup: 0,
  ready: 1,
  recording: 2,
  review: 3,
};

// Generate mock waveform data
const generateWaveform = () => Array.from({ length: 64 }, () => Math.random() * 0.8 + 0.2);

export function RecordingDemo() {
  const [currentStep, setCurrentStep] = useState<RecordingStep>('setup');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [waveformData, setWaveformData] = useState(generateWaveform());
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Auto-progress through steps for demo
  useEffect(() => {
    const stepProgression = [
      { step: 'ready' as RecordingStep, delay: 2000 },
      { step: 'recording' as RecordingStep, delay: 4000 },
      { step: 'review' as RecordingStep, delay: 12000 },
      { step: 'setup' as RecordingStep, delay: 16000 },
    ];

    const timers = stepProgression.map(({ step, delay }) =>
      setTimeout(() => {
        setCurrentStep(step);
        if (step === 'recording') {
          setIsRecording(true);
          startTimeRef.current = Date.now();
        } else if (step === 'review') {
          setIsRecording(false);
        } else if (step === 'setup') {
          setElapsedTime(0);
        }
      }, delay)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  // Timer animation
  useEffect(() => {
    if (!isRecording || !startTimeRef.current) return;

    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current!) / 1000;
      setElapsedTime(elapsed);
      setWaveformData(generateWaveform());
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording]);

  const currentIndex = stepOrder[currentStep];

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
        <div className="max-w-5xl mx-auto">
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
              <Video className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Screen Recording</span>
            </div>
            <h3 className="font-outfit text-2xl sm:text-3xl font-light mb-2">
              Capture your{' '}
              <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                expertise
              </span>
            </h3>
            <p className="text-muted-foreground">
              One click to start capturing your workflow
            </p>
          </motion.div>

          {/* Recorder Interface */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.2 }}
            className={cn(
              'relative rounded-3xl overflow-hidden',
              'bg-gradient-to-b from-card/80 to-card/60',
              'backdrop-blur-xl',
              'border border-accent/20',
              'shadow-[0_0_80px_rgba(0,223,130,0.15)]'
            )}
          >
            {/* Step Indicator - Matches RecordingSteps.tsx */}
            <div className="border-b border-border/30 bg-card/50">
              <div className="max-w-5xl mx-auto px-4 py-3">
                {/* Mobile: Compact indicator */}
                <div className="flex sm:hidden items-center justify-center gap-2 py-2">
                  <span className="text-sm font-medium text-foreground">
                    Step {currentIndex + 1} of {steps.length}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">
                    {steps[currentIndex].label}
                  </span>
                </div>

                {/* Desktop: Full step indicator */}
                <nav aria-label="Recording progress" className="hidden sm:block">
                  <ol className="flex items-center justify-center gap-2">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      const isCompleted = index < currentIndex;
                      const isCurrent = index === currentIndex;
                      const isPending = index > currentIndex;

                      return (
                        <li key={step.id} className="flex items-center">
                          <div className="flex items-center">
                            <div
                              className={cn(
                                'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200',
                                isCompleted && 'bg-accent border-accent text-accent-foreground',
                                isCurrent && 'border-accent bg-accent/10 text-accent',
                                isPending && 'border-muted-foreground/30 text-muted-foreground/50'
                              )}
                            >
                              {isCompleted ? (
                                <Check className="size-4" />
                              ) : (
                                <Icon className="size-4" />
                              )}
                            </div>
                            <span
                              className={cn(
                                'ml-2 text-sm font-medium transition-colors',
                                isCompleted && 'text-accent',
                                isCurrent && 'text-foreground',
                                isPending && 'text-muted-foreground/50'
                              )}
                            >
                              {step.label}
                            </span>
                          </div>

                          {index < steps.length - 1 && (
                            <div
                              className={cn(
                                'w-12 h-0.5 mx-3 transition-colors',
                                index < currentIndex ? 'bg-accent' : 'bg-muted-foreground/20'
                              )}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              </div>
            </div>

            {/* Main Content - Video Preview */}
            <main className="flex flex-col items-center p-8 pt-4">
              {/* Video Streams Area */}
              <div className="w-full max-w-5xl mb-4">
                <div
                  className={cn(
                    'relative rounded-xl overflow-hidden',
                    'bg-background/80 border border-border/50',
                    'aspect-video'
                  )}
                >
                  {/* Mock Screen Content */}
                  {currentStep === 'setup' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Monitor className="h-16 w-16 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground text-sm">
                        Click "Start Recording" to share your screen
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Browser Chrome */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/30">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                          <div className="w-3 h-3 rounded-full bg-green-400/50" />
                        </div>
                        <div className="flex-1 mx-4">
                          <div className="px-3 py-1.5 rounded-md bg-background/50 text-xs text-muted-foreground font-mono">
                            app.tribora.com/dashboard
                          </div>
                        </div>
                      </div>

                      {/* Screen Content */}
                      <div className="relative h-[calc(100%-44px)] p-4">
                        <div className="absolute inset-4">
                          <div className="absolute left-0 top-0 bottom-0 w-[15%] bg-muted/20 rounded-lg" />
                          <div className="absolute left-[17%] top-0 right-0 h-8 bg-muted/10 rounded-lg" />
                          <div className="absolute left-[17%] top-12 w-[38%] h-24 bg-accent/5 border border-accent/20 rounded-lg" />
                          <div className="absolute right-0 top-12 w-[38%] h-24 bg-secondary/5 border border-secondary/20 rounded-lg" />
                          <div className="absolute right-4 top-2 px-3 py-1.5 bg-accent/20 rounded-md text-xs text-accent">
                            + New
                          </div>
                        </div>
                      </div>

                      {/* Recording indicator */}
                      {isRecording && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/90 text-destructive-foreground">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-2 h-2 rounded-full bg-white"
                          />
                          <span className="text-xs font-medium">REC</span>
                          <span className="text-xs font-mono">{formatTime(elapsedTime)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Live Audio Waveform */}
              {(currentStep === 'recording' || currentStep === 'review') && (
                <Card className="w-full max-w-5xl mb-4">
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-foreground">
                          {isRecording ? 'Recording Audio' : 'Recording Preview'}
                        </h3>
                        {isRecording && (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                            <span className="text-xs text-muted-foreground">Live</span>
                          </div>
                        )}
                      </div>

                      {/* Waveform Visualization */}
                      <div className="h-20 rounded-lg bg-muted/30 border border-border flex items-center justify-center gap-[2px] px-2">
                        {waveformData.map((value, i) => (
                          <motion.div
                            key={i}
                            className="w-1 rounded-full bg-accent"
                            animate={{ height: isRecording ? `${value * 60}px` : '4px' }}
                            transition={{ duration: 0.1 }}
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </main>

            {/* Footer - Device Controls */}
            <footer className="border-t border-border/30 bg-card">
              <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
                {/* Desktop: 3-column grid */}
                <div className="hidden sm:grid sm:grid-cols-3 items-center gap-4">
                  {/* Left - Layout Switcher */}
                  <div className="flex items-center justify-start">
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
                      <Button variant="ghost" size="sm" className="h-8 px-2">
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 bg-accent/20 text-accent">
                        <Layout className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Center - Record Button */}
                  <div className="flex justify-center">
                    <Button
                      size="lg"
                      className={cn(
                        'h-14 w-14 rounded-full p-0',
                        isRecording
                          ? 'bg-destructive hover:bg-destructive/90'
                          : 'bg-accent hover:bg-accent/90',
                        'shadow-[0_0_30px_rgba(0,223,130,0.3)]'
                      )}
                    >
                      {isRecording ? (
                        <Square className="h-6 w-6 text-white" />
                      ) : (
                        <Circle className="h-6 w-6 text-accent-foreground fill-current" />
                      )}
                    </Button>
                  </div>

                  {/* Right - Device Selectors */}
                  <div className="flex items-center justify-end gap-3">
                    <Button variant="outline" size="sm" className="h-9">
                      <Mic className="h-4 w-4 mr-2 text-accent" />
                      <span className="text-xs">Microphone</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-9">
                      <Camera className="h-4 w-4 mr-2 text-accent" />
                      <span className="text-xs">Camera</span>
                    </Button>
                  </div>
                </div>

                {/* Mobile: Stacked layout */}
                <div className="flex flex-col gap-4 sm:hidden">
                  <div className="flex justify-center">
                    <Button
                      size="lg"
                      className={cn(
                        'h-14 w-14 rounded-full p-0',
                        isRecording
                          ? 'bg-destructive hover:bg-destructive/90'
                          : 'bg-accent hover:bg-accent/90'
                      )}
                    >
                      {isRecording ? (
                        <Square className="h-6 w-6 text-white" />
                      ) : (
                        <Circle className="h-6 w-6 text-accent-foreground fill-current" />
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="outline" size="sm">
                      <Mic className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </footer>
          </motion.div>

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            4K quality · Unlimited length · Instant processing
          </motion.p>
        </div>
      </div>
    </section>
  );
}
