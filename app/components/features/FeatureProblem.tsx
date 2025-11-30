'use client';

import * as motion from 'motion/react-client';
import { Quote } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { FeatureProblemData } from '@/lib/data/features';
import { FeatureIcon } from '@/lib/data/feature-icons';

/**
 * FeatureProblem - Pain points section to create emotional connection
 *
 * Shows the "before" state and user pain points.
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
      delayChildren: 0.2,
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

interface FeatureProblemProps {
  data: FeatureProblemData;
}

export function FeatureProblem({ data }: FeatureProblemProps) {
  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top border */}
        <div
          className="absolute top-0 left-0 right-0 h-px
            bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
        />

        {/* Subtle red glow for problem context */}
        <div
          className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2
            w-[600px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.05)_0%,transparent_70%)]
            blur-[100px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-5xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {/* Headline */}
          <motion.h2
            variants={itemVariants}
            className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
              leading-tight tracking-tight text-center mb-12 sm:mb-16"
          >
            <span className="text-red-400/90">{data.headline}</span>
          </motion.h2>

          {/* Pain Points Grid */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-12 sm:mb-16">
            {data.painPoints.map((point, index) => {
              return (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className={cn(
                    'relative p-6 sm:p-8 rounded-2xl',
                    'bg-card/30 backdrop-blur-sm',
                    'border border-red-500/10 hover:border-red-500/20',
                    'transition-all duration-300',
                    'group'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl mb-4',
                      'bg-red-500/10',
                      'flex items-center justify-center',
                      'transition-all duration-300',
                      'group-hover:bg-red-500/15 group-hover:scale-110'
                    )}
                  >
                    <FeatureIcon name={point.icon} className="h-6 w-6 text-red-400" />
                  </div>

                  {/* Title */}
                  <h3 className="font-outfit text-xl font-medium mb-2 text-foreground">
                    {point.title}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed">
                    {point.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Quote */}
          {data.quote && (
            <motion.div
              variants={itemVariants}
              className={cn(
                'relative max-w-3xl mx-auto p-8 sm:p-10 rounded-2xl',
                'bg-card/50 backdrop-blur-sm',
                'border border-border/50'
              )}
            >
              <Quote className="absolute top-4 left-4 h-8 w-8 text-red-400/30" />

              <blockquote className="text-center">
                <p className="text-xl sm:text-2xl text-foreground/90 font-light italic mb-4">
                  "{data.quote.text}"
                </p>
                <footer className="text-muted-foreground">
                  <span className="font-medium">{data.quote.author}</span>
                  <span className="mx-2">·</span>
                  <span>{data.quote.role}</span>
                </footer>
              </blockquote>

              <Quote className="absolute bottom-4 right-4 h-8 w-8 text-red-400/30 rotate-180" />
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
