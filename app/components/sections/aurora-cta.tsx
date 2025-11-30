'use client';

import * as motion from 'motion/react-client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  SparklesIcon,
  PlayCircleIcon,
  ZapIcon,
} from '@hugeicons/core-free-icons';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';

// Animation variants
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
      delayChildren: 0.15,
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

/**
 * AuroraCTA - Premium call-to-action section with aurora gradient backgrounds
 *
 * Design inspired by Railway, Reflect, Wope with Tribora brand identity.
 * Features:
 * - Dramatic aurora gradient background as finale
 * - Centered headline with glow effect
 * - Dual CTA buttons with premium styling
 * - Floating accent elements for depth
 */

const AuroraCTA = () => {
  return (
    <section className="relative py-24 sm:py-32 lg:py-40 overflow-hidden">
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Base dark gradient */}
        <div
          className="absolute inset-0
            bg-gradient-to-b from-background via-background/95 to-background"
        />

        {/* Primary aurora orb - large, centered */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[800px] h-[800px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.15)_0%,transparent_60%)]
            blur-[100px] animate-pulse-slow"
        />

        {/* Secondary orbs for depth */}
        <div
          className="absolute top-[20%] left-[10%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.1)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-[20%] right-[10%] w-[350px] h-[350px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(3,98,76,0.1)_0%,transparent_70%)]
            blur-[60px] animate-float"
          style={{ animationDelay: '3s' }}
        />

        {/* Radial gradient overlay for depth */}
        <div
          className="absolute inset-0
            bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(3,14,16,0.8)_100%)]"
        />

        {/* Subtle noise texture */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          }}
        />

        {/* Top gradient fade from pricing */}
        <div
          className="absolute inset-x-0 top-0 h-32
            bg-gradient-to-b from-background to-transparent"
        />
      </div>

      {/* === FLOATING ACCENT ELEMENTS === */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating sparkle icons with Motion */}
        <motion.div
          className="absolute top-[15%] left-[15%] w-8 h-8 text-accent/30"
          animate={{
            y: [0, -15, 0],
            rotate: [0, 10, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <HugeiconsIcon icon={SparklesIcon} className="w-full h-full" />
        </motion.div>
        <motion.div
          className="absolute top-[25%] right-[20%] w-6 h-6 text-secondary/30"
          animate={{
            y: [0, -12, 0],
            rotate: [0, -8, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        >
          <HugeiconsIcon icon={ZapIcon} className="w-full h-full" />
        </motion.div>
        <motion.div
          className="absolute bottom-[30%] left-[20%] w-5 h-5 text-accent/20"
          animate={{
            y: [0, -10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 4,
          }}
        >
          <HugeiconsIcon icon={PlayCircleIcon} className="w-full h-full" />
        </motion.div>

        {/* Animated accent lines */}
        <motion.div
          className="absolute top-1/4 left-0 w-48 h-px
            bg-gradient-to-r from-transparent via-accent/20 to-transparent"
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
          style={{ originX: 0 }}
        />
        <motion.div
          className="absolute bottom-1/4 right-0 w-64 h-px
            bg-gradient-to-l from-transparent via-secondary/20 to-transparent"
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.7, ease: 'easeOut' }}
          style={{ originX: 1 }}
        />
      </div>

      {/* === CONTENT === */}
      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
        >
          {/* Badge */}
          <motion.div
            variants={scaleIn}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full
              bg-accent/10 backdrop-blur-sm
              border border-accent/30"
          >
            <HugeiconsIcon icon={SparklesIcon} size={16} className="text-accent" />
            <span className="text-sm font-medium text-accent">
              Start capturing knowledge today
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h2
            variants={fadeInUp}
            className="font-outfit text-4xl sm:text-5xl lg:text-6xl xl:text-7xl
              font-light leading-tight tracking-tight mb-6"
          >
            Ready to{' '}
            <span
              className="relative inline-block
                bg-gradient-to-r from-accent via-secondary to-accent
                bg-clip-text text-transparent
                bg-[length:200%_auto] animate-gradient-x"
            >
              illuminate
              {/* Glow effect behind text */}
              <span
                className="absolute inset-0 blur-2xl opacity-50
                  bg-gradient-to-r from-accent via-secondary to-accent"
                aria-hidden="true"
              />
            </span>
            <br className="hidden sm:block" />
            your team's knowledge?
          </motion.h2>

          {/* Subheadline */}
          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl lg:text-2xl text-muted-foreground
              font-light max-w-2xl mx-auto mb-10"
          >
            Join thousands of teams transforming tacit expertise into
            searchable, AI-powered intelligence.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center
              gap-4 sm:gap-6"
          >
            {/* Primary CTA */}
            <Link href="/sign-up">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Button
                  size="lg"
                  className={cn(
                    'h-14 px-8 text-base rounded-full group',
                    'bg-gradient-to-r from-accent to-secondary',
                    'text-accent-foreground font-medium',
                    'transition-shadow duration-300',
                    'hover:shadow-[0_0_40px_rgba(0,223,130,0.5)]'
                  )}
                >
                  <HugeiconsIcon icon={ZapIcon} size={20} className="mr-2" />
                  Start Free Today
                  <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            </Link>

            {/* Secondary CTA */}
            <Link href="/contact">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className={cn(
                    'h-14 px-8 text-base rounded-full group',
                    'border-accent/30 hover:border-accent/50',
                    'bg-transparent hover:bg-accent/5',
                    'transition-all duration-300'
                  )}
                >
                  <HugeiconsIcon icon={PlayCircleIcon} size={20} className="mr-2" />
                  Watch Demo
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            variants={fadeInUp}
            className="mt-12 pt-12 border-t border-border/30"
          >
            <p className="text-sm text-muted-foreground mb-6">
              Trusted by innovative teams at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
              {['TechCorp', 'StartupXYZ', 'InnovateTech', 'GrowthScale'].map(
                (company, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 25,
                      delay: 0.4 + index * 0.1,
                    }}
                    whileHover={{ scale: 1.1 }}
                    className={cn(
                      'text-muted-foreground/50 font-medium text-lg',
                      'transition-colors duration-300',
                      'hover:text-muted-foreground cursor-default'
                    )}
                  >
                    {company}
                  </motion.div>
                )
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient for footer transition */}
      <div
        className="absolute inset-x-0 bottom-0 h-32
          bg-gradient-to-t from-background to-transparent"
      />
    </section>
  );
};

export { AuroraCTA };
