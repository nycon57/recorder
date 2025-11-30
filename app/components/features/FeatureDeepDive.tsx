'use client';

import * as motion from 'motion/react-client';
import { Layers } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import type { FeatureDeepDiveData } from '@/lib/data/features';
import { FeatureIcon } from '@/lib/data/feature-icons';

/**
 * FeatureDeepDive - Bento grid for detailed capabilities
 *
 * Adapted from aurora-features.tsx bento pattern.
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
      staggerChildren: 0.08,
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

interface FeatureDeepDiveProps {
  data: FeatureDeepDiveData;
}

export function FeatureDeepDive({ data }: FeatureDeepDiveProps) {
  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_70%)]
            blur-[80px] animate-float"
        />
        <div
          className="absolute bottom-[20%] left-[10%] w-[350px] h-[350px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.06)_0%,transparent_70%)]
            blur-[60px] animate-float"
          style={{ animationDelay: '3s' }}
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
          <motion.div variants={itemVariants} className="text-center mb-12 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-6 px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm border-accent/30"
            >
              <Layers className="h-4 w-4 mr-2 text-accent" />
              <span className="text-sm font-medium text-accent">Deep Dive</span>
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

          {/* 2x2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {data.items.map((item, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
              >
                  <Card
                    className={cn(
                      'h-full rounded-2xl',
                      'bg-card/50 backdrop-blur-sm',
                      'border border-border/50',
                      'transition-all duration-500',
                      'hover:border-accent/30',
                      'hover:shadow-[0_0_40px_rgba(0,223,130,0.1)]',
                      'group'
                    )}
                  >
                    <CardContent className="p-6 sm:p-8 h-full flex flex-col">
                      {/* Icon */}
                      <div
                        className="shrink-0 w-12 h-12 rounded-xl mb-4
                          bg-accent/10
                          flex items-center justify-center
                          transition-all duration-300
                          group-hover:bg-accent/20 group-hover:scale-110"
                      >
                        <FeatureIcon
                          name={item.icon}
                          className="h-6 w-6 text-accent"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <h3
                          className="font-outfit font-medium mb-2 text-lg
                            group-hover:text-accent transition-colors"
                        >
                          {item.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
