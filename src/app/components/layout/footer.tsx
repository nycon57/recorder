'use client';

import { Github, Twitter, Linkedin, Mail, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';

/**
 * AuroraFooter - Premium footer with aurora gradient backgrounds
 *
 * Design inspired by Railway, Reflect, Wope with Tribora brand identity.
 * Features:
 * - Subtle aurora gradient background
 * - Logo with gradient styling
 * - Multi-column navigation
 * - Social links with glow effects
 * - Newsletter signup
 * - Legal links
 */

type NavLink = {
  name: string;
  href: string;
};

type NavSection = {
  title: string;
  links: NavLink[];
};

type SocialLink = {
  name: string;
  href: string;
  icon: typeof Github;
};

export interface FooterProps {
  brandName?: string;
  tagline?: string;
  nav?: NavSection[];
  socials?: SocialLink[];
  showNewsletter?: boolean;
}

const DEFAULT_NAV: NavSection[] = [
  {
    title: 'Product',
    links: [
      { name: 'Features', href: '/features' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'Integrations', href: '/integrations' },
      { name: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Blog', href: '/blog' },
      { name: 'Careers', href: '/careers' },
      { name: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'Documentation', href: '/docs' },
      { name: 'Help Center', href: '/help' },
      { name: 'API Reference', href: '/api' },
      { name: 'Status', href: '/status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Cookie Policy', href: '/cookies' },
      { name: 'Security', href: '/security' },
    ],
  },
];

const DEFAULT_SOCIALS: SocialLink[] = [
  { name: 'Twitter', href: 'https://twitter.com/tribora', icon: Twitter },
  { name: 'GitHub', href: 'https://github.com/tribora', icon: Github },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/tribora', icon: Linkedin },
];

export default function Footer({
  brandName = 'Tribora',
  tagline = 'The Knowledge Intelligence Layer — illuminate your team\'s expertise.',
  nav = DEFAULT_NAV,
  socials = DEFAULT_SOCIALS,
  showNewsletter = true,
}: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden">
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />

        {/* Subtle aurora orb */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.05)_0%,transparent_70%)]
            blur-[80px]"
        />

        {/* Top border glow */}
        <div
          className="absolute top-0 left-0 right-0 h-px
            bg-gradient-to-r from-transparent via-accent/20 to-transparent"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Footer Content */}
        <div className="py-12 lg:py-16">
          <div className="grid gap-12 lg:grid-cols-[1.5fr_2fr] xl:grid-cols-[1.2fr_2fr]">
            {/* Brand Section */}
            <div className="space-y-6">
              {/* Logo */}
              <Link
                href="/"
                className="group inline-flex items-center gap-2 transition-all duration-300"
              >
                <div
                  className={cn(
                    'relative flex items-center justify-center',
                    'w-8 h-8 rounded-lg',
                    'bg-gradient-to-br from-accent to-secondary',
                    'transition-all duration-300',
                    'group-hover:shadow-[0_0_20px_rgba(0,223,130,0.4)]',
                    'group-hover:scale-105'
                  )}
                >
                  <span className="text-accent-foreground font-bold text-sm">T</span>
                </div>
                <span
                  className={cn(
                    'font-outfit text-xl font-semibold tracking-tight',
                    'transition-colors duration-300',
                    'group-hover:text-accent'
                  )}
                >
                  {brandName}
                </span>
              </Link>

              {/* Tagline */}
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                {tagline}
              </p>

              {/* Newsletter Signup */}
              {showNewsletter && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Subscribe to our newsletter
                  </p>
                  <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      className={cn(
                        'flex-1 h-10 rounded-full',
                        'bg-card/50 border-border/50',
                        'placeholder:text-muted-foreground/50',
                        'focus:border-accent/50 focus:ring-accent/20'
                      )}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className={cn(
                        'h-10 px-4 rounded-full',
                        'bg-gradient-to-r from-accent to-secondary',
                        'text-accent-foreground',
                        'transition-all duration-300',
                        'hover:shadow-[0_0_20px_rgba(0,223,130,0.3)]'
                      )}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  </form>
                  <p className="text-xs text-muted-foreground/60">
                    No spam, unsubscribe anytime.
                  </p>
                </div>
              )}

              {/* Social Links */}
              <div className="flex items-center gap-3">
                {socials.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex items-center justify-center',
                        'w-9 h-9 rounded-lg',
                        'bg-card/50 border border-border/50',
                        'text-muted-foreground',
                        'transition-all duration-300',
                        'hover:bg-accent/10 hover:border-accent/30',
                        'hover:text-accent hover:shadow-[0_0_15px_rgba(0,223,130,0.2)]'
                      )}
                      aria-label={social.name}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Navigation Columns */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {nav.map((section) => (
                <div key={section.title} className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground">
                    {section.title}
                  </h4>
                  <ul className="space-y-3">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className={cn(
                            'group/link inline-flex items-center gap-1',
                            'text-sm text-muted-foreground',
                            'transition-all duration-300',
                            'hover:text-accent'
                          )}
                        >
                          {link.name}
                          <ArrowRight
                            className={cn(
                              'h-3 w-3 opacity-0 -translate-x-2',
                              'transition-all duration-300',
                              'group-hover/link:opacity-100 group-hover/link:translate-x-0'
                            )}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className={cn(
            'py-6 border-t border-border/30',
            'flex flex-col sm:flex-row items-center justify-between gap-4'
          )}
        >
          {/* Copyright */}
          <p className="text-xs text-muted-foreground/60">
            © {year} {brandName}. All rights reserved.
          </p>

          {/* Status & Theme */}
          <div className="flex items-center gap-6">
            {/* System Status */}
            <a
              href="/status"
              className={cn(
                'inline-flex items-center gap-2',
                'text-xs text-muted-foreground/60',
                'transition-colors duration-300',
                'hover:text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  'bg-accent animate-pulse'
                )}
              />
              All systems operational
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Named export for consistency
export { Footer };
