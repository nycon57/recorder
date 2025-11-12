'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Sparkles,
  Play,
  Mic,
  Brain,
  Search,
  MessageSquare,
  ArrowRight,
  Check
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useEffect, useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

const FEATURES_CAROUSEL = [
  {
    icon: Mic,
    title: 'Record Anywhere',
    description: 'Browser-based recording with no downloads',
  },
  {
    icon: Brain,
    title: 'AI Transcription',
    description: 'Automatic transcription with 95%+ accuracy',
  },
  {
    icon: Search,
    title: 'Semantic Search',
    description: 'Find anything instantly with AI-powered search',
  },
  {
    icon: MessageSquare,
    title: 'AI Assistant',
    description: 'Ask questions, get answers with citations',
  },
];

const STATS = [
  { value: '10K+', label: 'Recordings Processed' },
  { value: '95%', label: 'Accuracy Rate' },
  { value: '< 2min', label: 'Average Processing Time' },
];

export type ModernHeroProps = {
  title?: string;
  subtitle?: string;
  description?: string;
  ctaLabel?: string;
  secondaryLabel?: string;
  heroImageSrc?: string;
};

export default function ModernHero({
  title = "Transform Tacit Knowledge Into Documented Intelligence",
  subtitle = "AI-Powered Knowledge Management",
  description = "Record meetings, interviews, and expert knowledge. Our AI automatically transcribes, documents, and makes everything instantly searchable.",
  ctaLabel = "Start Recording Free",
  secondaryLabel = "Watch Demo",
  heroImageSrc = "/images/hero/dashboard-preview.webp",
}: ModernHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  const [activeFeature, setActiveFeature] = useState(0);

  // Auto-rotate carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % FEATURES_CAROUSEL.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[90vh] overflow-hidden bg-gradient-to-b from-background via-primary/5 to-background"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -right-1/4 h-[800px] w-[800px] rounded-full bg-primary/10 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -left-1/4 h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 container px-6 pt-24 pb-16 lg:pt-32 lg:pb-24"
      >
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="flex flex-col gap-8">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 text-sm font-medium text-primary backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                {subtitle}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-heading-1 bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              {title}
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-xl"
            >
              {description}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/sign-up">
                <Button size="lg" className="group relative overflow-hidden">
                  <span className="relative z-10 flex items-center gap-2">
                    {ctaLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-primary/20"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="group">
                <Play className="h-4 w-4 mr-2 transition-transform group-hover:scale-110" />
                {secondaryLabel}
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-3 gap-8 pt-8 border-t border-border/50"
            >
              {STATS.map((stat, index) => (
                <div key={index} className="flex flex-col">
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Column - Interactive Feature Carousel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            {/* Main Visual */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border/50 bg-card shadow-2xl">
              <Image
                src={heroImageSrc}
                alt="Platform Preview"
                fill
                className="object-cover"
                priority
              />

              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />

              {/* Floating Feature Cards */}
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="relative w-full max-w-md">
                  {FEATURES_CAROUSEL.map((feature, index) => {
                    const Icon = feature.icon;
                    const isActive = index === activeFeature;

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                          opacity: isActive ? 1 : 0,
                          scale: isActive ? 1 : 0.8,
                          y: isActive ? 0 : 20,
                        }}
                        transition={{ duration: 0.5 }}
                        className={cn(
                          "absolute inset-0 backdrop-blur-xl bg-background/90 rounded-xl border border-border/50 p-6 shadow-xl",
                          !isActive && "pointer-events-none"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                            <p className="text-muted-foreground">{feature.description}</p>
                          </div>
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Carousel Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {FEATURES_CAROUSEL.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveFeature(index)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    index === activeFeature
                      ? "w-8 bg-primary"
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                  aria-label={`Go to feature ${index + 1}`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
