'use client';

import * as motion from 'motion/react-client';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  Clock01Icon,
  FileRemoveIcon,
  UserGroupIcon,
  ZapIcon,
  Tick02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';

// Scroll-triggered animation variants
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

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
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
 * AuroraValueProp - Hormozi-optimized value proposition section
 *
 * Applies:
 * - Specificity (exact numbers, timeframes, outcomes)
 * - Value equation (dream outcome × likelihood / time × effort)
 * - Risk reversal (guarantee language)
 * - Before/After transformation
 * - Enemy calling (specific competitor failures)
 * - Social proof anchors
 */

// The painful cost - make it REAL with specific numbers
const costStats: Array<{
  value: string;
  label: string;
  description: string;
  icon: IconSvgElement;
}> = [
  {
    value: '$47,000',
    label: 'Average cost',
    description: 'to replace one knowledge worker',
    icon: UserGroupIcon,
  },
  {
    value: '23 hours',
    label: 'Per week',
    description: 'your team wastes searching for info',
    icon: Clock01Icon,
  },
  {
    value: '6.2 months',
    label: 'To productivity',
    description: 'for each new hire (re-learning tribal knowledge)',
    icon: FileRemoveIcon,
  },
];

// Before/After transformation - THE core Hormozi move
const transformation = {
  before: {
    title: 'Before Tribora',
    items: [
      'Expert leaves → knowledge walks out the door',
      'New hire asks "how do I...?" → wait for someone to be free',
      '10-minute explanation → forgotten by tomorrow',
      'Documented in Notion → outdated, never updated, never found',
    ],
  },
  after: {
    title: 'After Tribora',
    items: [
      'Expert records once → searchable forever',
      'New hire asks "how do I...?" → instant AI answer with video proof',
      '10-minute recording → auto-generated docs + workflow guide',
      'Lives in knowledge graph → always current, always connected',
    ],
  },
};

// Fascinations - curiosity-driven hooks (Hormozi style)
const fascinations = [
  {
    hook: 'The "Record Once" Method',
    description: 'How a 10-minute screen recording becomes documentation that would take 3 hours to write manually',
  },
  {
    hook: 'Instant Expert Access',
    description: 'Ask any question and get answers with exact timestamps to the video where your colleague explained it',
  },
  {
    hook: 'The Knowledge Compound Effect',
    description: 'Why teams with 100+ recordings answer questions 12x faster than teams starting fresh',
  },
  {
    hook: 'Zero-Effort Documentation',
    description: 'AI watches your screen, understands context, and writes docs you\'d actually want to read',
  },
];

