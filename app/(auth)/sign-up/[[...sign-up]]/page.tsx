'use client';

import { SignUp } from '@clerk/nextjs';
import { motion, useReducedMotion } from 'framer-motion';
import { Video, Sparkles, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';

/**
 * Sign Up Page
 * Modern two-column layout with branded left side and hero right side
 *
 * ACCESSIBILITY:
 * - Respects user's reduced motion preference (prefers-reduced-motion)
 * - All animations are conditionally disabled when shouldReduceMotion is true
 * - Ensures WCAG 2.1 compliance for motion-triggered vestibular disorders
 */
export default function SignUpPage() {
  // Accessibility: Detect if user prefers reduced motion
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left Column - Sign Up Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Header with Logo and Back Button */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity"
          >
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Video className="size-5" />
            </div>
            Record
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </div>

        {/* Centered Form Container */}
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 text-center">
              <h1 className="text-heading-2 mb-2">Create your account</h1>
              <p className="text-muted-foreground">
                Start capturing knowledge in minutes
              </p>
            </div>

            {/* Clerk SignUp Component */}
            <div className="flex justify-center">
              <SignUp
                appearance={{
                  elements: {
                    rootBox: "mx-auto",
                    card: "shadow-none border-0",
                  }
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Already have an account?{' '}
            <Link href="/sign-in" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Column - Hero Section */}
      <div className="relative hidden lg:flex bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

        {/* Content */}
        <div className="relative flex flex-col items-center justify-center p-12 text-center">
          <motion.div
            initial={{ opacity: shouldReduceMotion ? 1 : 0, scale: shouldReduceMotion ? 1 : 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.7, delay: shouldReduceMotion ? 0 : 0.2 }}
            className="space-y-6"
          >
            {/* Icon Badge */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 backdrop-blur-sm border border-primary/20">
              <Video className="w-10 h-10 text-primary" />
            </div>

            {/* Heading */}
            <div className="space-y-3">
              <h2 className="text-heading-2">
                Start Your
                <br />
                Knowledge Journey
              </h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                Join thousands of teams transforming their recordings into searchable, actionable intelligence.
              </p>
            </div>

            {/* Benefits List */}
            <div className="grid gap-4 text-left max-w-sm mx-auto pt-6">
              {[
                { title: 'Free to start', desc: 'No credit card required' },
                { title: 'Unlimited recordings', desc: 'Capture as much as you need' },
                { title: 'AI-powered search', desc: 'Find anything instantly' },
                { title: 'Team collaboration', desc: 'Share with your organization' },
              ].map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.4 + index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{benefit.title}</p>
                    <p className="text-xs text-muted-foreground">{benefit.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 1 }}
              className="pt-6 border-t border-border/50"
            >
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>SOC 2 Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>GDPR Ready</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-10 right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
