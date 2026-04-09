'use client';

import { SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { Button } from '@/app/components/ui/button';

export default function PremiumNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'glass-dark border-b border-[#00DF81]/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      <div className="container mx-auto">
        <div className="flex h-16 items-center justify-between px-4 lg:h-20 lg:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2 transition-all"
          >
            <span className="text-2xl font-light flex items-center gap-2 text-[#F1F7F6]">
              <span className="text-3xl">🎥</span>
              <span className="tracking-tight">Record</span>
            </span>
            {/* Animated underline */}
            <div className="absolute -bottom-1 left-0 right-0 h-[2px]
              bg-gradient-to-r from-[#00DF81]/0 via-[#00DF81] to-[#00DF81]/0
              scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 lg:flex">
            {navigationLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="group relative text-[#AAC8C4] hover:text-[#00DF81]
                  transition-colors duration-300 font-light"
              >
                {link.label}
                {/* Hover glow effect */}
                <div className="absolute -bottom-1 left-0 right-0 h-[2px]
                  bg-[#00DF81] scale-x-0 group-hover:scale-x-100
                  transition-transform duration-300
                  shadow-[0_0_10px_rgba(0,223,129,0.5)]" />
              </Link>
            ))}
          </nav>

          {/* Auth Buttons & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            {/* Desktop Auth Buttons */}
            <div className="hidden items-center gap-3 lg:flex">
              <SignedOut>
                <Link href="/sign-in">
                  <Button
                    variant="ghost"
                    className="glass-caribbean border border-[#00DF81]/20
                      text-[#00DF81] hover:bg-[#00DF81]/10 font-light"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button
                    className="bg-gradient-to-r from-[#00DF81] to-[#2CC295]
                      text-[#01001a] font-medium
                      hover:shadow-[0_0_30px_rgba(0,223,129,0.5)]
                      transition-all duration-300"
                  >
                    Get Started
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard">
                  <Button
                    className="bg-gradient-to-r from-[#00DF81] to-[#2CC295]
                      text-[#01001a] font-medium
                      hover:shadow-[0_0_30px_rgba(0,223,129,0.5)]
                      transition-all duration-300"
                  >
                    Dashboard
                  </Button>
                </Link>
              </SignedIn>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="relative flex size-10 items-center justify-center lg:hidden
                glass-caribbean border border-[#00DF81]/20 rounded-lg
                hover:border-[#00DF81]/50 transition-all"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5 text-[#00DF81]" />
              ) : (
                <Menu className="h-5 w-5 text-[#00DF81]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          'absolute inset-x-0 top-full w-full lg:hidden',
          'glass-dark border-b border-[#00DF81]/20',
          'transition-all duration-300 ease-in-out',
          isMenuOpen
            ? 'pointer-events-auto max-h-screen opacity-100'
            : 'pointer-events-none max-h-0 opacity-0 overflow-hidden'
        )}
      >
        <div className="container mx-auto px-4">
          <nav className="flex flex-col gap-6 py-6">
            {navigationLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-lg font-light text-[#AAC8C4]
                  hover:text-[#00DF81] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile Auth Buttons */}
            <div className="flex flex-col gap-3 pt-4 border-t border-[#00DF81]/20">
              <SignedOut>
                <Link href="/sign-in" onClick={() => setIsMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className="w-full glass-caribbean border border-[#00DF81]/20
                      text-[#00DF81] hover:bg-[#00DF81]/10 font-light"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up" onClick={() => setIsMenuOpen(false)}>
                  <Button
                    className="w-full bg-gradient-to-r from-[#00DF81] to-[#2CC295]
                      text-[#01001a] font-medium"
                  >
                    Get Started
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard" onClick={() => setIsMenuOpen(false)}>
                  <Button
                    className="w-full bg-gradient-to-r from-[#00DF81] to-[#2CC295]
                      text-[#01001a] font-medium"
                  >
                    Dashboard
                  </Button>
                </Link>
              </SignedIn>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
