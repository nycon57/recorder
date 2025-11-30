'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Auth Layout - "Aurora Gateway"
 *
 * Creates an immersive dark-mode native authentication experience
 * with animated aurora effects representing knowledge illumination.
 *
 * Design: Full-screen dark background with animated glow orbs
 * that float and pulse, creating depth and visual interest.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen bg-[rgb(3,14,16)] overflow-hidden">
      {/* Aurora Background Layer */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary glow orb - top right */}
        <motion.div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,223,130,0.15) 0%, rgba(0,223,130,0.05) 40%, transparent 70%)',
          }}
          animate={shouldReduceMotion ? {} : {
            scale: [1, 1.1, 1],
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Secondary glow orb - bottom left */}
        <motion.div
          className="absolute -bottom-48 -left-48 w-[700px] h-[700px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(44,194,149,0.12) 0%, rgba(44,194,149,0.04) 40%, transparent 70%)',
          }}
          animate={shouldReduceMotion ? {} : {
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.7, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />

        {/* Accent glow orb - center floating */}
        <motion.div
          className="absolute top-1/2 left-1/3 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(3,98,76,0.2) 0%, rgba(3,98,76,0.05) 50%, transparent 70%)',
          }}
          animate={shouldReduceMotion ? {} : {
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />

        {/* Small floating particles */}
        {!shouldReduceMotion && (
          <>
            <motion.div
              className="absolute top-1/4 right-1/4 w-2 h-2 rounded-full bg-accent/40"
              animate={{
                y: [0, -20, 0],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute top-2/3 right-1/3 w-1.5 h-1.5 rounded-full bg-secondary/30"
              animate={{
                y: [0, -15, 0],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />
            <motion.div
              className="absolute top-1/3 left-1/4 w-1 h-1 rounded-full bg-accent/50"
              animate={{
                y: [0, -10, 0],
                opacity: [0.5, 0.9, 0.5],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            />
          </>
        )}

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,223,130,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,223,130,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Radial vignette for depth */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(3,14,16,0.4) 100%)',
          }}
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
