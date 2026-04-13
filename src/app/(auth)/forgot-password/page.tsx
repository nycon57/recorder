'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth/auth-client';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const shouldReduceMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });
    if (error) {
      setError(error.message || 'Failed to send reset link. Please try again.');
    } else {
      setSent(true);
    }
    setLoading(false);
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
      {/* Back to Sign In - Top Left */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute top-6 left-6 md:top-8 md:left-8"
      >
        <Link
          href="/sign-in"
          className="group flex items-center gap-2 text-sm text-[rgb(170,203,196)] hover:text-[rgb(241,247,247)] transition-colors duration-200"
        >
          <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1" />
          <span>Back to sign in</span>
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
              <div
                className="flex size-10 items-center justify-center rounded-xl transition-shadow duration-300 group-hover:shadow-[0_0_20px_rgba(0,223,130,0.3)]"
                style={{
                  background: 'linear-gradient(135deg, #03624c 0%, #2cc295 50%, #00df82 100%)',
                }}
              >
                <span className="text-[rgb(241,247,247)] font-bold text-lg">T</span>
              </div>
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
              Reset password
            </h1>
            <p
              className="text-base"
              style={{ color: 'rgb(170, 203, 196)' }}
            >
              {sent
                ? 'Check your email for a reset link'
                : 'Enter your email and we\'ll send you a reset link'}
            </p>
          </motion.div>

          {/* Form / Success State */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {sent ? (
              <div className="text-center space-y-6">
                <div
                  className="mx-auto flex size-16 items-center justify-center rounded-full"
                  style={{
                    background: 'rgba(0, 223, 130, 0.1)',
                    border: '1px solid rgba(0, 223, 130, 0.2)',
                  }}
                >
                  <Mail className="size-7" style={{ color: '#00df82' }} />
                </div>
                <p className="text-sm" style={{ color: 'rgb(170, 203, 196)' }}>
                  If an account exists for <strong style={{ color: 'rgb(241, 247, 247)' }}>{email}</strong>,
                  you&apos;ll receive a password reset link shortly.
                </p>
                <button
                  type="button"
                  onClick={() => { setSent(false); setEmail(''); }}
                  className="text-sm font-medium transition-colors duration-200"
                  style={{ color: '#00df82' }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#2cc295')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#00df82')}
                >
                  Try a different email
                </button>
              </div>
            ) : (
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
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            )}
          </motion.div>

          {/* Footer Link */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="mt-8 text-center"
          >
            <p className="text-sm" style={{ color: 'rgb(170, 203, 196)' }}>
              Remember your password?{' '}
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
        </div>
      </motion.div>
    </div>
  );
}
