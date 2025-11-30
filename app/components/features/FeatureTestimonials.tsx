'use client';

import * as motion from 'motion/react-client';
import { Quote, MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import type { TestimonialData } from '@/lib/data/features';

/**
 * FeatureTestimonials - User quotes for this feature
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
      staggerChildren: 0.15,
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

interface FeatureTestimonialsProps {
  testimonials: TestimonialData[];
}

export function FeatureTestimonials({ testimonials }: FeatureTestimonialsProps) {
  if (!testimonials.length) return null;

  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[40%] left-[50%] -translate-x-1/2
            w-[600px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
            blur-[100px]"
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
              <MessageSquare className="h-4 w-4 mr-2 text-accent" />
              <span className="text-sm font-medium text-accent">What Users Say</span>
            </Badge>

            <h2
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
                leading-tight tracking-tight"
            >
              <span className="text-foreground">Loved by </span>
              <span
                className="bg-gradient-to-r from-accent via-secondary to-primary
                  bg-clip-text text-transparent"
              >
                teams
              </span>
            </h2>
          </motion.div>

          {/* Testimonials Grid */}
          <div
            className={cn(
              'grid gap-6 lg:gap-8',
              testimonials.length === 1
                ? 'grid-cols-1 max-w-2xl mx-auto'
                : 'grid-cols-1 md:grid-cols-2'
            )}
          >
            {testimonials.map((testimonial, index) => {
              // Generate initials from author name
              const initials = testimonial.author
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase();

              return (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className={cn(
                    'relative p-6 sm:p-8 rounded-2xl',
                    'bg-card/50 backdrop-blur-sm',
                    'border border-border/50',
                    'transition-all duration-500',
                    'hover:border-accent/30',
                    'hover:shadow-[0_0_40px_rgba(0,223,130,0.1)]',
                    'group'
                  )}
                >
                  {/* Quote Icon */}
                  <Quote
                    className={cn(
                      'absolute top-4 right-4 h-8 w-8',
                      'text-accent/20',
                      'transition-all duration-300',
                      'group-hover:text-accent/40'
                    )}
                  />

                  {/* Quote Text */}
                  <p className="text-lg sm:text-xl text-foreground/90 font-light leading-relaxed mb-6 pr-8">
                    "{testimonial.quote}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <Avatar
                      className={cn(
                        'h-12 w-12',
                        'border-2 border-accent/20',
                        'transition-all duration-300',
                        'group-hover:border-accent/40'
                      )}
                    >
                      <AvatarFallback className="bg-accent/10 text-accent font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-foreground">
                        {testimonial.author}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role} · {testimonial.company}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
