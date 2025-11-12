'use client';

import { SignIn } from '@clerk/nextjs';
import { motion, useReducedMotion } from 'framer-motion';
import { Video, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Sign In Page
 * Modern two-column layout with branded left side and hero right side
 */
export default function SignInPage() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left Column - Sign In Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Header with Logo and Back Button */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity"
          >
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Video className="size-5" aria-hidden="true" />
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
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 text-center">
              <h1 className="text-heading-2 mb-2">Welcome back</h1>
              <p className="text-muted-foreground">
                Sign in to your account to continue
              </p>
            </div>

            {/* Clerk SignIn Component */}
            <div className="flex justify-center">
              <SignIn
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
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="text-primary font-medium hover:underline">
              Sign up
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
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.7, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Icon Badge */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 backdrop-blur-sm border border-primary/20">
              <Video className="w-10 h-10 text-primary" aria-hidden="true" />
            </div>

            {/* Heading */}
            <div className="space-y-3">
              <h2 className="text-heading-2">
                Capture Knowledge,
                <br />
                Unlock Intelligence
              </h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                Transform your recordings into searchable, actionable knowledge with AI-powered transcription and insights.
              </p>
            </div>

            {/* Features List */}
            <div className="grid gap-4 text-left max-w-sm mx-auto pt-6">
              {[
                'AI-powered transcription',
                'Semantic search across recordings',
                'Automatic documentation generation',
                'Team collaboration tools',
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-primary" aria-hidden="true" />
                  </div>
                  <span className="text-sm text-foreground/90">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-10 right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
