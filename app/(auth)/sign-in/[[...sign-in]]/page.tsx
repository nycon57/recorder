'use client';

import { SignIn } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';


/**
 * Sign In Page - "Aurora Gateway"
 *
 * A premium, dark-mode native sign-in experience that embodies
 * Tribora's brand identity: illuminating knowledge through AI.
 *
 * Design Features:
 * - Centered frosted glass card with subtle green glow
 * - Brand gradient text for headlines
 * - Animated trust indicators
 * - Fully themed Clerk component
 * - Respects reduced motion preferences
 */
export default function SignInPage() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
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
              Welcome back
            </h1>
            <p
              className="text-base"
              style={{ color: 'rgb(170, 203, 196)' }}
            >
              Sign in to continue illuminating your knowledge
            </p>
          </motion.div>

          {/* Clerk SignIn Component - Themed */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex justify-center"
          >
            <SignIn
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
              Don&apos;t have an account?{' '}
              <Link
                href="/sign-up"
                className="font-medium transition-colors duration-200"
                style={{ color: '#00df82' }}
                onMouseOver={(e) => (e.currentTarget.style.color = '#2cc295')}
                onMouseOut={(e) => (e.currentTarget.style.color = '#00df82')}
              >
                Sign up
              </Link>
            </p>
          </motion.div>
        </div>

        {/* Trust Indicators */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-8 flex items-center justify-center gap-6"
        >
          {[
            { label: 'SOC 2 Compliant' },
            { label: 'GDPR Ready' },
            { label: '256-bit Encryption' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'rgb(111, 125, 125)' }}
            >
              <Sparkles className="size-3" style={{ color: 'rgba(0, 223, 130, 0.6)' }} />
              <span>{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
