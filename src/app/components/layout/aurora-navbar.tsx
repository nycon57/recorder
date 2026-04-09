'use client';

import { SignedIn, SignedOut } from '@clerk/nextjs';
import {
  Menu,
  X,
  Sparkles,
  MessageSquare,
  BookOpen,
  ArrowRight,
  Video,
  Mic,
  Search,
  Bot,
  FileText,
  Users,
  Newspaper,
} from 'lucide-react';
import Link from 'next/link';
import * as motion from 'motion/react-client';
import React, { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

// Accordion removed - mobile nav now uses flat sections
import { Button } from '@/app/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/app/components/ui/navigation-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet';

/**
 * AuroraNavbar - Premium navigation with glass effect and aurora glow
 *
 * Features:
 * - Transparent background that transitions to glass on scroll
 * - Aurora glow effects on hover
 * - Dynamic scroll detection
 * - Responsive mobile menu with Sheet
 * - Clerk auth integration
 * - Smooth animations with brand easing
 */

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    title: 'Features',
    url: '/features',
    items: [
      {
        title: 'Recording',
        description: 'Capture expertise in one click',
        icon: <Video className="size-5 shrink-0" />,
        url: '/features/recording',
      },
      {
        title: 'Transcription',
        description: '95%+ accuracy in 50+ languages',
        icon: <Mic className="size-5 shrink-0" />,
        url: '/features/transcription',
      },
      {
        title: 'Semantic Search',
        description: 'Find by meaning, not keywords',
        icon: <Search className="size-5 shrink-0" />,
        url: '/features/search',
      },
      {
        title: 'AI Assistant',
        description: 'Answers with exact citations',
        icon: <Bot className="size-5 shrink-0" />,
        url: '/features/assistant',
      },
      {
        title: 'Auto Documentation',
        description: 'Transform recordings into SOPs',
        icon: <FileText className="size-5 shrink-0" />,
        url: '/features/documentation',
      },
      {
        title: 'Knowledge Graph',
        description: 'Connected team intelligence',
        icon: <Users className="size-5 shrink-0" />,
        url: '/features/collaboration',
      },
    ],
  },
  { title: 'Pricing', url: '/pricing' },
  {
    title: 'Resources',
    url: '#',
    items: [
      {
        title: 'Blog',
        description: 'Insights on AI, knowledge management & productivity',
        icon: <Newspaper className="size-5 shrink-0" />,
        url: '/blog',
      },
      {
        title: 'Documentation',
        description: 'Learn how to capture and transform knowledge',
        icon: <BookOpen className="size-5 shrink-0" />,
        url: '/docs',
      },
      {
        title: 'About',
        description: 'Our mission to illuminate team knowledge',
        icon: <Sparkles className="size-5 shrink-0" />,
        url: '/about',
      },
      {
        title: 'Contact',
        description: 'Get in touch with our team',
        icon: <MessageSquare className="size-5 shrink-0" />,
        url: '/contact',
      },
    ],
  },
];

const SCROLL_THRESHOLD = 50;

// Motion configuration for dropdown animations
const dropdownItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const dropdownFooterVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.3,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Mobile navigation motion variants
const mobileContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const mobileSectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.46, 0.45, 0.94],
      staggerChildren: 0.04,
    },
  },
};

const mobileItemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const mobileFooterVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
      delay: 0.3,
    },
  },
};

