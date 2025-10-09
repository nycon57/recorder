'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

type NavLink = {
  name: string;
  href: string;
};

type NavSection = {
  title: string;
  links: NavLink[];
};

export interface FooterProps {
  brandName?: string;
  nav?: NavSection[];
  legal?: NavLink[];
}

const DEFAULT_NAV: NavSection[] = [
  {
    title: 'Product',
    links: [
      { name: 'Features', href: '/features' },
      { name: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
  },
];

const DEFAULT_LEGAL: NavLink[] = [
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms of Service', href: '/terms' },
];

/**
 * Footer component for the marketing site
 * Features:
 * - Dark background with structured navigation
 * - Responsive grid layout
 * - Legal links and copyright
 * - Dark mode support
 */
export default function Footer({
  brandName = 'Record',
  nav = DEFAULT_NAV,
  legal = DEFAULT_LEGAL,
}: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn('border-t border-border bg-primary/10 text-foreground')}>
      <div className="container mx-auto px-6 py-12 lg:py-20">
        {/* Main Footer Content */}
        <div className="grid gap-12 lg:grid-cols-[max-content_1fr] lg:gap-24">
          {/* Brand Section */}
          <div className="flex flex-col justify-between space-y-6">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
              >
                <span className="text-heading-5 flex items-center gap-2 text-foreground">
                  <span className="text-2xl">🎥</span>
                  <span className="font-bold">{brandName}</span>
                </span>
              </Link>
              <p className="text-body-sm mt-4 text-muted-foreground">
                AI-powered screen recording and knowledge management platform
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-body-xs text-muted-foreground/60">
                © {year} {brandName}. All rights reserved.
              </p>
            </div>
          </div>

          {/* Navigation Columns */}
          <div
            className={cn(
              'grid grid-cols-2 gap-8',
              'sm:grid-cols-3',
              'lg:grid-cols-3 lg:gap-12',
            )}
          >
            {nav.map((section) => (
              <div key={section.title} className="space-y-4">
                <h4 className="text-body-md-medium text-foreground">
                  {section.title}
                </h4>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className={cn(
                          'text-body-sm text-muted-foreground',
                          'transition-colors hover:text-foreground',
                        )}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Legal Links */}
        <div
          className={cn(
            'mt-12 flex flex-col items-center gap-4',
            'border-t border-border/50 pt-8',
            'sm:flex-row sm:justify-center sm:gap-6',
          )}
        >
          {legal.map((link, index) => (
            <span key={link.name} className="flex items-center gap-6">
              <Link
                href={link.href}
                className={cn(
                  'text-body-sm text-muted-foreground',
                  'transition-colors hover:text-foreground',
                )}
              >
                {link.name}
              </Link>
              {index < legal.length - 1 && (
                <span className="hidden text-muted-foreground/30 sm:inline">•</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
