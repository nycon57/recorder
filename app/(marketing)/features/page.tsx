'use client';

import { motion } from 'framer-motion';
import {
  Video,
  FileText,
  Search,
  MessageSquare,
  Users,
  Zap,
  Check,
  ArrowRight,
  Sparkles,
  Play,
  Mic,
  Globe,
  Shield,
  TrendingUp,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { ModernCTA } from '@/app/components/sections';
import { cn } from '@/lib/utils/cn';

type Feature = {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  bullets: string[];
  imageSrc: string;
  videoSrc?: string;
  imageSide: 'left' | 'right';
  badge?: string;
};

const FEATURES: Feature[] = [
  {
    id: 'recording',
    icon: Video,
    title: 'Browser-Based Recording',
    description:
      'Capture your screen, camera, and audio directly in your browser. No downloads, no plugins, no hassle. Just open the app and start recording.',
    bullets: [
      'Screen share with system audio',
      'Webcam overlay (picture-in-picture)',
      'High-quality microphone capture',
      'Live preview and device selection',
    ],
    imageSrc: '/images/features/recording.webp',
    imageSide: 'right',
    badge: 'Most Used',
  },
  {
    id: 'transcription',
    icon: FileText,
    title: 'Automatic Transcription',
    description:
      'Your spoken words magically become accurate text. Powered by OpenAI Whisper, our transcription includes timestamps, speaker detection, and high accuracy across multiple languages.',
    bullets: [
      'Word-level timestamps for navigation',
      'Multi-language support (50+ languages)',
      'Editable transcripts with auto-save',
      'Export to text, SRT, VTT formats',
    ],
    imageSrc: '/images/features/transcription.webp',
    imageSide: 'left',
    badge: 'AI Powered',
  },
  {
    id: 'documentation',
    icon: Zap,
    title: 'AI-Powered Documentation',
    description:
      'Turn any recording into structured documentation automatically. Our AI analyzes your content and generates organized, readable docs with headings, summaries, and key points.',
    bullets: [
      'Automatic structure and formatting',
      'Key points and summaries extraction',
      'Editable and fully customizable',
      'Export to Markdown, PDF, HTML',
    ],
    imageSrc: '/images/features/documentation.webp',
    imageSide: 'right',
  },
  {
    id: 'search',
    icon: Search,
    title: 'Semantic Search',
    description:
      "Find exactly what you're looking for, even if you don't remember the exact words. Our AI-powered search understands context and meaning, not just keywords.",
    bullets: [
      'Context-aware semantic understanding',
      'Search across all recordings simultaneously',
      'Jump to exact moments in videos',
      'Advanced filters and query syntax',
    ],
    imageSrc: '/images/features/search.webp',
    imageSide: 'left',
    badge: 'Popular',
  },
  {
    id: 'assistant',
    icon: MessageSquare,
    title: 'RAG AI Assistant',
    description:
      "Ask questions about your recordings and get instant answers with citations. Your personal AI assistant knows everything you've recorded and helps you find information fast.",
    bullets: [
      'Natural language conversation interface',
      'Answers with exact source citations',
      'Full conversation history tracking',
      'Per-recording and workspace-wide chat',
    ],
    imageSrc: '/images/features/assistant.webp',
    imageSide: 'right',
    badge: 'New',
  },
  {
    id: 'collaboration',
    icon: Users,
    title: 'Team Collaboration',
    description:
      'Share knowledge across your organization. Invite team members, manage permissions, and build a centralized knowledge base everyone can access.',
    bullets: [
      'Organization and department management',
      'Role-based access control (RBAC)',
      'Public, private, and link sharing',
      'Usage analytics and insights dashboard',
    ],
    imageSrc: '/images/features/collaboration.webp',
    imageSide: 'left',
  },
];

const COMPARISON_DATA = [
  {
    feature: 'Recording Quality',
    record: 'Up to 4K',
    competitor1: '1080p',
    competitor2: '720p',
  },
  {
    feature: 'Transcription Accuracy',
    record: '95%+',
    competitor1: '85%',
    competitor2: '80%',
  },
  {
    feature: 'AI Documentation',
    record: true,
    competitor1: false,
    competitor2: false,
  },
  {
    feature: 'Semantic Search',
    record: true,
    competitor1: 'Basic',
    competitor2: false,
  },
  {
    feature: 'RAG AI Assistant',
    record: true,
    competitor1: false,
    competitor2: false,
  },
  {
    feature: 'Team Collaboration',
    record: 'Unlimited',
    competitor1: 'Up to 10',
    competitor2: 'Up to 5',
  },
  {
    feature: 'Storage',
    record: 'Unlimited',
    competitor1: '100GB',
    competitor2: '50GB',
  },
  {
    feature: 'Languages Supported',
    record: '50+',
    competitor1: '20',
    competitor2: '10',
  },
];

const STATS = [
  { icon: TrendingUp, value: '95%', label: 'Faster Knowledge Retrieval' },
  { icon: Shield, value: '100%', label: 'SOC 2 Compliant' },
  { icon: Globe, value: '50+', label: 'Languages Supported' },
];

export default function FeaturesPage() {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />

        <div className="relative z-10 container px-6 mx-auto max-w-7xl">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 text-sm font-medium text-primary backdrop-blur-sm mb-6">
                <Sparkles className="h-4 w-4" />
                Powerful Features
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-heading-1 mb-6"
            >
              Everything You Need to Capture and Share Knowledge
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-8"
            >
              From recording to AI-powered answers, Record provides a complete
              knowledge management platform for modern teams.
            </motion.p>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="grid sm:grid-cols-3 gap-8 pt-8 border-t border-border max-w-3xl mx-auto"
            >
              {STATS.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <div className="text-3xl font-bold">{stat.value}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section className="container px-6 py-16 mx-auto max-w-7xl">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon as React.ComponentType<{ className?: string }>;
          const isLeft = feature.imageSide === 'left';

          return (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={cn(
                "grid md:grid-cols-2 gap-12 items-center mb-32",
                index === FEATURES.length - 1 && "mb-16"
              )}
              onMouseEnter={() => setHoveredFeature(feature.id)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              {/* Image/Video */}
              <div
                className={cn(
                  "relative",
                  isLeft ? "order-2 md:order-1" : "order-2"
                )}
              >
                <motion.div
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-card shadow-2xl"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-8">
                      <Icon className="h-16 w-16 text-primary mx-auto mb-4" />
                      <div className="text-sm text-muted-foreground">
                        [{feature.title} Demo]
                      </div>
                    </div>
                  </div>

                  {/* Hover overlay */}
                  {hoveredFeature === feature.id && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="h-8 w-8 text-primary ml-1" />
                      </div>
                    </motion.div>
                  )}

                  {/* Badge */}
                  {feature.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        <Sparkles className="h-3 w-3" />
                        {feature.badge}
                      </span>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Content */}
              <div
                className={cn(
                  isLeft ? "order-1 md:order-2" : "order-1"
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-heading-3">{feature.title}</h2>
                </div>

                <p className="text-lg text-muted-foreground mb-6">
                  {feature.description}
                </p>

                <ul className="space-y-3 mb-6">
                  {feature.bullets.map((bullet, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-foreground/90">{bullet}</span>
                    </motion.li>
                  ))}
                </ul>

                <Button variant="outline" className="group">
                  Learn More
                  <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* Comparison Matrix */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30" />

        <div className="relative z-10 container px-6 mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-heading-2 mb-4">
              How Record Compares
            </h2>
            <p className="text-lg text-muted-foreground">
              See why teams choose Record over other solutions
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="border border-border rounded-2xl overflow-hidden bg-card shadow-xl"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-4 font-semibold text-sm w-1/4">Feature</th>
                    <th className="text-center p-4 font-semibold text-sm bg-primary/10 w-1/4">
                      <div className="flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Record
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold text-sm w-1/4">Competitor A</th>
                    <th className="text-center p-4 font-semibold text-sm w-1/4">Competitor B</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_DATA.map((row, index) => (
                    <tr key={index} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm font-medium">{row.feature}</td>
                      <td className="p-4 text-center bg-primary/5">
                        {typeof row.record === 'boolean' ? (
                          row.record ? (
                            <Check className="h-5 w-5 text-primary mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="text-sm font-semibold text-primary">{row.record}</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {typeof row.competitor1 === 'boolean' ? (
                          row.competitor1 ? (
                            <Check className="h-5 w-5 text-muted-foreground mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">{row.competitor1}</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {typeof row.competitor2 === 'boolean' ? (
                          row.competitor2 ? (
                            <Check className="h-5 w-5 text-muted-foreground mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">{row.competitor2}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <ModernCTA />
    </div>
  );
}
