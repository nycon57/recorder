'use client';

import * as motion from 'motion/react-client';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FeatureHeroData, IconName } from '@/lib/data/features';
import { FeatureIcon } from '@/lib/data/feature-icons';

/**
 * FeatureHero - Hero section for individual feature pages
 *
 * Adapted from aurora-hero.tsx pattern with feature-specific content.
 */

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

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

interface FeatureHeroProps {
  data: FeatureHeroData;
  icon: IconName;
}

export function FeatureHero({ data, icon }: FeatureHeroProps) {
  return (
    <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/95" />

        {/* Aurora orbs */}
        <div
          className="absolute top-[-10%] right-[10%] w-[600px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.15)_0%,transparent_70%)]
            blur-[80px] animate-float"
        />
        <div
          className="absolute bottom-[10%] left-[5%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.12)_0%,transparent_70%)]
            blur-[100px] animate-float"
          style={{ animationDelay: '2s' }}
        />

        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0
            bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,223,130,0.12),transparent_60%)]"
        />

        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.4]
            bg-[radial-gradient(rgba(0,223,130,0.4)_1px,transparent_1px)]
            [background-size:24px_24px]
            [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black_20%,transparent_70%)]"
        />
      </div>

      {/* === CONTENT === */}
      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6 sm:mb-8">
            <Badge
              variant="outline"
              className="px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm
                border-accent/30 hover:border-accent/50
                transition-all duration-300
                shadow-[0_0_20px_rgba(0,223,130,0.1)]"
            >
              <Sparkles className="h-3.5 w-3.5 mr-2 text-accent animate-pulse" />
              <span className="text-sm font-medium text-accent">{data.badge}</span>
            </Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-outfit text-4xl sm:text-5xl md:text-6xl lg:text-7xl
              font-light leading-[1.1] tracking-tight mb-6 sm:mb-8"
          >
            <span className="text-foreground">{data.headline}</span>{' '}
            <span
              className="bg-gradient-to-r from-accent via-secondary to-primary
                bg-clip-text text-transparent
                bg-[length:200%_auto] animate-gradient-x
                drop-shadow-[0_0_40px_rgba(0,223,130,0.4)]"
            >
              {data.highlightedText}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl lg:text-2xl text-muted-foreground
              font-light leading-relaxed max-w-3xl mx-auto mb-8 sm:mb-10"
          >
            {data.subtitle}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <Link href={data.primaryCta.href}>
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
                    transition-shadow duration-300
                    group"
                >
                  {data.primaryCta.text}
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </Link>

            <Link href={data.secondaryCta.href}>
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
                    transition-all duration-300"
                >
                  {data.secondaryCta.text}
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          {/* Feature Icon */}
          <motion.div
            variants={itemVariants}
            className="flex justify-center"
          >
            <motion.div
              className={cn(
                'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl',
                'bg-accent/10 backdrop-blur-sm',
                'border border-accent/20',
                'flex items-center justify-center',
                'shadow-[0_0_40px_rgba(0,223,130,0.2)]'
              )}
              whileHover={{
                scale: 1.1,
                backgroundColor: 'rgba(0, 223, 130, 0.2)',
                boxShadow: '0 0 60px rgba(0, 223, 130, 0.3)',
              }}
              transition={springTransition}
            >
              <FeatureIcon name={icon} className="h-10 w-10 sm:h-12 sm:w-12 text-accent" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 sm:h-32
          bg-gradient-to-t from-background to-transparent
          pointer-events-none"
      />
    </section>
  );
}