export default function AuroraNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    handleScroll(); // Check initial scroll position
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      ref={navRef}
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'transition-all duration-500 ease-smooth',
        isScrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-[0_4px_30px_rgba(0,0,0,0.1)]'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      <div className="container px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between h-16 sm:h-18 lg:h-20">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2 transition-all duration-300"
          >
            {/* Logo mark with glow */}
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
                isScrolled ? 'text-foreground' : 'text-foreground',
                'group-hover:text-accent'
              )}
            >
              Tribora
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            <NavigationMenu delayDuration={0}>
              <NavigationMenuList className="gap-1">
                {menuItems.map((item) => (
                  <DesktopMenuItem
                    key={item.title}
                    item={item}
                    isScrolled={isScrolled}
                  />
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <SignedOut>
              <Button
                asChild
                variant="ghost"
                className={cn(
                  'text-sm font-medium',
                  'transition-all duration-300',
                  'hover:text-accent hover:bg-accent/10'
                )}
              >
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button
                asChild
                className={cn(
                  'text-sm font-medium rounded-full',
                  'bg-gradient-to-r from-accent to-secondary',
                  'text-accent-foreground',
                  'transition-all duration-300',
                  'hover:shadow-[0_0_30px_rgba(0,223,130,0.4)]',
                  'hover:scale-105'
                )}
              >
                <Link href="/sign-up">
                  Get Started
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button
                asChild
                className={cn(
                  'text-sm font-medium rounded-full',
                  'bg-gradient-to-r from-accent to-secondary',
                  'text-accent-foreground',
                  'transition-all duration-300',
                  'hover:shadow-[0_0_30px_rgba(0,223,130,0.4)]',
                  'hover:scale-105'
                )}
              >
                <Link href="/dashboard">
                  Dashboard
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </SignedIn>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'transition-all duration-300',
                    'hover:bg-accent/10 hover:text-accent'
                  )}
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                hideCloseButton
                className={cn(
                  'w-[85vw] max-w-[320px] p-0',
                  'bg-background/98 backdrop-blur-xl',
                  'border-l border-accent/10',
                  'shadow-[-20px_0_60px_rgba(0,0,0,0.3)]'
                )}
              >
                <div className="h-full flex flex-col">
                  {/* Mobile Header */}
                  <div className="flex items-center justify-between h-16 px-5 border-b border-border/30">
                    <SheetHeader className="flex-1">
                      <SheetTitle asChild>
                        <Link
                          href="/"
                          className="group flex items-center gap-2.5"
                          onClick={() => setMobileOpen(false)}
                        >
                          <motion.div
                            className={cn(
                              'w-8 h-8 rounded-lg',
                              'bg-gradient-to-br from-accent to-secondary',
                              'flex items-center justify-center',
                              'transition-shadow duration-300',
                              'group-hover:shadow-[0_0_20px_rgba(0,223,130,0.4)]'
                            )}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <span className="text-accent-foreground font-bold text-sm">
                              T
                            </span>
                          </motion.div>
                          <span className="font-outfit text-lg font-semibold tracking-tight">
                            Tribora
                          </span>
                        </Link>
                      </SheetTitle>
                    </SheetHeader>
                    <SheetClose asChild>
                      <motion.button
                        className={cn(
                          'w-11 h-11 rounded-full',
                          'flex items-center justify-center',
                          'hover:bg-accent/10 transition-colors',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label="Close menu"
                      >
                        <X className="h-5 w-5" />
                      </motion.button>
                    </SheetClose>
                  </div>

                  {/* Mobile Navigation - Flat sections with staggered animation */}
                  <motion.nav
                    className="flex-1 overflow-y-auto py-6 px-2"
                    variants={mobileContainerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <div className="space-y-6">
                      {menuItems.map((item, index) => (
                        <MobileMenuItem
                          key={item.title}
                          item={item}
                          index={index}
                          onNavigate={() => setMobileOpen(false)}
                        />
                      ))}
                    </div>
                  </motion.nav>

                  {/* Mobile CTA Footer with slide-up animation */}
                  <motion.div
                    className={cn(
                      'px-5 py-6 space-y-3',
                      'border-t border-accent/10',
                      'bg-gradient-to-t from-background to-transparent'
                    )}
                    variants={mobileFooterVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <SignedOut>
                      <Button
                        asChild
                        variant="outline"
                        className={cn(
                          'w-full h-12 rounded-xl',
                          'border-border/50 hover:border-accent/30',
                          'hover:bg-accent/5 transition-all duration-300'
                        )}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Link href="/sign-in">Sign In</Link>
                      </Button>
                      <Button
                        asChild
                        className={cn(
                          'w-full h-12 rounded-xl',
                          'bg-gradient-to-r from-accent to-secondary',
                          'text-accent-foreground font-medium',
                          'shadow-[0_0_20px_rgba(0,223,130,0.3)]',
                          'hover:shadow-[0_0_30px_rgba(0,223,130,0.5)]',
                          'transition-shadow duration-300'
                        )}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Link href="/sign-up">
                          Get Started
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </SignedOut>
                    <SignedIn>
                      <Button
                        asChild
                        className={cn(
                          'w-full h-12 rounded-xl',
                          'bg-gradient-to-r from-accent to-secondary',
                          'text-accent-foreground font-medium',
                          'shadow-[0_0_20px_rgba(0,223,130,0.3)]',
                          'hover:shadow-[0_0_30px_rgba(0,223,130,0.5)]',
                          'transition-shadow duration-300'
                        )}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Link href="/dashboard">
                          Dashboard
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </SignedIn>
                  </motion.div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </header>
  );
}

// Desktop Menu Item Component
interface DesktopMenuItemProps {
  item: MenuItem;
  isScrolled: boolean;
}

function DesktopMenuItem({ item, isScrolled }: DesktopMenuItemProps) {
  if (item.items) {
    // Determine if this is the Features menu (has 6 items) for 2-column layout
    const isFeatures = item.title === 'Features';
    const gridCols = isFeatures ? 'grid-cols-2' : '';
    const width = isFeatures ? 'w-[480px]' : 'w-[300px]';

    return (
      <NavigationMenuItem>
        <NavigationMenuTrigger
          className={cn(
            'h-10 px-4 py-2 text-sm font-medium !rounded-full',
            'bg-transparent',
            'transition-all duration-300',
            'hover:text-accent hover:bg-accent/10',
            'data-[state=open]:text-accent data-[state=open]:bg-accent/10'
          )}
        >
          {item.title}
        </NavigationMenuTrigger>
        <NavigationMenuContent>
          <div className={cn('p-3', width)}>
            {/* Dropdown items with staggered animation */}
            <ul className={cn('grid gap-0.5', gridCols)}>
              {item.items.map((subItem, index) => (
                <motion.li
                  key={subItem.title}
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  variants={dropdownItemVariants}
                >
                  <NavigationMenuLink asChild>
                    <Link
                      href={subItem.url}
                      className={cn(
                        'group relative block rounded-lg px-3 py-2.5',
                        'transition-all duration-300',
                        'hover:bg-accent/8'
                      )}
                    >
                      {/* Hover glow effect */}
                      <div
                        className={cn(
                          'absolute inset-0 rounded-lg opacity-0',
                          'bg-gradient-to-r from-accent/5 to-transparent',
                          'transition-opacity duration-300',
                          'group-hover:opacity-100'
                        )}
                      />

                      {/* Content - left aligned */}
                      <div className="relative">
                        {/* Icon + Title inline */}
                        <div className="flex items-center gap-2.5">
                          {subItem.icon && (
                            <span
                              className={cn(
                                'text-accent/70 shrink-0',
                                'transition-all duration-300',
                                'group-hover:text-accent group-hover:scale-110'
                              )}
                            >
                              {subItem.icon}
                            </span>
                          )}
                          <span
                            className={cn(
                              'text-sm font-medium text-foreground/90',
                              'transition-colors duration-300',
                              'group-hover:text-accent'
                            )}
                          >
                            {subItem.title}
                          </span>
                        </div>

                        {/* Description on second line */}
                        {subItem.description && (
                          <p
                            className={cn(
                              'mt-0.5 text-xs text-muted-foreground/70 pl-[30px]',
                              'transition-colors duration-300',
                              'group-hover:text-muted-foreground'
                            )}
                          >
                            {subItem.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  </NavigationMenuLink>
                </motion.li>
              ))}
            </ul>

            {/* View All Features link with subtle animation */}
            {isFeatures && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={dropdownFooterVariants}
                className="mt-2 pt-2 border-t border-border/30"
              >
                <Link
                  href="/features"
                  className={cn(
                    'group inline-flex items-center justify-center gap-2 w-full',
                    'rounded-lg px-3 py-2.5',
                    'text-xs font-medium text-muted-foreground/80',
                    'transition-all duration-300',
                    'hover:text-accent hover:bg-accent/5'
                  )}
                >
                  <span>View all features</span>
                  <ArrowRight
                    className={cn(
                      'h-3.5 w-3.5',
                      'transition-transform duration-300',
                      'group-hover:translate-x-1'
                    )}
                  />
                </Link>
              </motion.div>
            )}
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem>
      <Link
        href={item.url}
        className={cn(
          'inline-flex items-center justify-center h-10 px-4 py-2 text-sm font-medium rounded-full',
          'bg-transparent',
          'transition-all duration-300',
          'hover:text-accent hover:bg-accent/10'
        )}
      >
        {item.title}
      </Link>
    </NavigationMenuItem>
  );
}

// Mobile Menu Item Component - Flat sections with motion
interface MobileMenuItemProps {
  item: MenuItem;
  index: number;
  onNavigate: () => void;
}

function MobileMenuItem({ item, index, onNavigate }: MobileMenuItemProps) {
  // Standalone link (e.g., Pricing)
  if (!item.items) {
    return (
      <motion.div
        custom={index}
        variants={mobileItemVariants}
        initial="hidden"
        animate="visible"
      >
        <Link
          href={item.url}
          onClick={onNavigate}
          className={cn(
            'group flex items-center justify-between',
            'py-3.5 px-4 rounded-xl min-h-[48px]',
            'text-base font-medium text-foreground',
            'transition-all duration-200',
            'hover:bg-accent/8 active:bg-accent/12',
            'hover:shadow-[0_0_12px_rgba(0,223,130,0.08)]'
          )}
        >
          <span className="group-hover:text-accent transition-colors duration-200">
            {item.title}
          </span>
          <ArrowRight
            className={cn(
              'h-4 w-4 text-muted-foreground/40',
              'opacity-0 -translate-x-2',
              'group-hover:opacity-100 group-hover:translate-x-0',
              'transition-all duration-200'
            )}
          />
        </Link>
      </motion.div>
    );
  }

  // Section with sub-items (Features, Resources)
  return (
    <motion.div
      variants={mobileSectionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-1.5"
    >
      {/* Section Header */}
      <h3
        className={cn(
          'px-4 py-1',
          'font-outfit text-[11px] font-medium uppercase tracking-[0.15em]',
          'text-muted-foreground/50'
        )}
      >
        {item.title}
      </h3>

      {/* Section Items */}
      <ul className="space-y-0.5">
        {item.items.map((subItem, i) => (
          <motion.li
            key={subItem.title}
            custom={i}
            variants={mobileItemVariants}
          >
            <Link
              href={subItem.url}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3',
                'py-3 px-4 rounded-xl min-h-[44px]',
                'transition-all duration-200',
                'hover:bg-accent/8 active:bg-accent/12',
                'hover:shadow-[0_0_12px_rgba(0,223,130,0.08)]'
              )}
            >
              {/* Inline icon */}
              {subItem.icon && (
                <span
                  className={cn(
                    'shrink-0 text-accent/50',
                    'transition-all duration-200',
                    'group-hover:text-accent group-hover:scale-110'
                  )}
                >
                  {subItem.icon}
                </span>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-[15px] font-medium text-foreground/90',
                    'transition-colors duration-200',
                    'group-hover:text-accent'
                  )}
                >
                  {subItem.title}
                </div>
                {subItem.description && (
                  <p
                    className={cn(
                      'text-xs text-muted-foreground/60 mt-0.5',
                      'line-clamp-1 leading-snug',
                      'transition-colors duration-200',
                      'group-hover:text-muted-foreground/80'
                    )}
                  >
                    {subItem.description}
                  </p>
                )}
              </div>
            </Link>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
