'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  Zap,
  Users,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';

const STATS = [
  { icon: Users, value: '10K+', label: 'Active Users' },
  { icon: TrendingUp, value: '1M+', label: 'Recordings Processed' },
  { icon: CheckCircle2, value: '95%', label: 'Satisfaction Rate' },
];

export type ModernCTAProps = {
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  showStats?: boolean;
  showAvatars?: boolean;
  promoText?: string | null;
};

export default function ModernCTA({
  title = "Ready to Transform Your Team's Knowledge?",
  description = "Join thousands of teams using Record to capture, document, and share expertise. Start recording in under 60 seconds—no credit card required.",
  primaryLabel = "Start Free Today",
  secondaryLabel = "Book a Demo",
  showStats = true,
  showAvatars = true,
  promoText = "Limited Time: Get 2 Months Free on Annual Plans",
}: ModernCTAProps) {
  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/10 to-primary/20" />

        {/* Animated orbs */}
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/20 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="relative z-10 container px-6">
        <div className="max-w-6xl mx-auto">
          {/* Main Content */}
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
            {/* Left Column - Text & CTA */}
            <div>
              {/* CONFIGURABLE: Promotional badge (pass promoText or null to hide) */}
              {promoText && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="inline-flex h-10 items-center justify-center gap-2 rounded-full border-2 border-primary bg-primary/10 px-5 text-sm font-semibold text-primary backdrop-blur-sm mb-6">
                    <Sparkles className="h-4 w-4" />
                    {promoText}
                  </span>
                </motion.div>
              )}

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-heading-2 mb-6 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent"
              >
                {title}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-muted-foreground mb-8 max-w-xl"
              >
                {description}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 mb-8"
              >
                <Link href="/sign-up">
                  <Button size="lg" className="group relative overflow-hidden text-lg px-8 py-6">
                    <span className="relative z-10 flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      {primaryLabel}
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-primary/20"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  {secondaryLabel}
                </Button>
              </motion.div>

              {/* Social Proof */}
              {showAvatars && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="flex items-center gap-4"
                >
                  <div className="flex -space-x-2">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-full border-2 border-background bg-muted overflow-hidden"
                      >
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-500/20" />
                      </div>
                    ))}
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold">Join 10,000+ teams</div>
                    <div className="text-muted-foreground">already using Record</div>
                  </div>
                </motion.div>
              )}

              {/* Stats */}
              {showStats && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="grid grid-cols-3 gap-6 pt-8 mt-8 border-t border-border"
                >
                  {STATS.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div key={index} className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4 text-primary" />
                          <div className="text-2xl font-bold">{stat.value}</div>
                        </div>
                        <div className="text-sm text-muted-foreground">{stat.label}</div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* Right Column - Layered Images */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative h-[500px]">
                {/* Back Card - Angled */}
                <motion.div
                  className="absolute top-0 left-8 w-80 h-80 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
                  style={{ transform: 'rotate(-6deg)' }}
                  whileHover={{ scale: 1.05, rotate: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-8">
                      <div className="text-6xl font-bold text-primary mb-2">95%</div>
                      <div className="text-sm text-muted-foreground">Accuracy Rate</div>
                    </div>
                  </div>
                </motion.div>

                {/* Front Card - Angled */}
                <motion.div
                  className="absolute bottom-0 right-0 w-80 h-80 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-10"
                  style={{ transform: 'rotate(6deg)' }}
                  whileHover={{ scale: 1.05, rotate: 8 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-primary/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-8">
                      <div className="text-6xl font-bold text-primary mb-2">&lt;2min</div>
                      <div className="text-sm text-muted-foreground">Processing Time</div>
                    </div>
                  </div>
                </motion.div>

                {/* Floating Elements */}
                <motion.div
                  className="absolute top-1/4 right-1/4 w-16 h-16 rounded-full bg-primary/20 backdrop-blur-xl border border-primary/30 flex items-center justify-center"
                  animate={{
                    y: [0, -20, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Sparkles className="h-8 w-8 text-primary" />
                </motion.div>

                <motion.div
                  className="absolute bottom-1/4 left-1/4 w-12 h-12 rounded-full bg-purple-500/20 backdrop-blur-xl border border-purple-500/30 flex items-center justify-center"
                  animate={{
                    y: [0, 20, 0],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5,
                  }}
                >
                  <Zap className="h-6 w-6 text-purple-500" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
