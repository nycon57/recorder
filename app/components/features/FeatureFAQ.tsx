'use client';

import { useState } from 'react';
import * as motion from 'motion/react-client';
import { HelpCircle, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import type { FAQItem } from '@/lib/data/features';

/**
 * FeatureFAQ - Accordion FAQ section
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

interface FeatureFAQProps {
  items: FAQItem[];
}

export function FeatureFAQ({ items }: FeatureFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!items.length) return null;

  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.05)_0%,transparent_70%)]
            blur-[80px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-3xl mx-auto"
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
              <HelpCircle className="h-4 w-4 mr-2 text-accent" />
              <span className="text-sm font-medium text-accent">FAQ</span>
            </Badge>

            <h2
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
                leading-tight tracking-tight"
            >
              <span className="text-foreground">Frequently asked </span>
              <span
                className="bg-gradient-to-r from-accent via-secondary to-primary
                  bg-clip-text text-transparent"
              >
                questions
              </span>
            </h2>
          </motion.div>

          {/* FAQ Accordion */}
          <div className="space-y-4">
            {items.map((item, index) => {
              const isOpen = openIndex === index;

              return (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className={cn(
                    'rounded-xl overflow-hidden',
                    'bg-card/50 backdrop-blur-sm',
                    'border',
                    isOpen ? 'border-accent/30' : 'border-border/50',
                    'transition-all duration-300'
                  )}
                >
                  {/* Question */}
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className={cn(
                      'w-full flex items-center justify-between',
                      'p-5 sm:p-6 text-left',
                      'transition-colors duration-300',
                      'hover:bg-accent/5'
                    )}
                  >
                    <span className="font-medium text-foreground pr-4">
                      {item.question}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={springTransition}
                      className="shrink-0"
                    >
                      <ChevronDown
                        className={cn(
                          'h-5 w-5',
                          isOpen ? 'text-accent' : 'text-muted-foreground'
                        )}
                      />
                    </motion.div>
                  </button>

                  {/* Answer */}
                  <motion.div
                    initial={false}
                    animate={{
                      height: isOpen ? 'auto' : 0,
                      opacity: isOpen ? 1 : 0,
                    }}
                    transition={springTransition}
                    className="overflow-hidden"
                  >
                    <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0">
                      <p className="text-muted-foreground leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
