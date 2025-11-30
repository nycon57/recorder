'use client';

import * as motion from 'motion/react-client';

import { cn } from '@/lib/utils';
import type { FeatureStatData } from '@/lib/data/features';

/**
 * FeatureStats - Metrics grid showing quantified impact
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
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springTransition,
  },
};

interface FeatureStatsProps {
  stats: FeatureStatData[];
}

export function FeatureStats({ stats }: FeatureStatsProps) {
  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-0 right-0 h-px
            bg-gradient-to-r from-transparent via-accent/20 to-transparent"
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-px
            bg-gradient-to-r from-transparent via-accent/20 to-transparent"
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className={cn(
                  'text-center p-6 sm:p-8 rounded-2xl',
                  'bg-card/30 backdrop-blur-sm',
                  'border border-border/30',
                  'transition-all duration-300',
                  'hover:border-accent/30',
                  'hover:shadow-[0_0_30px_rgba(0,223,130,0.1)]',
                  'group'
                )}
              >
                {/* Value */}
                <div
                  className={cn(
                    'text-3xl sm:text-4xl lg:text-5xl font-light mb-2',
                    'bg-gradient-to-r from-accent via-secondary to-accent',
                    'bg-clip-text text-transparent',
                    'transition-all duration-300',
                    'group-hover:drop-shadow-[0_0_20px_rgba(0,223,130,0.3)]'
                  )}
                >
                  {stat.value}
                </div>

                {/* Label */}
                <div className="text-base sm:text-lg font-medium text-foreground mb-1">
                  {stat.label}
                </div>

                {/* Description */}
                <div className="text-sm text-muted-foreground">
                  {stat.description}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
