'use client';

import { useState } from 'react';
import { signIn } from '@/lib/auth/auth-client';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';


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
 * - Custom Better Auth sign-in form
 * - Respects reduced motion preferences
 */
export default function SignInPage() {
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message || 'Sign in failed');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleGoogleSignIn = async () => {
    await signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
  };

  const inputStyles = `
    w-full px-4 py-3 rounded-xl text-sm
    transition-all duration-200
    placeholder:text-[rgb(111,125,125)]
    focus:outline-none focus:border-[rgba(0,223,130,0.4)] focus:ring-2 focus:ring-[rgba(0,223,130,0.2)]
  `.trim();

  const inputInlineStyles = {
    background: 'rgba(6, 48, 44, 0.5)',
    border: '1px solid rgba(0, 223, 130, 0.15)',
    color: 'rgb(241, 247, 247)',
  };

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

          {/* Sign In Form */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-[rgba(6,48,44,0.8)] hover:border-[rgba(0,223,130,0.3)]"
              style={{
                background: 'rgba(6, 48, 44, 0.5)',
                border: '1px solid rgba(0, 223, 130, 0.15)',
                color: 'rgb(241, 247, 247)',
              }}
            >
              <svg className="size-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: 'rgba(0, 223, 130, 0.1)' }} />
              <span className="text-sm" style={{ color: 'rgb(170, 203, 196)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(0, 223, 130, 0.1)' }} />
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  className="rounded-xl p-3 text-sm"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'rgb(241, 247, 247)',
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(170, 203, 196)' }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputStyles}
                  style={inputInlineStyles}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(170, 203, 196)' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={inputStyles}
                  style={inputInlineStyles}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(to right, #03624c, #2cc295, #00df82)',
                  color: 'rgb(241, 247, 247)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
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
