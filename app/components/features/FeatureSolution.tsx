'use client';

import { useState } from 'react';
import * as motion from 'motion/react-client';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import type { FeatureSolutionData } from '@/lib/data/features';
import { FeatureIcon } from '@/lib/data/feature-icons';

/**
 * FeatureSolution - Tabbed solution breakdown
 *
 * Shows how the feature solves the problem with interactive tabs.
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

interface FeatureSolutionProps {
  data: FeatureSolutionData;
}

export function FeatureSolution({ data }: FeatureSolutionProps) {
  const [activeTab, setActiveTab] = useState(data.tabs[0]?.id || '');
  const activeTabData = data.tabs.find((t) => t.id === activeTab) || data.tabs[0];

  return (
    <section
      id="solution"
      className="relative py-16 sm:py-20 lg:py-24 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Aurora glow */}
        <div
          className="absolute top-[30%] left-[50%] -translate-x-1/2
            w-[800px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_70%)]
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
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-12 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-6 px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm border-accent/30"
            >
              <Check className="h-4 w-4 mr-2 text-accent" />
              <span className="text-sm font-medium text-accent">The Solution</span>
            </Badge>

            <h2
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
                leading-tight tracking-tight mb-4"
            >
              <span className="text-foreground">{data.headline.split(' ').slice(0, -1).join(' ')}</span>{' '}
              <span
                className="bg-gradient-to-r from-accent via-secondary to-primary
                  bg-clip-text text-transparent"
              >
                {data.headline.split(' ').slice(-1)}
              </span>
            </h2>

            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              {data.subtitle}
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div variants={itemVariants} className="mb-8 sm:mb-12">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
              {data.tabs.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 sm:px-6 py-3 rounded-full',
                      'transition-all duration-300',
                      'border',
                      isActive
                        ? 'bg-accent/20 border-accent/50 text-accent shadow-[0_0_20px_rgba(0,223,130,0.2)]'
                        : 'bg-card/50 border-border/50 text-muted-foreground hover:border-accent/30 hover:text-foreground'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={springTransition}
                  >
                    <FeatureIcon name={tab.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm sm:text-base font-medium">{tab.title}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
            className={cn(
              'grid lg:grid-cols-2 gap-8 lg:gap-12 items-center',
              'p-6 sm:p-8 lg:p-12 rounded-3xl',
              'bg-card/50 backdrop-blur-sm',
              'border border-accent/20',
              'shadow-[0_0_60px_rgba(0,223,130,0.1)]'
            )}
          >
            {/* Left: Description & Features */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl',
                    'bg-accent/20',
                    'flex items-center justify-center'
                  )}
                >
                  <FeatureIcon name={activeTabData.icon} className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-outfit text-2xl font-medium">
                  {activeTabData.title}
                </h3>
              </div>

              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                {activeTabData.description}
              </p>

              {/* Feature List */}
              <ul className="space-y-3">
                {activeTabData.features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, ...springTransition }}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={cn(
                        'shrink-0 w-5 h-5 rounded-full',
                        'bg-accent/20',
                        'flex items-center justify-center'
                      )}
                    >
                      <Check className="h-3 w-3 text-accent" />
                    </div>
                    <span className="text-foreground/90">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Right: Visual */}
            <div
              className={cn(
                'relative aspect-[4/3] rounded-2xl overflow-hidden',
                'bg-gradient-to-br from-accent/10 via-card to-secondary/10',
                'border border-accent/10'
              )}
            >
              {/* Aurora glow inside */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  w-[250px] h-[250px] rounded-full
                  bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.2)_0%,transparent_70%)]
                  blur-[60px] animate-pulse-slow"
              />

              {/* Icon placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className={cn(
                    'w-24 h-24 rounded-2xl',
                    'bg-accent/20 backdrop-blur-sm',
                    'flex items-center justify-center',
                    'border border-accent/30'
                  )}
                  whileHover={{ scale: 1.1 }}
                  transition={springTransition}
                >
                  <FeatureIcon name={activeTabData.icon} className="h-12 w-12 text-accent" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
