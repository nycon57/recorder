'use client';

import * as motion from 'motion/react-client';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';

/**
 * Feature Not Found Page
 *
 * Displayed when a user navigates to an invalid feature ID.
 * Aurora-styled 404 page with navigation back to features list.
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

export default function FeatureNotFound() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/95" />

        {/* Aurora orbs */}
        <div
          className="absolute top-[20%] right-[20%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_70%)]
            blur-[80px] animate-float"
        />
        <div
          className="absolute bottom-[30%] left-[10%] w-[300px] h-[300px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.06)_0%,transparent_70%)]
            blur-[60px] animate-float"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants}>
            <Badge
              variant="outline"
              className="mb-6 px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm
                border-accent/30"
            >
              <Search className="h-4 w-4 mr-2 text-accent" />
              <span className="text-sm font-medium text-accent">
                Feature Not Found
              </span>
            </Badge>
          </motion.div>

          {/* 404 Number */}
          <motion.div
            variants={itemVariants}
            className="mb-6"
          >
            <span
              className="text-8xl sm:text-9xl font-outfit font-light
                bg-gradient-to-r from-accent via-secondary to-primary
                bg-clip-text text-transparent
                drop-shadow-[0_0_40px_rgba(0,223,130,0.3)]"
            >
              404
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-outfit text-2xl sm:text-3xl lg:text-4xl font-light
              leading-tight tracking-tight mb-4"
          >
            This feature page doesn't exist
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-lg text-muted-foreground font-light mb-8"
          >
            The feature you're looking for may have been moved or doesn't exist yet.
            Check out our full feature list to find what you need.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/features">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springTransition}
              >
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-accent to-secondary
                    text-accent-foreground font-medium
                    px-6 py-5 rounded-full
                    hover:shadow-[0_0_40px_rgba(0,223,130,0.5)]
                    transition-shadow duration-300"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  View All Features
                </Button>
              </motion.div>
            </Link>

            <Link href="/">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springTransition}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-background/50 backdrop-blur-sm
                    border-accent/30 hover:border-accent/50
                    px-6 py-5 rounded-full
                    hover:bg-accent/5
                    transition-all duration-300"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Home
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
