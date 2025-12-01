'use client';

import * as motion from 'motion/react-client';
import { ArrowRight, Grid } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { FEATURES, type FeatureId } from '@/lib/data/features';
import { FeatureIcon } from '@/lib/data/feature-icons';

/**
 * FeatureRelated - Cross-links to related features
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

interface FeatureRelatedProps {
  currentFeatureId: FeatureId;
  relatedIds: FeatureId[];
}

export function FeatureRelated({ currentFeatureId, relatedIds }: FeatureRelatedProps) {
  const relatedFeatures = relatedIds
    .filter((id) => id !== currentFeatureId)
    .map((id) => FEATURES[id])
    .filter(Boolean);

  if (!relatedFeatures.length) return null;

  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-0 right-0 h-px
            bg-gradient-to-r from-transparent via-border/50 to-transparent"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-5xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <Badge
              variant="outline"
              className="mb-6 px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm border-accent/30"
            >
              <Grid className="h-4 w-4 mr-2 text-accent" />
              <span className="text-sm font-medium text-accent">Related Features</span>
            </Badge>

            <h2
              className="font-outfit text-3xl sm:text-4xl font-light
                leading-tight tracking-tight"
            >
              <span className="text-foreground">Explore </span>
              <span
                className="bg-gradient-to-r from-accent via-secondary to-primary
                  bg-clip-text text-transparent"
              >
                more
              </span>
            </h2>
          </motion.div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {relatedFeatures.map((feature) => {
              return (
                <motion.div key={feature.id} variants={itemVariants}>
                  <Link href={`/features/${feature.id}`}>
                    <Card
                      className={cn(
                        'h-full rounded-2xl',
                        'bg-card/50 backdrop-blur-sm',
                        'border border-border/50',
                        'transition-all duration-500',
                        'hover:border-accent/30',
                        'hover:shadow-[0_0_40px_rgba(0,223,130,0.15)]',
                        'group cursor-pointer'
                      )}
                    >
                      <CardContent className="p-6 sm:p-8">
                        {/* Icon */}
                        <div
                          className={cn(
                            'w-12 h-12 rounded-xl mb-4',
                            'bg-accent/10',
                            'flex items-center justify-center',
                            'transition-all duration-300',
                            'group-hover:bg-accent/20 group-hover:scale-110'
                          )}
                        >
                          <FeatureIcon name={feature.icon} className="h-6 w-6 text-accent" />
                        </div>

                        {/* Title */}
                        <h3
                          className={cn(
                            'font-outfit text-xl font-medium mb-2',
                            'text-foreground',
                            'group-hover:text-accent transition-colors'
                          )}
                        >
                          {feature.hero.headline} {feature.hero.highlightedText}
                        </h3>

                        {/* Description */}
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-2">
                          {feature.hero.subtitle}
                        </p>

                        {/* CTA */}
                        <div className="flex items-center text-accent text-sm font-medium">
                          Learn more
                          <ArrowRight
                            className={cn(
                              'h-4 w-4 ml-1',
                              'transition-transform duration-300',
                              'group-hover:translate-x-1'
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* View All Features */}
          <motion.div variants={itemVariants} className="text-center mt-10">
            <Link href="/features">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springTransition}
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-accent/30 hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
                >
                  View All Features
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
