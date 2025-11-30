'use client';

import { SignUp } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Zap, Search, Users, Brain } from 'lucide-react';
import Link from 'next/link';

/**
 * Sign Up Page - "Begin Your Journey"
 *
 * A premium, immersive sign-up experience with a two-column layout.
 * Left: Sign-up form in frosted glass card
 * Right: Animated feature showcase (hidden on mobile)
 *
 * Design Philosophy:
 * - This is the START of the user's knowledge journey
 * - Visual storytelling with staggered feature animations
 * - Warm, inviting copy that emphasizes transformation
 * - Trust indicators prominent for conversion
 */
export default function SignUpPage() {
  const shouldReduceMotion = useReducedMotion();

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Transcription',
      description: 'Convert screen recordings to searchable text in seconds',
    },
    {
      icon: Brain,
      title: 'Knowledge Extraction',
      description: 'Automatically generate documentation from your workflows',
    },
    {
      icon: Search,
      title: 'Semantic Search',
      description: 'Find any moment across all your recordings instantly',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Share knowledge across your entire organization',
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left Column - Sign Up Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 lg:px-8">
        {/* Back to Home - Top Left */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute top-6 left-6 md:top-8 md:left-8"
        >
          <Link
            href="/"
            className="group flex items-center gap-2 text-sm text-[rgb(170,203,196)] hover:text-[rgb(241,247,247)] transition-colors duration-200"
          >
            <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>Back to home</span>
          </Link>
        </motion.div>

        {/* Main Content Card */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.6, 0.6, 0, 1] }}
          className="w-full max-w-md"
        >
          {/* Frosted Glass Card */}
          <div
            className="relative rounded-2xl p-8 md:p-10"
            style={{
              background: 'rgba(4, 34, 34, 0.6)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(0, 223, 130, 0.1)',
              boxShadow: '0 0 60px rgba(0, 223, 130, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Logo */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex justify-center mb-8"
            >
              <Link href="/" className="flex items-center gap-3 group">
                {/* Logo Icon */}
                <div
                  className="flex size-10 items-center justify-center rounded-xl transition-shadow duration-300 group-hover:shadow-[0_0_20px_rgba(0,223,130,0.3)]"
                  style={{
                    background: 'linear-gradient(135deg, #03624c 0%, #2cc295 50%, #00df82 100%)',
                  }}
                >
                  <span className="text-[rgb(241,247,247)] font-bold text-lg">T</span>
                </div>
                {/* Logo Text */}
                <span
                  className="text-2xl font-light tracking-tight"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'rgb(241, 247, 247)',
                  }}
                >
                  Tribora
                </span>
              </Link>
            </motion.div>

            {/* Header */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-center mb-8"
            >
              <h1
                className="text-3xl md:text-4xl font-light tracking-tight mb-3"
                style={{
                  fontFamily: 'var(--font-heading)',
                  background: 'linear-gradient(135deg, #00df82 0%, #2cc295 50%, rgb(241,247,247) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Start your journey
              </h1>
              <p
                className="text-base"
                style={{ color: 'rgb(170, 203, 196)' }}
              >
                Create your account and illuminate your team&apos;s knowledge
              </p>
            </motion.div>

            {/* Clerk SignUp Component - Themed */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex justify-center"
            >
              <SignUp
                appearance={{
                  baseTheme: dark,
                  variables: {
                    colorPrimary: '#00df82',
                    colorBackground: 'transparent',
                    colorInputBackground: 'rgba(6, 48, 44, 0.5)',
                    colorInputText: 'rgb(241, 247, 247)',
                    colorText: 'rgb(241, 247, 247)',
                    colorTextSecondary: 'rgb(170, 203, 196)',
                    colorDanger: '#ef4444',
                    borderRadius: '0.75rem',
                    fontFamily: 'Inter, sans-serif',
                    fontFamilyButtons: 'Inter, sans-serif',
                  },
                  elements: {
                    rootBox: 'w-full',
                    card: 'bg-transparent shadow-none border-0 p-0 w-full',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    socialButtonsBlockButton: `
                      bg-[rgba(6,48,44,0.5)]
                      border border-[rgba(0,223,130,0.15)]
                      hover:bg-[rgba(6,48,44,0.8)]
                      hover:border-[rgba(0,223,130,0.3)]
                      transition-all duration-200
                      text-[rgb(241,247,247)]
                    `,
                    socialButtonsBlockButtonText: 'text-[rgb(241,247,247)] font-medium',
                    dividerLine: 'bg-[rgba(0,223,130,0.1)]',
                    dividerText: 'text-[rgb(170,203,196)]',
                    formFieldLabel: 'text-[rgb(170,203,196)] text-sm font-medium',
                    formFieldInput: `
                      bg-[rgba(6,48,44,0.5)]
                      border-[rgba(0,223,130,0.15)]
                      text-[rgb(241,247,247)]
                      placeholder:text-[rgb(111,125,125)]
                      focus:border-[rgba(0,223,130,0.4)]
                      focus:ring-[rgba(0,223,130,0.2)]
                      transition-all duration-200
                    `,
                    formButtonPrimary: `
                      bg-gradient-to-r from-[#03624c] via-[#2cc295] to-[#00df82]
                      hover:shadow-[0_0_30px_rgba(0,223,130,0.4)]
                      transition-all duration-200
                      font-medium
                    `,
                    footerActionLink: 'text-[#00df82] hover:text-[#2cc295] transition-colors',
                    identityPreviewEditButton: 'text-[#00df82] hover:text-[#2cc295]',
                    formFieldAction: 'text-[#00df82] hover:text-[#2cc295]',
                    alert: 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)] text-[rgb(241,247,247)]',
                    alertText: 'text-[rgb(241,247,247)]',
                    footer: 'hidden',
                  },
                }}
              />
            </motion.div>

            {/* Footer Link */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="mt-8 text-center"
            >
              <p className="text-sm" style={{ color: 'rgb(170, 203, 196)' }}>
                Already have an account?{' '}
                <Link
                  href="/sign-in"
                  className="font-medium transition-colors duration-200"
                  style={{ color: '#00df82' }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#2cc295')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#00df82')}
                >
                  Sign in
                </Link>
              </p>
            </motion.div>

            {/* Terms & Privacy */}
            <motion.p
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="mt-6 text-center text-xs"
              style={{ color: 'rgb(111, 125, 125)' }}
            >
              By signing up, you agree to our{' '}
              <Link href="/terms" className="underline underline-offset-2 hover:text-[rgb(170,203,196)] transition-colors">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-[rgb(170,203,196)] transition-colors">
                Privacy Policy
              </Link>
            </motion.p>
          </div>
        </motion.div>
      </div>

      {/* Right Column - Feature Showcase (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-12 relative">
        {/* Additional glow for this section */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 30% 50%, rgba(0,223,130,0.08) 0%, transparent 50%)',
          }}
        />

        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative max-w-lg"
        >
          {/* Headline */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-12"
          >
            <h2
              className="text-4xl xl:text-5xl font-light tracking-tight mb-4"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'rgb(241, 247, 247)',
              }}
            >
              Transform recordings into{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #00df82 0%, #2cc295 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                searchable knowledge
              </span>
            </h2>
            <p
              className="text-lg"
              style={{ color: 'rgb(170, 203, 196)' }}
            >
              Join thousands of teams using Tribora to capture, preserve, and share their expertise.
            </p>
          </motion.div>

          {/* Feature List */}
          <div className="space-y-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                className="flex items-start gap-4 group"
              >
                {/* Icon */}
                <div
                  className="flex-shrink-0 flex size-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(0,223,130,0.2)]"
                  style={{
                    background: 'rgba(0, 223, 130, 0.1)',
                    border: '1px solid rgba(0, 223, 130, 0.15)',
                  }}
                >
                  <feature.icon className="size-6" style={{ color: '#00df82' }} />
                </div>
                {/* Text */}
                <div>
                  <h3
                    className="text-base font-medium mb-1"
                    style={{ color: 'rgb(241, 247, 247)' }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'rgb(170, 203, 196)' }}
                  >
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Social Proof */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            className="mt-12 pt-8"
            style={{ borderTop: '1px solid rgba(0, 223, 130, 0.1)' }}
          >
            <div className="flex items-center gap-6">
              {/* Stats */}
              <div>
                <div
                  className="text-2xl font-light"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: '#00df82',
                  }}
                >
                  10,000+
                </div>
                <div className="text-sm" style={{ color: 'rgb(111, 125, 125)' }}>
                  Recordings processed
                </div>
              </div>
              <div
                className="w-px h-12"
                style={{ background: 'rgba(0, 223, 130, 0.1)' }}
              />
              <div>
                <div
                  className="text-2xl font-light"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: '#00df82',
                  }}
                >
                  500+
                </div>
                <div className="text-sm" style={{ color: 'rgb(111, 125, 125)' }}>
                  Teams onboarded
                </div>
              </div>
              <div
                className="w-px h-12"
                style={{ background: 'rgba(0, 223, 130, 0.1)' }}
              />
              <div>
                <div
                  className="text-2xl font-light"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: '#00df82',
                  }}
                >
                  99.9%
                </div>
                <div className="text-sm" style={{ color: 'rgb(111, 125, 125)' }}>
                  Uptime SLA
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