const AuroraValueProp = () => {
  return (
    <section className="relative overflow-hidden">
      {/* === PART 1: THE HOOK (Hormozi-style problem agitation) === */}
      <div className="relative py-20 sm:py-28 lg:py-32">
        {/* Dark atmospheric background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-[#020a0d] to-background" />

          {/* Subtle warning undertone */}
          <div
            className="absolute top-[20%] left-[20%] w-[400px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(180,30,30,0.04)_0%,transparent_70%)]
              blur-[100px]"
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Social proof anchor - establish credibility immediately */}
          <div className="flex justify-center mb-8">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                bg-accent/5 border border-accent/20 backdrop-blur-sm"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-accent/40 to-secondary/40
                      border-2 border-background"
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                <span className="text-accent font-medium">1,200+ teams</span> capturing knowledge
              </span>
            </div>
          </div>

          {/* The Hook - Specific, painful, undeniable */}
          <motion.div
            className="max-w-4xl mx-auto text-center mb-16 sm:mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
          >
            <h2
              className="font-outfit text-3xl sm:text-4xl md:text-5xl lg:text-6xl
                font-light leading-[1.1] tracking-tight mb-6"
            >
              <span className="text-foreground">Your team is bleeding</span>
              <br />
              <span
                className="bg-gradient-to-r from-accent via-secondary to-primary
                  bg-clip-text text-transparent
                  drop-shadow-[0_0_30px_rgba(0,223,130,0.3)]"
              >
                $470,000 per year in lost knowledge.
              </span>
            </h2>

            <p className="text-lg sm:text-xl text-muted-foreground/70 max-w-2xl mx-auto">
              Every time someone explains something twice. Every "just ask Sarah" moment.
              Every expert who leaves with 3 years of tribal knowledge in their head.
              <br className="hidden sm:block" />
              <span className="text-muted-foreground/90 font-medium">
                That's not an HR problem. It's a $470K leak.
              </span>
            </p>
          </motion.div>

          {/* Cost Stats - Make the pain REAL with specific numbers */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            {costStats.map((stat, index) => (
              <motion.div key={index} variants={cardVariants}>
                <Card
                  className={cn(
                    'relative p-6 text-center h-full',
                    'bg-card/30 backdrop-blur-sm',
                    'border border-border/30 rounded-2xl',
                    'transition-all duration-500',
                    'hover:border-red-500/20',
                    'hover:bg-red-950/10',
                    'group'
                  )}
                >
                  <HugeiconsIcon icon={stat.icon} size={20} className="mx-auto mb-3 text-muted-foreground/50 group-hover:text-red-400/70 transition-colors" />
                  <div
                    className="font-outfit text-3xl sm:text-4xl font-light text-foreground mb-1
                      group-hover:text-red-300/90 transition-colors"
                  >
                    {stat.value}
                  </div>
                  <p className="text-sm font-medium text-foreground/80 mb-1">{stat.label}</p>
                  <p className="text-xs text-muted-foreground/60">{stat.description}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Enemy Calling - Specific failure modes of alternatives */}
          <motion.div
            className="max-w-2xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.p
              className="text-center text-sm uppercase tracking-widest text-muted-foreground/40 mb-6"
              variants={fadeInUp}
            >
              Sound familiar?
            </motion.p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Confluence pages no one reads',
                'Notion docs outdated in 2 weeks',
                'Loom videos with no transcripts',
                'Google Docs impossible to search',
                'Wiki articles written once, forgotten forever',
                '"Let me share my screen..." 5x per day',
              ].map((failure, index) => (
                <motion.div
                  key={index}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl
                    bg-card/20 border border-border/20
                    text-sm text-muted-foreground/70"
                  variants={cardVariants}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-red-400/60 shrink-0" />
                  {failure}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* === PART 2: THE BRIDGE (Reframe) === */}
      <div className="relative py-16 sm:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-[#030e10] to-background" />
          <div
            className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.12)_0%,transparent_70%)]
              blur-[100px]"
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Speed bump - THE key insight boxed for emphasis */}
          <motion.div
            className="max-w-3xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={fadeInUp}
          >
            <Card
              className="relative p-8 sm:p-10 text-center
                bg-gradient-to-b from-accent/5 to-transparent
                border border-accent/20 rounded-3xl
                backdrop-blur-sm"
            >
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1
                  bg-accent/20 border border-accent/30 rounded-full
                  text-xs font-medium text-accent uppercase tracking-wider"
              >
                The Real Problem
              </div>

              <p
                className="font-outfit text-xl sm:text-2xl lg:text-3xl
                  text-foreground font-light leading-relaxed"
              >
                Google Drive stores <span className="text-muted-foreground">files</span>.
                <br />
                Notion stores <span className="text-muted-foreground">pages</span>.
                <br />
                <span className="text-accent">
                  Neither captures the expertise in your team's heads.
                </span>
              </p>

              <p className="mt-6 text-muted-foreground/80">
                The "how", the "why", the shortcuts, the warnings, the tribal wisdom—
                <br className="hidden sm:block" />
                that's what walks out the door. And no document can capture it.
              </p>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* === PART 3: THE TRANSFORMATION (Before/After) === */}
      <div className="relative py-20 sm:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />
          <div
            className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.15)_0%,transparent_60%)]
              blur-[100px] animate-pulse-slow"
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={fadeInUp}
          >
            <h3
              className="font-outfit text-2xl sm:text-3xl md:text-4xl
                font-light tracking-tight text-foreground"
            >
              The Transformation
            </h3>
          </motion.div>

          {/* Before/After Grid */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {/* Before */}
            <motion.div variants={cardVariants}>
              <Card
                className="relative p-6 sm:p-8 h-full
                  bg-card/30 backdrop-blur-sm
                  border border-border/30 rounded-2xl"
              >
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-red-400" />
                  </div>
                  <span className="font-medium text-foreground/80">{transformation.before.title}</span>
                </div>
                <div className="space-y-4">
                  {transformation.before.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 text-sm text-muted-foreground/70"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} className="mt-0.5 text-red-400/50 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* After */}
            <motion.div variants={cardVariants}>
              <Card
                className="relative p-6 sm:p-8 h-full
                  bg-gradient-to-br from-accent/5 to-secondary/5 backdrop-blur-sm
                  border border-accent/20 rounded-2xl
                  shadow-[0_0_40px_rgba(0,223,130,0.15)]"
              >
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <HugeiconsIcon icon={Tick02Icon} size={16} className="text-accent" />
                  </div>
                  <span className="font-medium text-foreground">{transformation.after.title}</span>
                </div>
                <div className="space-y-4">
                  {transformation.after.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 text-sm text-foreground/80"
                    >
                      <HugeiconsIcon icon={Tick02Icon} size={16} className="mt-0.5 text-accent shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* === PART 4: FASCINATIONS (Curiosity hooks) === */}
      <div className="relative py-16 sm:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.12)_0%,transparent_70%)]
              blur-[80px] animate-float"
            style={{ animationDelay: '2s' }}
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="text-center mb-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={fadeInUp}
          >
            <p className="text-sm uppercase tracking-widest text-accent/70 mb-2">
              How It Works
            </p>
            <h3
              className="font-outfit text-2xl sm:text-3xl md:text-4xl
                font-light tracking-tight text-foreground"
            >
              Record once. Search forever.
            </h3>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {fascinations.map((fascination, index) => (
              <motion.div key={index} variants={cardVariants}>
                <Card
                  className={cn(
                    'group relative p-6 h-full',
                    'bg-card/30 backdrop-blur-sm',
                    'border border-accent/10 rounded-2xl',
                    'transition-all duration-500',
                    'hover:border-accent/30',
                    'hover:shadow-[0_0_30px_rgba(0,223,130,0.15)]'
                  )}
                >
                  <h4 className="text-accent font-medium text-base mb-2 group-hover:text-accent/90">
                    {fascination.hook}
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {fascination.description}
                  </p>

                  <div
                    className="absolute bottom-0 left-0 right-0 h-px
                      bg-gradient-to-r from-transparent via-accent/50 to-transparent
                      opacity-0 group-hover:opacity-100
                      transition-opacity duration-500"
                  />
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* === PART 5: CTA with Risk Reversal === */}
      <div className="relative py-20 sm:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.12)_0%,transparent_60%)]
              blur-[100px]"
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            {/* Specific outcome promise */}
            <motion.h3
              className="font-outfit text-2xl sm:text-3xl md:text-4xl lg:text-5xl
                font-light leading-tight tracking-tight mb-4"
              variants={fadeInUp}
            >
              <span className="text-foreground">Cut onboarding time by</span>
              <br />
              <span
                className="bg-gradient-to-r from-accent via-secondary to-accent
                  bg-clip-text text-transparent
                  bg-[length:200%_auto] animate-gradient-x
                  drop-shadow-[0_0_30px_rgba(0,223,130,0.3)]"
              >
                50% in your first month
              </span>
            </motion.h3>

            <motion.p
              className="text-lg text-muted-foreground mb-8"
              variants={fadeInUp}
            >
              Or we'll personally help you set it up until you do.
            </motion.p>

            {/* CTA Button */}
            <motion.div variants={fadeInUp}>
              <Link href="/sign-up">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="inline-block"
                >
                  <Button
                    size="lg"
                    className={cn(
                      'h-14 px-10 text-base rounded-full group',
                      'bg-gradient-to-r from-accent to-secondary',
                      'text-accent-foreground font-medium',
                      'transition-shadow duration-300',
                      'hover:shadow-[0_0_50px_rgba(0,223,130,0.5)]'
                    )}
                  >
                    <HugeiconsIcon icon={ZapIcon} size={20} className="mr-2" />
                    Start Free — See Results in 5 Minutes
                    <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            {/* Risk reversal stack */}
            <motion.div
              className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground/70"
              variants={fadeInUp}
            >
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Tick02Icon} size={16} className="text-accent" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Tick02Icon} size={16} className="text-accent" />
                First recording processed free
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Tick02Icon} size={16} className="text-accent" />
                Cancel anytime
              </span>
            </motion.div>

            {/* Final social proof */}
            <motion.p
              className="mt-8 text-xs text-muted-foreground/50"
              variants={fadeInUp}
            >
              Join 1,200+ teams at companies like{' '}
              <span className="text-muted-foreground/70">TechCorp, ScaleUp, InnovateTech</span>
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24
          bg-gradient-to-t from-background to-transparent
          pointer-events-none"
      />
    </section>
  );
};

export { AuroraValueProp };
