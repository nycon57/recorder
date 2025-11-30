'use client';

import * as motion from 'motion/react-client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Mic01Icon,
  AiBrain01Icon,
  AiSearchIcon,
  ChatBotIcon,
  Clock01Icon,
  ZapIcon,
  SparklesIcon,
  AiNetworkIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import Link from 'next/link';
import Image from 'next/image';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';

// Animation variants for scroll-triggered bento grid
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
};

const staggerGrid = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const gridItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

/**
 * AuroraFeatures - Premium bento grid features section
 *
 * Direct adaptation of shadcnblocks Feature261 pattern
 * with Tribora Aurora styling: green accents, glow effects, glass cards
 */

const AuroraFeatures = () => {
  return (
    <section className="relative py-20 sm:py-28 lg:py-32 overflow-hidden">
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top gradient connecting to hero */}
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-background to-transparent" />

        {/* Flowing aurora orbs */}
        <div
          className="absolute top-[10%] right-[5%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.06)_0%,transparent_70%)]
            blur-[100px] animate-float"
          style={{ animationDelay: '3s' }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,223,130,0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,223,130,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      {/* === CONTENT === */}
      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 lg:mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeInUp}
        >
          <Badge
            variant="outline"
            className="mb-6 px-4 py-2 rounded-full bg-accent/5 backdrop-blur-sm border-accent/30"
          >
            <span className="text-sm font-medium text-accent">
              Powerful Features
            </span>
          </Badge>

          <h2 className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight mb-4 sm:mb-6">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-accent via-secondary to-primary bg-clip-text text-transparent">
              capture knowledge
            </span>
          </h2>

          <p className="text-lg sm:text-xl text-muted-foreground font-light max-w-2xl mx-auto">
            From recording to AI-powered answers, transform tacit knowledge into
            searchable intelligence that compounds over time.
          </p>
        </motion.div>

        {/* === BENTO GRID (Feature261 Pattern) === */}
        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12 max-w-7xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerGrid}
        >
          {/* Image Card - Screen Recording Visual (tall, left) */}
          <motion.div
            className="relative h-60 overflow-hidden rounded-3xl md:col-span-2 md:row-span-2 md:h-[400px] lg:col-span-4 lg:h-full group"
            variants={gridItem}
          >
            <Image
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
              alt="Screen recording and knowledge capture"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
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
                <HugeiconsIcon icon={Mic01Icon} size={24} className="text-accent" />
              </div>
            </div>
          </motion.div>

          {/* Image Card - AI Processing Visual */}
          <motion.div
            className="relative h-60 overflow-hidden rounded-3xl border border-border/50 md:col-span-2 md:row-span-2 md:h-[400px] lg:col-span-4 lg:h-full group"
            variants={gridItem}
          >
            <Image
              src="https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=2070&auto=format&fit=crop"
              alt="AI-powered transcription and analysis"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-background/20" />
            <div className="absolute bottom-6 left-6 right-6 z-10">
              <h3 className="text-sm font-medium leading-tight md:text-base lg:text-xl text-foreground">
                AI transforms your words into searchable, structured knowledge.
              </h3>
            </div>
          </motion.div>

          {/* Stats Card - Accuracy */}
          <motion.div variants={gridItem} className="col-span-1 md:col-span-2 md:row-span-1 lg:col-span-2">
            <Card className="h-full rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm md:h-[192px] group hover:border-accent/30 hover:shadow-[0_0_40px_rgba(0,223,130,0.1)] transition-all duration-500">
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
          </motion.div>

          {/* Image Card - Small Visual */}
          <motion.div
            className="relative col-span-1 h-60 overflow-hidden rounded-3xl border border-border/50 md:col-span-2 md:row-span-1 md:h-[192px] lg:col-span-2 group"
            variants={gridItem}
          >
            <Image
              src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop"
              alt="Team collaboration"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
          </motion.div>

          {/* Feature Card - RAG Assistant (large) */}
          <motion.div variants={gridItem} className="col-span-1 md:col-span-4 md:row-span-1 lg:col-span-4">
            <Card className="bg-gradient-to-br from-accent/10 via-card/80 to-secondary/10 h-full rounded-3xl border-border/50 backdrop-blur-sm md:h-[300px] group hover:border-accent/30 hover:shadow-[0_0_50px_rgba(0,223,130,0.15)] transition-all duration-500">
              <CardContent className="h-full p-4 md:p-6">
                <div className="flex h-full flex-col justify-end">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-accent/30">
                        <HugeiconsIcon icon={ChatBotIcon} size={20} className="text-accent" />
                      </div>
                      <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent text-xs">
                        <HugeiconsIcon icon={SparklesIcon} size={12} className="mr-1" />
                        AI Powered
                      </Badge>
                    </div>
                    <div className="text-2xl font-medium md:text-3xl lg:text-4xl text-foreground">
                      RAG Assistant
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Ask questions, get answers with exact citations
                    </div>
                    <Link href="/features/assistant">
                      <Button className="rounded-full bg-gradient-to-r from-accent to-secondary text-accent-foreground hover:shadow-[0_0_30px_rgba(0,223,130,0.4)] transition-all duration-300">
                        Try Assistant
                        <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Card - Languages with Avatars */}
          <motion.div variants={gridItem} className="col-span-1 md:col-span-2 md:row-span-1 lg:col-span-3">
            <Card className="h-full rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm md:h-[300px] group hover:border-accent/30 hover:shadow-[0_0_40px_rgba(0,223,130,0.1)] transition-all duration-500">
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
                      <AvatarImage src={`https://i.pravatar.cc/100?img=${i + 10}`} />
                      <AvatarFallback className="bg-accent/20 text-accent text-xs">
                        {['EN', 'ES', 'FR', 'DE', 'JP'][i - 1]}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Image Card - Wide Visual */}
          <motion.div variants={gridItem} className="col-span-1 md:col-span-3 md:row-span-1 lg:col-span-5">
            <Card className="relative h-60 overflow-hidden rounded-3xl border-border/50 md:h-[300px] group">
              <Image
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop"
                alt="Knowledge analytics dashboard"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent" />
              <div className="absolute bottom-6 left-6 z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/20 backdrop-blur-sm">
                    <HugeiconsIcon icon={AiSearchIcon} size={16} className="text-secondary" />
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
          </motion.div>

          {/* Image Card with Overlay - Knowledge Graph */}
          <motion.div variants={gridItem} className="col-span-1 md:col-span-3 md:row-span-1 lg:col-span-4">
            <Card className="relative h-60 overflow-hidden rounded-3xl border-border/50 md:h-[300px] group">
              <Image
                src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop"
                alt="Knowledge graph connections"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
              <div className="absolute inset-0 z-10 flex items-center justify-start p-4 md:p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 md:gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 backdrop-blur-sm md:h-10 md:w-10 transition-all duration-300 group-hover:scale-110">
                      <HugeiconsIcon icon={AiNetworkIcon} className="h-4 w-4 md:h-5 md:w-5 text-accent" />
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
          </motion.div>

          {/* Stats Card - Processing Time */}
          <motion.div variants={gridItem} className="col-span-1 md:col-span-3 md:row-span-1 lg:col-span-6">
            <Card className="h-full rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm md:h-[200px] group hover:border-accent/30 hover:shadow-[0_0_40px_rgba(0,223,130,0.1)] transition-all duration-500">
              <CardContent className="flex h-full flex-row items-center gap-6 p-4 md:p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20">
                  <HugeiconsIcon icon={Clock01Icon} size={28} className="text-accent" />
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
          </motion.div>

          {/* Feature Card - Auto Docs */}
          <motion.div variants={gridItem} className="col-span-1 md:col-span-3 md:row-span-1 lg:col-span-6">
            <Card className="h-full rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm md:h-[200px] group hover:border-secondary/30 hover:shadow-[0_0_40px_rgba(44,194,149,0.1)] transition-all duration-500">
              <CardContent className="flex h-full flex-row items-center gap-6 p-4 md:p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/30">
                  <HugeiconsIcon icon={AiBrain01Icon} size={28} className="text-secondary" />
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
          </motion.div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-12 sm:mt-16 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeInUp}
        >
          <Link href="/features">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="inline-block"
            >
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-accent/30 hover:border-accent/50 hover:bg-accent/5 transition-all duration-300 group"
              >
                Explore all features
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export { AuroraFeatures };
