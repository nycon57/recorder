'use client';

import { useState } from 'react';
import {
  Mic,
  Brain,
  Search,
  MessageSquare,
  FileText,
  Users,
  Network,
  CloudUpload,
  Check,
  ArrowRight,
  Sparkles,
  Play,
  Shield,
  Globe,
  Zap,
  TrendingUp,
  Clock,
  Eye,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { AuroraCTA } from '@/app/components/sections';

/**
 * Features Page - Aurora Design System
 *
 * Comprehensive features showcase with:
 * - Hero section with flowing aurora gradients
 * - Bento grid feature highlights
 * - Deep-dive alternating feature sections
 * - Comparison matrix
 * - Aurora CTA
 */

// ============================================================================
// DATA
// ============================================================================

interface Stat {
  icon: typeof TrendingUp;
  value: string;
  label: string;
}

const HERO_STATS: Stat[] = [
  { icon: TrendingUp, value: '95%', label: 'Transcription Accuracy' },
  { icon: Clock, value: '<2min', label: 'Average Processing' },
  { icon: Globe, value: '50+', label: 'Languages Supported' },
  { icon: Shield, value: '100%', label: 'SOC 2 Compliant' },
];

interface FeatureHighlight {
  icon: typeof Mic;
  title: string;
  description: string;
  size?: 'normal' | 'large';
  badge?: string;
}

const FEATURE_HIGHLIGHTS: FeatureHighlight[] = [
  {
    icon: Mic,
    title: 'Browser Recording',
    description: 'Capture screen, camera, and audio instantly. No downloads or plugins required.',
    size: 'large',
    badge: 'Core Feature',
  },
  {
    icon: Brain,
    title: 'AI Transcription',
    description: 'Whisper-powered with 95%+ accuracy across 50+ languages.',
  },
  {
    icon: Search,
    title: 'Semantic Search',
    description: 'Find anything with context-aware AI that understands meaning.',
  },
  {
    icon: MessageSquare,
    title: 'RAG Assistant',
    description: 'Get instant answers with exact citations from your knowledge base.',
    size: 'large',
    badge: 'AI Powered',
  },
  {
    icon: FileText,
    title: 'Auto Documentation',
    description: 'Transform recordings into structured docs automatically.',
  },
  {
    icon: Network,
    title: 'Knowledge Graph',
    description: 'Cross-recording concept linking that compounds value over time.',
  },
];

interface DeepDiveFeature {
  id: string;
  icon: typeof Mic;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  badge?: string;
}

const DEEP_DIVE_FEATURES: DeepDiveFeature[] = [
  {
    id: 'recording',
    icon: Mic,
    title: 'Browser-Based Recording',
    subtitle: 'Zero friction capture',
    description:
      'Start recording in seconds directly from your browser. Capture your screen, camera, and microphone with professional quality—no downloads, no plugins, no complications.',
    bullets: [
      'Screen share with system audio capture',
      'Picture-in-picture webcam overlay',
      'High-fidelity microphone recording',
      'Live preview with device selection',
      'Automatic quality optimization',
      'Resume interrupted recordings',
    ],
    badge: 'Most Popular',
  },
  {
    id: 'transcription',
    icon: Brain,
    title: 'AI-Powered Transcription',
    subtitle: 'Words become searchable',
    description:
      'Your spoken words transform into accurate, timestamped text. Powered by OpenAI Whisper, supporting 50+ languages with industry-leading accuracy.',
    bullets: [
      'Word-level timestamps for precise navigation',
      'Multi-language support (50+ languages)',
      'Speaker detection and labeling',
      'Editable transcripts with auto-save',
      'Export to TXT, SRT, VTT formats',
      'Real-time transcription preview',
    ],
    badge: 'AI Powered',
  },
  {
    id: 'search',
    icon: Search,
    title: 'Semantic Search',
    subtitle: 'Find what you mean',
    description:
      'Search by meaning, not just keywords. Our AI understands context, synonyms, and intent—find exactly what you\'re looking for even when you don\'t remember the exact words.',
    bullets: [
      'Context-aware semantic understanding',
      'Search across all recordings at once',
      'Jump to exact moments in videos',
      'Filter by date, speaker, or topic',
      'Natural language query support',
      'Relevance-ranked results',
    ],
  },
  {
    id: 'assistant',
    icon: MessageSquare,
    title: 'RAG AI Assistant',
    subtitle: 'Your knowledge, conversational',
    description:
      'Ask questions about your recordings and get instant answers with citations. Like having a knowledgeable colleague who remembers everything you\'ve ever recorded.',
    bullets: [
      'Natural conversation interface',
      'Answers with exact source citations',
      'Cross-recording knowledge synthesis',
      'Follow-up question support',
      'Conversation history tracking',
      'Per-recording and workspace-wide chat',
    ],
    badge: 'New',
  },
  {
    id: 'documentation',
    icon: FileText,
    title: 'Auto Documentation',
    subtitle: 'Recordings become documents',
    description:
      'Transform any recording into structured, professional documentation automatically. AI analyzes your content and generates organized docs with headings, summaries, and key points.',
    bullets: [
      'Automatic structure and formatting',
      'Executive summaries generated',
      'Key points and action items extracted',
      'Fully editable and customizable',
      'Export to Markdown, PDF, HTML',
      'Template support for consistency',
    ],
  },
  {
    id: 'collaboration',
    icon: Users,
    title: 'Team Collaboration',
    subtitle: 'Knowledge multiplied',
    description:
      'Share expertise across your organization. Build a centralized knowledge base where everyone can access, contribute, and learn from collective team wisdom.',
    bullets: [
      'Organization and department management',
      'Role-based access control (RBAC)',
      'Public, private, and link sharing',
      'Comments and annotations',
      'Usage analytics dashboard',
      'SSO and SAML integration',
    ],
  },
];

interface ComparisonRow {
  feature: string;
  tribora: string | boolean;
  competitorA: string | boolean;
  competitorB: string | boolean;
}

const COMPARISON_DATA: ComparisonRow[] = [
  { feature: 'Recording Quality', tribora: 'Up to 4K', competitorA: '1080p', competitorB: '720p' },
  { feature: 'Transcription Accuracy', tribora: '95%+', competitorA: '85%', competitorB: '80%' },
  { feature: 'AI Documentation', tribora: true, competitorA: false, competitorB: false },
  { feature: 'Semantic Search', tribora: true, competitorA: 'Basic', competitorB: false },
  { feature: 'RAG AI Assistant', tribora: true, competitorA: false, competitorB: false },
  { feature: 'Knowledge Graph', tribora: true, competitorA: false, competitorB: false },
  { feature: 'Bidirectional Sync', tribora: true, competitorA: false, competitorB: false },
  { feature: 'Team Members', tribora: 'Unlimited', competitorA: 'Up to 10', competitorB: 'Up to 5' },
  { feature: 'Storage', tribora: 'Unlimited', competitorA: '100GB', competitorB: '50GB' },
  { feature: 'Languages', tribora: '50+', competitorA: '20', competitorB: '10' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Features Hero Section
 */
function FeaturesHero() {
  return (
    <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Aurora orbs */}
        <div
          className="absolute top-[10%] right-[10%] w-[600px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.12)_0%,transparent_70%)]
            blur-[100px] animate-float"
        />
        <div
          className="absolute bottom-[20%] left-[5%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.08)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '2s' }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,223,130,0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,223,130,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <Badge
            variant="outline"
            className="mb-6 px-4 py-2 rounded-full
              bg-accent/5 backdrop-blur-sm
              border-accent/30"
          >
            <Sparkles className="h-4 w-4 mr-2 text-accent" />
            <span className="text-sm font-medium text-accent">
              Powerful Features
            </span>
          </Badge>

          {/* Headline */}
          <h1
            className="font-outfit text-4xl sm:text-5xl lg:text-6xl xl:text-7xl
              font-light leading-[1.1] tracking-tight mb-6"
          >
            Everything you need to{' '}
            <span
              className="bg-gradient-to-r from-accent via-secondary to-primary
                bg-clip-text text-transparent"
            >
              capture knowledge
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg sm:text-xl text-muted-foreground font-light
              max-w-2xl mx-auto mb-12"
          >
            From recording to AI-powered answers, transform tacit expertise into
            searchable intelligence that compounds over time.
          </p>

          {/* Stats */}
          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8
              pt-8 border-t border-border/30"
          >
            {HERO_STATS.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className={cn(
                    'group flex flex-col items-center p-4 rounded-xl',
                    'transition-all duration-300',
                    'hover:bg-accent/5'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon
                      className={cn(
                        'h-5 w-5 text-accent',
                        'transition-transform duration-300',
                        'group-hover:scale-110'
                      )}
                    />
                    <span className="text-2xl sm:text-3xl font-light text-foreground">
                      {stat.value}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Feature Highlights Bento Grid
 * Direct adaptation of shadcnblocks Feature261 pattern with Aurora styling
 */
function FeatureHighlights() {
  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[800px] h-[400px]
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
            blur-[100px]"
        />
        <div
          className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.05)_0%,transparent_70%)]
            blur-[80px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h2
            className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
              leading-tight tracking-tight mb-4"
          >
            Feature{' '}
            <span
              className="bg-gradient-to-r from-accent to-secondary
                bg-clip-text text-transparent"
            >
              highlights
            </span>
          </h2>
          <p className="text-lg text-muted-foreground font-light">
            Six core capabilities that transform how teams capture and share knowledge.
          </p>
        </div>

        {/* === BENTO GRID (Feature261 Pattern) === */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12 max-w-7xl mx-auto">
          {/* Image Card - Recording Visual (tall, left) */}
          <div className="relative h-60 overflow-hidden rounded-3xl md:col-span-2 md:row-span-2 md:h-[400px] lg:col-span-4 lg:h-full group">
            <img
              src="https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070&auto=format&fit=crop"
              alt="Team using Tribora for knowledge capture"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
            <div className="absolute bottom-6 left-6 z-10">
              <p className="text-lg font-medium text-foreground">
                Capture expertise instantly.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Record screen, camera & audio in one click
              </p>
            </div>
            <div className="absolute right-6 top-6 z-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 backdrop-blur-sm border border-accent/30 transition-all duration-300 group-hover:scale-110 group-hover:bg-accent/30">
                <Mic className="h-6 w-6 text-accent" />
              </div>
            </div>
          </div>

          {/* Image Card - AI Visual */}
          <div className="relative h-60 overflow-hidden rounded-3xl border border-border/50 md:col-span-2 md:row-span-2 md:h-[400px] lg:col-span-4 lg:h-full group">
            <img
              src="https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=2070&auto=format&fit=crop"
              alt="AI-powered transcription"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-background/20" />
            <div className="absolute bottom-6 left-6 right-6 z-10">
              <h3 className="text-sm font-medium leading-tight md:text-base lg:text-xl text-foreground">
                AI transforms your words into searchable, structured knowledge.
              </h3>
            </div>
          </div>

          {/* Stats Card - Accuracy */}
          <Card className="col-span-1 rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm md:col-span-2 md:row-span-1 md:h-[192px] lg:col-span-2 group hover:border-accent/30 hover:shadow-[0_0_40px_rgba(0,223,130,0.1)] transition-all duration-500">
            <CardContent className="flex h-full flex-col justify-center p-4 md:p-6">
              <div className="mb-2 text-4xl font-bold md:text-4xl lg:text-6xl">
                <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                  95
                </span>
                <span className="align-top text-2xl md:text-xl lg:text-3xl text-accent">
                  %
                </span>
              </div>
              <p className="text-sm leading-tight text-muted-foreground md:text-sm">
                Transcription accuracy
                <br />
                powered by Whisper AI
              </p>
            </CardContent>
          </Card>

          {/* Image Card - Small */}
          <div className="relative col-span-1 h-60 overflow-hidden rounded-3xl border border-border/50 md:col-span-2 md:row-span-1 md:h-[192px] lg:col-span-2 group">
            <img
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop"
              alt="Team collaboration"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
          </div>

          {/* Feature Card - RAG Assistant (large) */}
          <Card className="bg-gradient-to-br from-accent/10 via-card/80 to-secondary/10 col-span-1 rounded-3xl border-border/50 backdrop-blur-sm md:col-span-4 md:row-span-1 md:h-[300px] lg:col-span-4 group hover:border-accent/30 hover:shadow-[0_0_50px_rgba(0,223,130,0.15)] transition-all duration-500">
            <CardContent className="h-full p-4 md:p-6">
              <div className="flex h-full flex-col justify-end">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-accent/30">
                      <MessageSquare className="h-5 w-5 text-accent" />
                    </div>
                    <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Powered
                    </Badge>
                  </div>
                  <div className="text-2xl font-medium md:text-3xl lg:text-4xl text-foreground">
                    RAG Assistant
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Ask questions, get answers with exact citations
                  </div>
                  <Button asChild className="rounded-full bg-gradient-to-r from-accent to-secondary text-accent-foreground hover:shadow-[0_0_30px_rgba(0,223,130,0.4)] transition-all duration-300">
                    <Link href="/features/assistant">
                      Try Assistant
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Card - Languages */}
          <Card className="col-span-1 rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm md:col-span-2 md:row-span-1 md:h-[300px] lg:col-span-3 group hover:border-accent/30 hover:shadow-[0_0_40px_rgba(0,223,130,0.1)] transition-all duration-500">
            <CardContent className="flex h-full flex-col justify-center p-4 md:p-5">
              <div className="mb-3">
                <span className="text-4xl font-bold md:text-3xl lg:text-6xl bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                  50
                </span>
                <span className="align-top text-2xl font-bold md:text-xl lg:text-3xl text-accent">
                  +
                </span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground md:text-sm">
                Languages supported worldwide
              </p>
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Avatar
                    key={i}
                    className="border-background h-8 w-8 border-2 md:h-8 md:w-8 lg:h-10 lg:w-10 ring-2 ring-accent/20"
                  >
                    <AvatarImage src={`https://i.pravatar.cc/100?img=${i + 20}`} />
                    <AvatarFallback className="bg-accent/20 text-accent text-xs">
                      {['EN', 'ES', 'FR', 'DE', 'JP'][i - 1]}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Image Card - Wide */}
          <Card className="relative col-span-1 h-60 overflow-hidden rounded-3xl border-border/50 md:col-span-3 md:row-span-1 md:h-[300px] lg:col-span-5 group">
            <img
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop"
              alt="Analytics dashboard"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent" />
            <div className="absolute bottom-6 left-6 z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/20 backdrop-blur-sm">
                  <Search className="h-4 w-4 text-secondary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Semantic Search
                </span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Find anything instantly with AI that understands meaning
              </p>
            </div>
          </Card>

          {/* Image Card with Overlay - Knowledge Graph */}
          <Card className="relative col-span-1 h-60 overflow-hidden rounded-3xl border-border/50 md:col-span-3 md:row-span-1 md:h-[300px] lg:col-span-4 group">
            <img
              src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop"
              alt="Knowledge connections"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
            <div className="absolute inset-0 z-10 flex items-center justify-start p-4 md:p-6">
              <div>
                <div className="mb-3 flex items-center gap-2 md:gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 backdrop-blur-sm md:h-10 md:w-10 transition-all duration-300 group-hover:scale-110">
                    <Network className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                  </div>
                  <span className="text-base font-semibold md:text-lg text-foreground">
                    Knowledge Graph
                  </span>
                </div>
                <p className="text-sm text-muted-foreground md:text-sm max-w-xs">
                  Concepts link across recordings
                  <br />
                  <span className="text-sm font-medium text-accent">
                    compounding value over time
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {/* Stats Card - Processing */}
          <Card className="col-span-1 rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm md:col-span-3 md:row-span-1 md:h-[200px] lg:col-span-6 group hover:border-accent/30 hover:shadow-[0_0_40px_rgba(0,223,130,0.1)] transition-all duration-500">
            <CardContent className="flex h-full flex-row items-center gap-6 p-4 md:p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20">
                <Clock className="h-7 w-7 text-accent" />
              </div>
              <div>
                <div className="mb-1 text-3xl font-bold md:text-4xl lg:text-5xl">
                  <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                    &lt;2
                  </span>
                  <span className="text-lg md:text-xl lg:text-2xl text-accent ml-1">
                    min
                  </span>
                </div>
                <p className="text-sm leading-tight text-muted-foreground">
                  Average processing time for any recording
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Feature Card - Auto Docs */}
          <Card className="col-span-1 rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm md:col-span-3 md:row-span-1 md:h-[200px] lg:col-span-6 group hover:border-secondary/30 hover:shadow-[0_0_40px_rgba(44,194,149,0.1)] transition-all duration-500">
            <CardContent className="flex h-full flex-row items-center gap-6 p-4 md:p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/30">
                <FileText className="h-7 w-7 text-secondary" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-1 group-hover:text-secondary transition-colors">
                  Auto Documentation
                </h3>
                <p className="text-sm text-muted-foreground">
                  Recordings transform into structured, searchable docs instantly
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

/**
 * Deep Dive Feature Sections
 */
function DeepDiveFeatures() {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  return (
    <section className="relative py-16 sm:py-20 lg:py-24">
      <div className="container px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <Badge
            variant="outline"
            className="mb-6 px-4 py-2 rounded-full
              bg-accent/5 backdrop-blur-sm border-accent/30"
          >
            <Eye className="h-4 w-4 mr-2 text-accent" />
            <span className="text-sm font-medium text-accent">Deep Dive</span>
          </Badge>

          <h2
            className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
              leading-tight tracking-tight mb-4"
          >
            Explore every{' '}
            <span
              className="bg-gradient-to-r from-accent to-secondary
                bg-clip-text text-transparent"
            >
              capability
            </span>
          </h2>
          <p className="text-lg text-muted-foreground font-light">
            Detailed look at how each feature helps you capture and leverage knowledge.
          </p>
        </div>

        {/* Feature Sections */}
        <div className="max-w-6xl mx-auto space-y-24 sm:space-y-32">
          {DEEP_DIVE_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            const isEven = index % 2 === 0;

            return (
              <div
                key={feature.id}
                className={cn(
                  'grid lg:grid-cols-2 gap-12 lg:gap-16 items-center'
                )}
                onMouseEnter={() => setHoveredFeature(feature.id)}
                onMouseLeave={() => setHoveredFeature(null)}
                onFocus={() => setHoveredFeature(feature.id)}
                onBlur={() => setHoveredFeature(null)}
                tabIndex={0}
              >
                {/* Content */}
                <div className={cn(isEven ? 'lg:order-1' : 'lg:order-2')}>
                  {/* Badge */}
                  {feature.badge && (
                    <Badge
                      variant="outline"
                      className="mb-4 px-3 py-1 rounded-full
                        bg-accent/10 border-accent/30 text-accent text-xs"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {feature.badge}
                    </Badge>
                  )}

                  {/* Icon + Title */}
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className={cn(
                        'w-14 h-14 rounded-2xl',
                        'bg-accent/10',
                        'flex items-center justify-center',
                        'transition-all duration-300',
                        hoveredFeature === feature.id && 'bg-accent/20 scale-110'
                      )}
                    >
                      <Icon className="h-7 w-7 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-accent font-medium">
                        {feature.subtitle}
                      </p>
                      <h3 className="font-outfit text-2xl sm:text-3xl font-medium">
                        {feature.title}
                      </h3>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                    {feature.description}
                  </p>

                  {/* Bullets */}
                  <ul className="space-y-3 mb-8">
                    {feature.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div
                          className={cn(
                            'shrink-0 mt-1 w-5 h-5 rounded-full',
                            'bg-accent/10',
                            'flex items-center justify-center'
                          )}
                        >
                          <Check className="h-3 w-3 text-accent" />
                        </div>
                        <span className="text-foreground/80">{bullet}</span>
                      </li>
                    ))}
                  <Button
                    asChild
                    variant="outline"
                    className={cn(
                      'rounded-full group/btn',
                      'border-accent/30 hover:border-accent/50',
                      'hover:bg-accent/5'
                    )}
                  >
                    <Link href={`/features/${feature.id}`}>
                      Learn more
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </Link>
                </div>

                {/* Visual */}
                <div className={cn(isEven ? 'lg:order-2' : 'lg:order-1')}>
                  <div
                    className={cn(
                      'relative aspect-[4/3] rounded-2xl overflow-hidden',
                      'bg-card/50 backdrop-blur-sm',
                      'border border-border/50',
                      'transition-all duration-500',
                      hoveredFeature === feature.id &&
                        'border-accent/30 shadow-[0_0_60px_rgba(0,223,130,0.15)]'
                    )}
                  >
                    {/* Background gradient */}
                    <div
                      className={cn(
                        'absolute inset-0',
                        'bg-gradient-to-br from-accent/10 via-transparent to-secondary/10'
                      )}
                    />

                    {/* Floating aurora orb */}
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[300px] h-[300px] rounded-full
                        bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.15)_0%,transparent_70%)]
                        blur-[60px] animate-pulse-slow"
                    />

                    {/* Content placeholder */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center p-8">
                        <div
                          className={cn(
                            'w-20 h-20 rounded-2xl mx-auto mb-4',
                            'bg-accent/20',
                            'flex items-center justify-center',
                            'transition-all duration-500',
                            hoveredFeature === feature.id && 'scale-110'
                          )}
                        >
                          <Icon className="h-10 w-10 text-accent" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          [{feature.title} Demo]
                        </p>
                      </div>
                    </div>

                    {/* Play overlay on hover */}
                    <div
                      className={cn(
                        'absolute inset-0 flex items-center justify-center',
                        'bg-background/60 backdrop-blur-sm',
                        'opacity-0 transition-opacity duration-300',
                        hoveredFeature === feature.id && 'opacity-100'
                      )}
                    >
                      <div
                        className={cn(
                          'w-16 h-16 rounded-full',
                          'bg-accent/90',
                          'flex items-center justify-center',
                          'shadow-[0_0_30px_rgba(0,223,130,0.5)]'
                        )}
                      >
                        <Play className="h-8 w-8 text-accent-foreground ml-1" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Comparison Matrix
 */
function ComparisonMatrix() {
  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-0 right-0 h-px
            bg-gradient-to-r from-transparent via-accent/20 to-transparent"
        />
        <div
          className="absolute bottom-[30%] right-[10%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
            blur-[100px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <Badge
            variant="outline"
            className="mb-6 px-4 py-2 rounded-full
              bg-accent/5 backdrop-blur-sm border-accent/30"
          >
            <Zap className="h-4 w-4 mr-2 text-accent" />
            <span className="text-sm font-medium text-accent">Comparison</span>
          </Badge>

          <h2
            className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
              leading-tight tracking-tight mb-4"
          >
            How Tribora{' '}
            <span
              className="bg-gradient-to-r from-accent to-secondary
                bg-clip-text text-transparent"
            >
              compares
            </span>
          </h2>
          <p className="text-lg text-muted-foreground font-light">
            See why knowledge-driven teams choose Tribora over alternatives.
          </p>
        </div>

        {/* Table */}
        <div className="max-w-5xl mx-auto">
          <div
            className={cn(
              'rounded-2xl overflow-hidden',
              'bg-card/50 backdrop-blur-sm',
              'border border-border/50',
              'shadow-[0_0_60px_rgba(0,223,130,0.05)]'
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 sm:p-6 font-medium text-sm text-muted-foreground w-[30%]">
                      Feature
                    </th>
                    <th className="text-center p-4 sm:p-6 font-medium text-sm w-[23%]">
                      <div className="flex items-center justify-center gap-2">
                        <div
                          className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent to-secondary
                            flex items-center justify-center"
                        >
                          <span className="text-accent-foreground font-bold text-xs">T</span>
                        </div>
                        <span className="text-accent">Tribora</span>
                      </div>
                    </th>
                    <th className="text-center p-4 sm:p-6 font-medium text-sm text-muted-foreground w-[23%]">
                      Competitor A
                    </th>
                    <th className="text-center p-4 sm:p-6 font-medium text-sm text-muted-foreground w-[23%]">
                      Competitor B
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_DATA.map((row, index) => (
                    <tr
                      key={index}
                      className={cn(
                        'border-b border-border/30 last:border-0',
                        'transition-colors duration-300',
                        'hover:bg-accent/5'
                      )}
                    >
                      <td className="p-4 sm:p-6 text-sm font-medium">
                        {row.feature}
                      </td>
                      <td className="p-4 sm:p-6 text-center">
                        {typeof row.tribora === 'boolean' ? (
                          row.tribora ? (
                            <div className="flex justify-center">
                              <div
                                className="w-6 h-6 rounded-full bg-accent/20
                                  flex items-center justify-center"
                              >
                                <Check className="h-4 w-4 text-accent" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )
                        ) : (
                          <span className="text-sm font-semibold text-accent">
                            {row.tribora}
                          </span>
                        )}
                      </td>
                      <td className="p-4 sm:p-6 text-center">
                        {typeof row.competitorA === 'boolean' ? (
                          row.competitorA ? (
                            <Check className="h-4 w-4 text-muted-foreground mx-auto" />
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {row.competitorA}
                          </span>
                        )}
                      </td>
                      <td className="p-4 sm:p-6 text-center">
                        {typeof row.competitorB === 'boolean' ? (
                          row.competitorB ? (
                            <Check className="h-4 w-4 text-muted-foreground mx-auto" />
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {row.competitorB}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function FeaturesPage() {
  return (
    <div className="flex flex-col">
      <FeaturesHero />
      <FeatureHighlights />
      <DeepDiveFeatures />
      <ComparisonMatrix />
      <AuroraCTA />
    </div>
  );
}
