'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  Play,
  Sparkles,
  Check,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/app/components/ui/button';

export default function PremiumHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#01001a]">
      {/* Epic Animated Background */}
      <div className="absolute inset-0">
        {/* Neon glow orbs */}
        <div className="absolute top-0 right-1/4 h-[600px] w-[600px] rounded-full
          bg-[#00DF81]/20 blur-[135px] mix-blend-lighten animate-pulse-slow" />
        <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full
          bg-[#2CC295]/15 blur-[100px] mix-blend-lighten animate-float" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          h-[400px] w-[400px] rounded-full bg-[#016A4C]/10 blur-[80px]
          mix-blend-lighten opacity-60 animate-pulse-slow" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #00DF81 1px, transparent 1px),
              linear-gradient(to bottom, #00DF81 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }}
        />

        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,223,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(44,194,149,0.1),transparent_50%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 container px-6 pt-24 pb-16">
        <div className="max-w-6xl mx-auto">
          {/* Live Pulse Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full
              glass-caribbean border border-[#00DF81]/30 shadow-[0_0_30px_rgba(0,223,129,0.3)]">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full
                  bg-[#00DF81] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00DF81]"></span>
              </span>
              <span className="text-sm font-semibold text-[#00DF81] tracking-wide">
                LIVE AI KNOWLEDGE ENGINE
              </span>
            </div>
          </motion.div>

          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-center mb-8"
          >
            <h1 className="text-7xl md:text-8xl lg:text-9xl font-black leading-[0.9] tracking-tight mb-6">
              <span className="inline-block text-[#F1F7F6]">
                Capture.
              </span>
              <br />
              <span className="inline-block bg-gradient-to-r from-[#00DF81] via-[#2CC295] to-[#17BF6D]
                bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]
                drop-shadow-[0_0_40px_rgba(0,223,129,0.6)]">
                Transform.
              </span>
              <br />
              <span className="inline-block text-[#F1F7F6]/80">
                Retrieve.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-[#AAC8C4] max-w-3xl mx-auto leading-relaxed">
              Turn meetings, interviews, and expert knowledge into{' '}
              <span className="text-[#00DF81] font-semibold">AI-searchable intelligence</span>{' '}
              instantly.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
          >
            <Link href="/sign-up">
              <Button
                size="lg"
                className="group relative px-8 py-6 text-lg font-bold
                  bg-gradient-to-r from-[#00DF81] to-[#2CC295]
                  hover:shadow-[0_0_50px_rgba(0,223,129,0.6)]
                  transition-all duration-300
                  border-0 text-[#01001a]
                  before:absolute before:inset-0 before:rounded-lg
                  before:bg-white/20 before:opacity-0 hover:before:opacity-100
                  before:transition-opacity"
              >
                <Zap className="h-5 w-5 mr-2" />
                Start Free - No Credit Card
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-2 transition-transform" />
              </Button>
            </Link>

            <Button
              size="lg"
              variant="ghost"
              className="px-8 py-6 text-lg font-semibold
                glass-caribbean border border-[#00DF81]/20
                text-[#00DF81] hover:bg-[#00DF81]/10
                transition-all duration-300"
            >
              <Play className="h-5 w-5 mr-2" />
              Watch 2min Demo
            </Button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#AAC8C4]"
          >
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#00DF81]" />
              Free 14-day trial
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#00DF81]" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#00DF81]" />
              Cancel anytime
            </span>
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#2CC295]" />
              Join 10,000+ teams
            </span>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto"
          >
            {[
              { value: '10K+', label: 'Recordings Processed' },
              { value: '95%', label: 'AI Accuracy Rate' },
              { value: '< 2min', label: 'Avg Processing Time' },
            ].map((stat, index) => (
              <div
                key={index}
                className="text-center p-6 rounded-2xl glass-dark border border-[#00DF81]/10
                  hover:border-[#00DF81]/30 transition-all duration-300 group"
              >
                <div className="text-4xl font-black text-[#00DF81] mb-2
                  group-hover:scale-110 transition-transform">
                  {stat.value}
                </div>
                <div className="text-sm text-[#AAC8C4]">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom fade gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#01001a] to-transparent" />
    </section>
  );
}
