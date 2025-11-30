'use client';

import * as motion from 'motion/react-client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  PlayCircleIcon,
  SparklesIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import Link from 'next/link';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';

// Spring configuration for natural feel (brand-compliant: max 500ms perceived duration)
const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

// Stagger configuration for children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
};

// Product preview has its own special entrance
const previewVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 25,
      delay: 0.3,
    },
  },
};

/**
 * AuroraHero - Premium hero section with flowing aurora gradient backgrounds
 *
 * Design inspired by Railway, Reflect, Wope, and Resend with Tribora brand identity.
 * Features:
 * - Radial aurora gradient with dot pattern overlay
 * - Animated floating orbs
 * - Glass-effect badge
 * - Gradient text with glow
 * - Responsive design for all breakpoints
 * - Smooth animations with brand easing
 */

interface AuroraHeroProps {
  badge?: string;
  title?: React.ReactNode;
  subtitle?: string;
  primaryCta?: {
    text: string;
    href: string;
  };
  secondaryCta?: {
    text: string;
    onClick?: () => void;
  };
  showTrustIndicators?: boolean;
  showProductPreview?: boolean;
  className?: string;
}

const AuroraHero = ({
  badge = 'The Knowledge Intelligence Layer',
  title,
  subtitle = 'Capture once, understand forever. Transform screen recordings into structured, searchable documentation that compounds in value over time.',
  primaryCta = { text: 'Start Free Trial', href: '/sign-up' },
  secondaryCta = { text: 'Watch Demo', onClick: undefined },
  showTrustIndicators = true,
  showProductPreview = true,
  className,
}: AuroraHeroProps) => {
  return (
    <section
      className={cn(
        'relative min-h-screen flex items-center justify-center overflow-hidden bg-background',
        className
      )}
    >
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Base gradient - subtle dark to darker */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/95" />

        {/* Aurora orbs - animated floating gradients */}
        <div
          className="absolute top-[-10%] right-[10%] w-[600px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.15)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="absolute bottom-[10%] left-[5%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.12)_0%,transparent_70%)]
            blur-[100px] animate-float"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(3,98,76,0.08)_0%,transparent_60%)]
            blur-[120px] animate-pulse-slow"
        />

        {/* Radial gradient overlay from top center */}
        <div
          className="absolute inset-0
            bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,223,130,0.12),transparent_60%)]"
        />

        {/* Dot pattern overlay - subtle texture */}
        <div
          className="absolute inset-0 opacity-[0.4]
            bg-[radial-gradient(rgba(0,223,130,0.4)_1px,transparent_1px)]
            [background-size:24px_24px]
            [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black_20%,transparent_70%)]"
        />

        {/* Fine grid lines */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,223,130,0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,223,130,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
          }}
        />

        {/* Noise texture for depth */}
        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* === CONTENT === */}
      <div className="relative z-10 container px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 lg:pt-28 pb-16">
        <motion.div
          className="mx-auto max-w-5xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div
            className="flex justify-center mb-6 sm:mb-8"
            variants={itemVariants}
          >
            <Badge
              variant="outline"
              className="px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm
                border-accent/30 hover:border-accent/50
                transition-all duration-300
                shadow-[0_0_20px_rgba(0,223,130,0.1)]"
            >
              <HugeiconsIcon icon={SparklesIcon} size={14} className="mr-2 text-accent animate-pulse" />
              <span className="text-sm font-medium text-accent">{badge}</span>
            </Badge>
          </motion.div>

          {/* Main Headline */}
          <motion.div
            className="text-center mb-6 sm:mb-8"
            variants={itemVariants}
          >
            {title || (
              <h1 className="font-outfit text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light leading-[1.1] tracking-tight">
                <span className="text-foreground">Illuminate your</span>
                <br className="hidden sm:block" />
                <span className="inline sm:hidden"> </span>
                <span
                  className="bg-gradient-to-r from-accent via-secondary to-primary
                    bg-clip-text text-transparent
                    bg-[length:200%_auto] animate-gradient-x
                    drop-shadow-[0_0_40px_rgba(0,223,130,0.4)]"
                >
                  tribe's knowledge
                </span>
              </h1>
            )}
          </motion.div>

          {/* Subtitle */}
          <motion.p
            className="text-center text-lg sm:text-xl lg:text-2xl text-muted-foreground
              font-light leading-relaxed max-w-3xl mx-auto mb-8 sm:mb-10 lg:mb-12"
            variants={itemVariants}
          >
            {subtitle}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-10"
            variants={itemVariants}
          >
            <Link href={primaryCta.href} className="w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springTransition}
              >
                <Button
                  size="lg"
                  className="w-full sm:w-auto
                    bg-gradient-to-r from-accent to-secondary
                    text-accent-foreground font-medium
                    px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg
                    rounded-full
                    hover:shadow-[0_0_40px_rgba(0,223,130,0.5)]
                    transition-shadow duration-300 ease-smooth
                    group"
                >
                  {primaryCta.text}
                  <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </Link>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
            >
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto
                  bg-background/50 backdrop-blur-sm
                  border-accent/30 hover:border-accent/50
                  text-foreground hover:text-accent
                  px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg
                  rounded-full
                  hover:bg-accent/5
                  transition-all duration-300
                  group"
                onClick={secondaryCta.onClick}
              >
                <HugeiconsIcon icon={PlayCircleIcon} size={20} className="mr-2 group-hover:scale-110 transition-transform" />
                {secondaryCta.text}
              </Button>
            </motion.div>
          </motion.div>

          {/* Trust Indicators */}
          {showTrustIndicators && (
            <motion.div
              className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-muted-foreground"
              variants={itemVariants}
            >
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={Tick02Icon} size={16} className="text-accent" />
                Free 14-day trial
              </span>
              <span className="hidden sm:flex items-center gap-2">
                <HugeiconsIcon icon={Tick02Icon} size={16} className="text-accent" />
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={Tick02Icon} size={16} className="text-accent" />
                Cancel anytime
              </span>
            </motion.div>
          )}

          {/* Product Preview */}
          {showProductPreview && (
            <motion.div
              className="mt-12 sm:mt-16 lg:mt-20 relative"
              variants={previewVariants}
            >
              {/* Glow behind the preview */}
              <div
                className="absolute inset-0 -inset-x-4 sm:-inset-x-8
                  bg-gradient-to-r from-accent/20 via-secondary/15 to-accent/20
                  blur-3xl opacity-50 -z-10"
              />

              {/* Preview container with glass effect */}
              <div
                className="relative rounded-xl sm:rounded-2xl overflow-hidden
                  bg-card/80 backdrop-blur-xl
                  border border-accent/20
                  shadow-[0_0_60px_rgba(0,223,130,0.15)]
                  p-1.5 sm:p-2"
              >
                {/* Inner content area */}
                <div
                  className="aspect-video rounded-lg sm:rounded-xl overflow-hidden
                    bg-gradient-to-br from-accent/10 via-card to-secondary/10
                    flex items-center justify-center"
                >
                  <div className="text-center p-8">
                    <motion.div
                      className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4
                        rounded-full bg-accent/10 backdrop-blur-sm
                        border border-accent/20
                        flex items-center justify-center
                        cursor-pointer"
                      whileHover={{
                        scale: 1.1,
                        backgroundColor: 'rgba(0, 223, 130, 0.2)',
                        boxShadow: '0 0 40px rgba(0, 223, 130, 0.3)'
                      }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <HugeiconsIcon icon={PlayCircleIcon} className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
                    </motion.div>
                    <p className="text-muted-foreground font-light">
                      See Tribora in action
                    </p>
                  </div>
                </div>

                {/* Subtle border beam effect */}
                <div
                  className="absolute inset-0 rounded-xl sm:rounded-2xl
                    pointer-events-none overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-px
                      bg-gradient-to-r from-transparent via-accent/50 to-transparent"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* === BOTTOM FADE === */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 sm:h-32
          bg-gradient-to-t from-background to-transparent
          pointer-events-none"
      />
    </section>
  );
};

export { AuroraHero };
export type { AuroraHeroProps };
