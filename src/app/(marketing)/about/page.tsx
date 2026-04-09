'use client';

import * as motion from 'motion/react-client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  SparklesIcon,
  ArrowRight01Icon,
  Tick02Icon,
  Target01Icon,
  ShieldKeyIcon,
  FlashIcon,
  FavouriteIcon,
  UserGroupIcon,
  ChartLineData01Icon,
  Award01Icon,
  Globe02Icon,
  RocketIcon,
  Linkedin01Icon,
  NewTwitterIcon,
  Github01Icon,
  Idea01Icon,
  LinkSquare01Icon,
  SunriseIcon,
} from '@hugeicons/core-free-icons';
import Link from 'next/link';
import Image from 'next/image';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { AuroraCTA } from '@/app/components/sections';

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

// ============================================================================
// DATA
// ============================================================================

const NARRATIVE_PILLARS = [
  {
    icon: UserGroupIcon,
    title: 'The Tribe',
    description:
      'Teams are living organisms. Products break, workflows evolve, knowledge shifts. Experts hold the truth — and when they leave, the tribe dims. Tribora preserves the tribe\'s collective memory.',
  },
  {
    icon: Idea01Icon,
    title: 'The Aurora',
    description:
      'Knowledge should not be hidden in the dark. Tribora brings light to what was once unseen — buried in screenshares, trapped in demos, lost in Slack. Your knowledge becomes visible. Searchable. Illuminated.',
  },
  {
    icon: LinkSquare01Icon,
    title: 'The Connective Thread',
    description:
      'Tribes thrive when knowledge flows freely. Tribora turns individual know-how into shared intelligence, connecting insights across your entire organization.',
  },
  {
    icon: SunriseIcon,
    title: 'The Dawn of Understanding',
    description:
      'With Tribora, every recording becomes an insight. Every workflow becomes a guide. Every expert becomes a teacher. This is the dawn of a more intelligent tribe.',
  },
];

const VALUES = [
  {
    icon: Target01Icon,
    title: 'Simplicity First',
    description:
      "Powerful features shouldn't require complex workflows. We prioritize ease of use without sacrificing capability.",
  },
  {
    icon: ShieldKeyIcon,
    title: 'Privacy & Security',
    description:
      'Your knowledge is valuable. We protect it with enterprise-grade security and transparent data practices.',
  },
  {
    icon: FlashIcon,
    title: 'Speed & Reliability',
    description:
      'Knowledge should be instant. We build for performance and uptime so you can access what you need, when you need it.',
  },
  {
    icon: FavouriteIcon,
    title: 'Customer Success',
    description:
      'We succeed when you succeed. Your feedback drives our roadmap and our support team is here to help.',
  },
];

const STATS = [
  { value: '10K+', label: 'Active Users', icon: UserGroupIcon },
  { value: '1M+', label: 'Recordings Processed', icon: ChartLineData01Icon },
  { value: '99.9%', label: 'Uptime Guarantee', icon: Award01Icon },
  { value: '50+', label: 'Countries Served', icon: Globe02Icon },
];

const MILESTONES = [
  {
    year: '2023',
    quarter: 'Q3',
    title: 'The Spark',
    description: 'Tribora was born from a simple idea: make tacit knowledge capture effortless and illuminated.',
  },
  {
    year: '2023',
    quarter: 'Q4',
    title: 'Beta Launch',
    description: 'Released to first 100 design partners, gathering invaluable feedback to shape the product.',
  },
  {
    year: '2024',
    quarter: 'Q2',
    title: 'Public Launch',
    description: 'Opened to the public with full AI-powered features: transcription, docify, and semantic search.',
  },
  {
    year: '2024',
    quarter: 'Q4',
    title: 'Knowledge Graph',
    description: 'Launched cross-recording concept linking — the foundation of our compounding knowledge MOAT.',
  },
];

