'use client';

import { SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Navigation bar component for the marketing site
 * Features:
 * - Sticky header with backdrop blur
 * - Responsive mobile menu with smooth animations
 * - Clerk authentication integration
 * - Dark mode support
 */
export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }

    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isMenuOpen]);

  const navigationLinks = [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border',
        'bg-background/80 backdrop-blur-md',
        'transition-all duration-300',
      )}
    >
      <div className="container mx-auto">
        <div className="flex h-16 items-center justify-between px-4 lg:h-20 lg:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <span className="text-heading-6 flex items-center gap-2">
              <span className="text-2xl">🎥</span>
              <span className="font-bold">Record</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 lg:flex">
            {navigationLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  'text-body-sm-medium text-foreground',
                  'transition-colors hover:text-primary',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Auth Buttons & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            {/* Desktop Auth Buttons */}
            <div className="hidden items-center gap-3 lg:flex">
              <SignedOut>
                <Link
                  href="/sign-in"
                  className={cn(
                    'rounded-lg border border-border px-4 py-2',
                    'text-body-sm-medium text-foreground',
                    'transition-all hover:border-border/80 hover:bg-muted',
                  )}
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    'rounded-lg bg-primary px-4 py-2',
                    'text-body-sm-medium text-primary-foreground',
                    'transition-all hover:bg-primary/90',
                    'shadow-sm hover:shadow-md',
                  )}
                >
                  Get Started
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className={cn(
                    'rounded-lg bg-primary px-4 py-2',
                    'text-body-sm-medium text-primary-foreground',
                    'transition-all hover:bg-primary/90',
                    'shadow-sm hover:shadow-md',
                  )}
                >
                  Dashboard
                </Link>
              </SignedIn>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="relative flex size-8 items-center justify-center lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              <div className="absolute top-1/2 left-1/2 block w-[18px] -translate-x-1/2 -translate-y-1/2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute block h-0.5 w-full rounded-full bg-foreground',
                    'transition-all duration-300 ease-in-out',
                    isMenuOpen ? 'rotate-45' : '-translate-y-1.5',
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute block h-0.5 w-full rounded-full bg-foreground',
                    'transition-all duration-300 ease-in-out',
                    isMenuOpen ? 'opacity-0' : 'opacity-100',
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute block h-0.5 w-full rounded-full bg-foreground',
                    'transition-all duration-300 ease-in-out',
                    isMenuOpen ? '-rotate-45' : 'translate-y-1.5',
                  )}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          'absolute inset-x-0 top-full w-full lg:hidden',
          'bg-background/95 backdrop-blur-md',
          'border-b border-border',
          'transition-all duration-300 ease-in-out',
          isMenuOpen
            ? 'pointer-events-auto max-h-screen opacity-100'
            : 'pointer-events-none max-h-0 opacity-0',
        )}
      >
        <div className="container mx-auto px-4">
          <nav className="flex flex-col gap-6 py-6">
            {navigationLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  'text-body-lg-medium text-foreground',
                  'transition-colors hover:text-primary',
                )}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile Auth Buttons */}
            <div className="flex flex-col gap-3 pt-4">
              <SignedOut>
                <Link
                  href="/sign-in"
                  className={cn(
                    'w-full rounded-lg border border-border py-3 text-center',
                    'text-body-md-medium text-foreground',
                    'transition-all hover:border-border/80 hover:bg-muted',
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    'w-full rounded-lg bg-primary py-3 text-center',
                    'text-body-md-medium text-primary-foreground',
                    'transition-all hover:bg-primary/90',
                    'shadow-sm hover:shadow-md',
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Get Started
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className={cn(
                    'w-full rounded-lg bg-primary py-3 text-center',
                    'text-body-md-medium text-primary-foreground',
                    'transition-all hover:bg-primary/90',
                    'shadow-sm hover:shadow-md',
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
              </SignedIn>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
