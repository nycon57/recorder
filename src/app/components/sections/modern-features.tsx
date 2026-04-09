'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Brain,
  Search,
  MessageSquare,
  FileText,
  Zap,
  Shield,
  Users,
  Globe,
  ArrowRight,
  Play,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import { useState, useRef } from 'react';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

type Feature = {
  id: string;
  icon: React.ElementType<{ className?: string }>;
  title: string;
  description: string;
  highlights: string[];
  imageSrc: string;
  videoSrc?: string;
  badge?: string;
};

const FEATURES: Feature[] = [
  {
    id: 'record',
    icon: Mic,
    title: 'Effortless Recording',
    description: 'Browser-based recording with screen and camera capture. No downloads, no setup required.',
    highlights: [
      'Record screen + camera simultaneously',
      'Up to 4K quality support',
      'Pause and resume anytime',
      'Automatic cloud backup',
    ],
    imageSrc: '/images/features/recording.webp',
    badge: 'Most Popular',
  },
  {
    id: 'transcribe',
    icon: Brain,
    title: 'AI Transcription',
    description: 'Automatic transcription powered by Whisper AI with industry-leading accuracy.',
    highlights: [
      '95%+ accuracy rate',
      'Support for 50+ languages',
      'Speaker identification',
      'Timestamps for every word',
    ],
    imageSrc: '/images/features/transcription.webp',
    badge: 'AI Powered',
  },
  {
    id: 'search',
    icon: Search,
    title: 'Semantic Search',
    description: 'Find anything instantly with AI-powered semantic search across all your recordings.',
    highlights: [
      'Natural language queries',
      'Context-aware results',
      'Search across recordings',
      'Filter by speaker & topic',
    ],
    imageSrc: '/images/features/search.webp',
  },
  {
    id: 'assistant',
    icon: MessageSquare,
    title: 'RAG Assistant',
    description: 'Ask questions about your recordings and get answers with exact citations.',
    highlights: [
      'Conversational interface',
      'Source citations included',
      'Multi-document reasoning',
      'Context-aware responses',
    ],
    imageSrc: '/images/features/assistant.webp',
    badge: 'New',
  },
  {
    id: 'docs',
    icon: FileText,
    title: 'Auto Documentation',
    description: 'Transform recordings into structured documents automatically with AI.',
    highlights: [
      'Meeting notes generation',
      'Technical documentation',
      'Training manuals',
      'Export to multiple formats',
    ],
    imageSrc: '/images/features/documentation.webp',
  },
  {
    id: 'team',
    icon: Users,
    title: 'Team Collaboration',
    description: 'Share knowledge across your organization with role-based access control.',
    highlights: [
      'Department organization',
      'Permission management',
      'Team workspaces',
      'Activity tracking',
    ],
    imageSrc: '/images/features/collaboration.webp',
  },
];

const BENEFITS: { icon: React.ElementType<{ className?: string }>; title: string; description: string }[] = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Process recordings in under 2 minutes',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'SOC 2 compliant with end-to-end encryption',
  },
  {
    icon: Globe,
    title: '50+ Languages',
    description: 'Transcribe and search in multiple languages',
  },
];

export type ModernFeaturesProps = {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
};

export default function ModernFeatures({
  title = "Everything You Need to Capture and Share Knowledge",
  subtitle = "Powerful Features",
  ctaLabel = "Explore All Features",
}: ModernFeaturesProps) {
  const [activeFeature, setActiveFeature] = useState(FEATURES[0].id);
  const [isVideoHovered, setIsVideoHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentFeature = FEATURES.find((f) => f.id === activeFeature) || FEATURES[0];

  const handleFeatureClick = (featureId: string) => {
    setActiveFeature(featureId);
    setIsVideoHovered(false);
  };

  const handleVideoHover = () => {
    setIsVideoHovered(true);
    if (videoRef.current && currentFeature.videoSrc) {
      videoRef.current.play().catch(() => {
        // Autoplay failed, ignore
      });
    }
  };

  const handleVideoLeave = () => {
    setIsVideoHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />

      <div className="relative z-10 container px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 text-sm font-medium text-primary backdrop-blur-sm mb-4">
              <Sparkles className="h-4 w-4" />
              {subtitle}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-heading-2 mb-4"
          >
            {title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            Capture, transcribe, document, and search your knowledge base with cutting-edge AI
          </motion.p>
        </div>

        {/* Interactive Feature Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid lg:grid-cols-[400px_1fr] gap-8 lg:gap-12 mb-16"
        >
          {/* Feature Tabs */}
          <div className="space-y-2">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = feature.id === activeFeature;

              return (
                <motion.button
                  key={feature.id}
                  onClick={() => handleFeatureClick(feature.id)}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={cn(
                    "w-full text-left p-4 rounded-xl transition-all duration-300 group relative overflow-hidden",
                    isActive
                      ? "bg-primary/10 border-2 border-primary shadow-lg"
                      : "bg-card border border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeFeature"
                      className="absolute inset-0 bg-primary/5 rounded-xl"
                      transition={{ type: "spring", duration: 0.6 }}
                    />
                  )}

                  <div className="relative flex items-start gap-3">
                    <div
                      className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted group-hover:bg-primary/10"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className={cn(
                            "font-semibold transition-colors",
                            isActive ? "text-foreground" : "text-foreground/80"
                          )}
                        >
                          {feature.title}
                        </h3>
                        {feature.badge && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                            {feature.badge}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-sm transition-colors line-clamp-2",
                          isActive ? "text-muted-foreground" : "text-muted-foreground/60"
                        )}
                      >
                        {feature.description}
                      </p>
                    </div>

                    {isActive && (
                      <ArrowRight className="flex-shrink-0 h-5 w-5 text-primary" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Feature Content */}
          <div className="relative min-h-[500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentFeature.id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.4 }}
                className="relative"
              >
                {/* Feature Image/Video */}
                <div
                  className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-border bg-card shadow-2xl mb-6 group cursor-pointer"
                  onMouseEnter={handleVideoHover}
                  onMouseLeave={handleVideoLeave}
                >
                  <Image
                    src={currentFeature.imageSrc}
                    alt={currentFeature.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Video overlay (if available) */}
                  {currentFeature.videoSrc && (
                    <>
                      <video
                        ref={videoRef}
                        src={currentFeature.videoSrc}
                        loop
                        muted
                        playsInline
                        className={cn(
                          "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
                          isVideoHovered ? "opacity-100" : "opacity-0"
                        )}
                      />

                      {!isVideoHovered && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                            <Play className="h-8 w-8 text-primary ml-1" />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                </div>

                {/* Feature Highlights */}
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">{currentFeature.title}</h3>
                  <p className="text-muted-foreground mb-4">{currentFeature.description}</p>

                  <ul className="grid sm:grid-cols-2 gap-3">
                    {currentFeature.highlights.map((highlight, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="flex items-start gap-2"
                      >
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                          <ArrowRight className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm text-foreground/90">{highlight}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid sm:grid-cols-3 gap-6 mb-12"
        >
          {BENEFITS.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex flex-col items-center text-center p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm hover:bg-card transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">{benefit.title}</h4>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <Button size="lg" variant="outline" className="group">
            {ctaLabel}
            <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