const TEAM = [
  {
    name: 'Sarah Chen',
    role: 'Co-Founder & CEO',
    bio: 'Former engineering lead at a Fortune 500 tech company, passionate about making knowledge accessible to everyone.',
    initials: 'SC',
    social: {
      linkedin: '#',
      twitter: '#',
    },
  },
  {
    name: 'Michael Rodriguez',
    role: 'Co-Founder & CTO',
    bio: 'AI researcher with a PhD in NLP and machine learning, building the future of intelligent search.',
    initials: 'MR',
    social: {
      linkedin: '#',
      github: '#',
    },
  },
  {
    name: 'Emily Watson',
    role: 'Head of Product',
    bio: 'Product leader with 10+ years experience crafting delightful user experiences.',
    initials: 'EW',
    social: {
      linkedin: '#',
      twitter: '#',
    },
  },
];

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* ================================================================== */}
      {/* HERO SECTION */}
      {/* ================================================================== */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Aurora Background */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/95" />

          {/* Aurora orbs */}
          <div
            className="absolute top-[-10%] right-[15%] w-[500px] h-[500px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.12)_0%,transparent_70%)]
              blur-[80px] animate-float"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="absolute bottom-[20%] left-[5%] w-[400px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.1)_0%,transparent_70%)]
              blur-[100px] animate-float"
            style={{ animationDelay: '2s' }}
          />
          <div
            className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(3,98,76,0.08)_0%,transparent_60%)]
              blur-[120px] animate-pulse-slow"
          />

          {/* Radial gradient overlay */}
          <div
            className="absolute inset-0
              bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,223,130,0.1),transparent_60%)]"
          />

          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.3]
              bg-[radial-gradient(rgba(0,223,130,0.4)_1px,transparent_1px)]
              [background-size:24px_24px]
              [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black_20%,transparent_70%)]"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 container px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <motion.div
            className="max-w-4xl mx-auto text-center"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="mb-6">
              <Badge
                variant="outline"
                className="px-4 py-2 rounded-full
                  bg-accent/5 backdrop-blur-sm
                  border-accent/30"
              >
                <HugeiconsIcon icon={SparklesIcon} size={14} className="mr-2 text-accent" />
                <span className="text-sm font-medium text-accent">About Tribora</span>
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeInUp}
              className="font-outfit text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light leading-[1.1] tracking-tight mb-6"
            >
              <span className="text-foreground">Every team is a </span>
              <span
                className="bg-gradient-to-r from-accent via-secondary to-primary
                  bg-clip-text text-transparent
                  bg-[length:200%_auto] animate-gradient-x"
              >
                tribe
              </span>
              <br className="hidden sm:block" />
              <span className="text-foreground">Every tribe carries </span>
              <span
                className="bg-gradient-to-r from-primary via-secondary to-accent
                  bg-clip-text text-transparent
                  bg-[length:200%_auto] animate-gradient-x"
              >
                wisdom
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={fadeInUp}
              className="text-lg sm:text-xl lg:text-2xl text-muted-foreground font-light leading-relaxed max-w-3xl mx-auto mb-8"
            >
              <span className="font-medium text-foreground">Tribora</span> = <span className="text-accent">Tribe</span> + <span className="text-secondary">Aurora</span>.
              We illuminate your team's collective knowledge, making the invisible visible.
            </motion.p>

            {/* Etymology badge */}
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full
                bg-card/50 backdrop-blur-sm border border-accent/20"
            >
              <span className="text-sm text-muted-foreground">The Knowledge Intelligence Layer</span>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ================================================================== */}
      {/* STATS SECTION */}
      {/* ================================================================== */}
      <section className="relative py-16 overflow-hidden">
        <div className="container px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="max-w-5xl mx-auto"
          >
            <motion.div
              variants={cardVariants}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8 rounded-2xl
                bg-card/50 backdrop-blur-sm border border-accent/20
                shadow-[0_0_40px_rgba(0,223,130,0.08)]"
            >
              {STATS.map((stat, index) => (
                <motion.div
                  key={index}
                  variants={scaleIn}
                  className="text-center"
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <HugeiconsIcon icon={stat.icon} size={24} className="text-accent" />
                    <span className="text-3xl sm:text-4xl font-light text-accent font-outfit">
                      {stat.value}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* NARRATIVE PILLARS - Our Story */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        {/* Background aurora */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[10%] left-[5%] w-[400px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
              blur-[100px]"
          />
          <div
            className="absolute bottom-[20%] right-[10%] w-[350px] h-[350px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.05)_0%,transparent_70%)]
              blur-[80px]"
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <motion.div
            className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <Badge
                variant="outline"
                className="mb-6 px-4 py-2 rounded-full
                  bg-accent/5 backdrop-blur-sm border-accent/30"
              >
                <span className="text-sm font-medium text-accent">Our Story</span>
              </Badge>
            </motion.div>

            <motion.h2
              variants={fadeInUp}
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight mb-6"
            >
              The{' '}
              <span className="bg-gradient-to-r from-accent via-secondary to-primary bg-clip-text text-transparent">
                mythology
              </span>{' '}
              behind Tribora
            </motion.h2>

            <motion.p
              variants={fadeInUp}
              className="text-lg text-muted-foreground font-light"
            >
              Four narrative pillars guide everything we build and believe.
            </motion.p>
          </motion.div>

          {/* Pillars Grid */}
          <motion.div
            className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {NARRATIVE_PILLARS.map((pillar, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                className={cn(
                  'group relative p-8 rounded-2xl overflow-hidden',
                  'bg-card/50 backdrop-blur-sm',
                  'border border-border/50 hover:border-accent/30',
                  'transition-all duration-500 ease-smooth',
                  'hover:shadow-[0_0_40px_rgba(0,223,130,0.1)]'
                )}
              >
                {/* Gradient background on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100
                    bg-gradient-to-br from-accent/5 via-transparent to-secondary/5
                    transition-opacity duration-500"
                />

                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-xl mb-6
                      bg-accent/10 border border-accent/20
                      flex items-center justify-center
                      group-hover:shadow-[0_0_20px_rgba(0,223,130,0.2)]
                      transition-shadow duration-300"
                  >
                    <HugeiconsIcon icon={pillar.icon} size={28} className="text-accent" />
                  </div>

                  {/* Title */}
                  <h3 className="font-outfit text-xl font-medium mb-3 text-foreground">
                    {pillar.title}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* MISSION & VISION */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        {/* Divider line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={staggerContainer}
              className="space-y-16"
            >
              {/* Mission */}
              <motion.div variants={fadeInUp}>
                <Badge
                  variant="outline"
                  className="mb-6 px-4 py-2 rounded-full
                    bg-accent/5 backdrop-blur-sm border-accent/30"
                >
                  <span className="text-sm font-medium text-accent">Our Mission</span>
                </Badge>
                <h2 className="font-outfit text-2xl sm:text-3xl lg:text-4xl font-light leading-tight tracking-tight mb-6">
                  Making tacit knowledge{' '}
                  <span className="text-accent">accessible</span>,{' '}
                  <span className="text-secondary">searchable</span>, and{' '}
                  <span className="text-primary">actionable</span> for everyone.
                </h2>
                <p className="text-lg text-muted-foreground font-light leading-relaxed">
                  At Tribora, we believe that valuable knowledge shouldn't be locked away in people's
                  heads or buried in hours of video content. We're building the future of knowledge management—
                  where capturing expertise is as simple as recording your screen, and finding answers is as
                  easy as asking a question.
                </p>
              </motion.div>

              {/* Positioning */}
              <motion.div variants={fadeInUp}>
                <Badge
                  variant="outline"
                  className="mb-6 px-4 py-2 rounded-full
                    bg-secondary/10 backdrop-blur-sm border-secondary/30"
                >
                  <span className="text-sm font-medium text-secondary">What We're Not</span>
                </Badge>
                <div className="grid sm:grid-cols-3 gap-6">
                  {[
                    { label: 'NOT a Loom replacement', detail: 'We capture expertise, not messages' },
                    { label: 'NOT a meeting tool', detail: 'We understand workflows, not just audio' },
                    { label: 'NOT storage', detail: 'We\'re the intelligence layer above storage' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="p-6 rounded-xl bg-card/30 border border-border/50"
                    >
                      <p className="font-medium text-foreground mb-2">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* VALUES SECTION */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[30%] right-[5%] w-[500px] h-[500px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
              blur-[100px] animate-float"
            style={{ animationDelay: '1s' }}
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <motion.div
            className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <Badge
                variant="outline"
                className="mb-6 px-4 py-2 rounded-full
                  bg-accent/5 backdrop-blur-sm border-accent/30"
              >
                <span className="text-sm font-medium text-accent">Our Values</span>
              </Badge>
            </motion.div>

            <motion.h2
              variants={fadeInUp}
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight mb-6"
            >
              Principles that{' '}
              <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                guide us
              </span>
            </motion.h2>
          </motion.div>

          {/* Values Grid */}
          <motion.div
            className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {VALUES.map((value, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                className={cn(
                  'group relative p-8 rounded-2xl overflow-hidden',
                  'bg-card/50 backdrop-blur-sm',
                  'border border-border/50 hover:border-accent/30',
                  'transition-all duration-500 ease-smooth',
                  'hover:shadow-[0_0_40px_rgba(0,223,130,0.1)]'
                )}
              >
                <div className="relative z-10 flex gap-5">
                  {/* Icon */}
                  <div
                    className="shrink-0 w-12 h-12 rounded-xl
                      bg-accent/10 border border-accent/20
                      flex items-center justify-center
                      group-hover:shadow-[0_0_20px_rgba(0,223,130,0.2)]
                      transition-shadow duration-300"
                  >
                    <HugeiconsIcon icon={value.icon} size={24} className="text-accent" />
                  </div>

                  <div>
                    <h3 className="font-outfit text-lg font-medium mb-2 text-foreground">
                      {value.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* TIMELINE / JOURNEY */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        {/* Divider */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

        <div className="container px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <motion.div
            className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <Badge
                variant="outline"
                className="mb-6 px-4 py-2 rounded-full
                  bg-accent/5 backdrop-blur-sm border-accent/30"
              >
                <HugeiconsIcon icon={RocketIcon} size={14} className="mr-2 text-accent" />
                <span className="text-sm font-medium text-accent">Our Journey</span>
              </Badge>
            </motion.div>

            <motion.h2
              variants={fadeInUp}
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight mb-6"
            >
              Key{' '}
              <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                milestones
              </span>
            </motion.h2>
          </motion.div>

          {/* Timeline */}
          <div className="relative max-w-3xl mx-auto">
            {/* Timeline line */}
            <div
              className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px
                bg-gradient-to-b from-accent/50 via-secondary/30 to-transparent"
            />

            <div className="space-y-12">
              {MILESTONES.map((milestone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25, delay: index * 0.1 }}
                  className={cn(
                    'relative flex items-start gap-8',
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  )}
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute left-4 md:left-1/2 -ml-2 w-4 h-4 rounded-full
                      bg-accent border-4 border-background z-10
                      shadow-[0_0_15px_rgba(0,223,130,0.5)]"
                  />

                  {/* Content card */}
                  <div className={cn('flex-1 ml-12 md:ml-0', index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12')}>
                    <div
                      className="p-6 rounded-xl bg-card/50 backdrop-blur-sm
                        border border-border/50 hover:border-accent/30
                        shadow-md hover:shadow-[0_0_30px_rgba(0,223,130,0.1)]
                        transition-all duration-300"
                    >
                      <div
                        className={cn(
                          'inline-flex items-center gap-2 px-3 py-1 rounded-full',
                          'bg-accent/10 text-accent text-sm font-medium mb-3'
                        )}
                      >
                        {milestone.year} {milestone.quarter}
                      </div>
                      <h3 className="font-outfit text-lg font-medium mb-2">{milestone.title}</h3>
                      <p className="text-sm text-muted-foreground">{milestone.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* TEAM SECTION */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        {/* Background aurora */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[20%] left-[10%] w-[400px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.05)_0%,transparent_70%)]
              blur-[80px] animate-float"
            style={{ animationDelay: '1s' }}
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <motion.div
            className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <Badge
                variant="outline"
                className="mb-6 px-4 py-2 rounded-full
                  bg-accent/5 backdrop-blur-sm border-accent/30"
              >
                <HugeiconsIcon icon={UserGroupIcon} size={14} className="mr-2 text-accent" />
                <span className="text-sm font-medium text-accent">Meet the Team</span>
              </Badge>
            </motion.div>

            <motion.h2
              variants={fadeInUp}
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight mb-6"
            >
              The{' '}
              <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                builders
              </span>{' '}
              behind Tribora
            </motion.h2>

            <motion.p
              variants={fadeInUp}
              className="text-lg text-muted-foreground font-light"
            >
              Passionate about making knowledge accessible to everyone.
            </motion.p>
          </motion.div>

          {/* Team Grid */}
          <motion.div
            className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {TEAM.map((member, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                className="group text-center"
              >
                {/* Avatar */}
                <div className="relative mb-6 mx-auto">
                  <div
                    className="w-32 h-32 mx-auto rounded-2xl
                      bg-gradient-to-br from-accent/20 via-secondary/10 to-primary/20
                      border border-accent/20
                      flex items-center justify-center
                      group-hover:shadow-[0_0_30px_rgba(0,223,130,0.2)]
                      group-hover:border-accent/40
                      transition-all duration-300"
                  >
                    <span className="font-outfit text-3xl font-light text-accent">
                      {member.initials}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <h3 className="font-outfit text-xl font-medium mb-1">{member.name}</h3>
                <p className="text-accent font-medium text-sm mb-3">{member.role}</p>
                <p className="text-sm text-muted-foreground mb-4 px-4">{member.bio}</p>

                {/* Social Links */}
                <div className="flex gap-3 justify-center">
                  {member.social.linkedin && (
                    <a
                      href={member.social.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${member.name} on LinkedIn`}
                      className="w-10 h-10 rounded-full
                        bg-card border border-border/50
                        flex items-center justify-center
                        text-muted-foreground hover:text-accent
                        hover:border-accent/30 hover:bg-accent/10
                        transition-all duration-200"
                    >
                      <HugeiconsIcon icon={Linkedin01Icon} size={18} />
                    </a>
                  )}
                  {member.social.twitter && (
                    <a
                      href={member.social.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${member.name} on Twitter`}
                      className="w-10 h-10 rounded-full
                        bg-card border border-border/50
                        flex items-center justify-center
                        text-muted-foreground hover:text-accent
                        hover:border-accent/30 hover:bg-accent/10
                        transition-all duration-200"
                    >
                      <HugeiconsIcon icon={NewTwitterIcon} size={18} />
                    </a>
                  )}
                  {member.social.github && (
                    <a
                      href={member.social.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${member.name} on GitHub`}
                      className="w-10 h-10 rounded-full
                        bg-card border border-border/50
                        flex items-center justify-center
                        text-muted-foreground hover:text-accent
                        hover:border-accent/30 hover:bg-accent/10
                        transition-all duration-200"
                    >
                      <HugeiconsIcon icon={Github01Icon} size={18} />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA SECTION */}
      {/* ================================================================== */}
      <AuroraCTA />
    </div>
  );
}
