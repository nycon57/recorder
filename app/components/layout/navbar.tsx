'use client';

import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { Menu, Sparkles, MessageSquare } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion';
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
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet';

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { title: 'Features', url: '/features' },
  { title: 'Pricing', url: '/pricing' },
  {
    title: 'Resources',
    url: '#',
    items: [
      {
        title: 'About',
        description: 'Learn about our mission and team',
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

export default function Navbar() {
  return (
    <section className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container">
        {/* Desktop Menu */}
        <nav className="hidden justify-between lg:flex">
          {/* Logo */}
          <a
            href="/"
            className="group flex items-center gap-2 py-4 transition-all duration-300 hover:scale-105"
          >
            <span className="text-lg font-bold tracking-tight transition-colors duration-300 group-hover:text-primary">
              Tribora
            </span>
          </a>

          <div className="flex items-center gap-6">
            <div className="flex items-center">
              <NavigationMenu delayDuration={0}>
                <NavigationMenuList className="relative gap-1">
                  {menuItems.map((item) => renderMenuItem(item))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SignedOut>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="group relative overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
              >
                <a href="/sign-in">
                  <span className="relative z-10">Sign In</span>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-primary/10 to-primary/5 transition-transform duration-300 group-hover:translate-x-0" />
                </a>
              </Button>
              <Button
                asChild
                size="sm"
                className="group relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
              >
                <a href="/sign-up">
                  <span className="relative z-10">Get Started</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </a>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button
                asChild
                size="sm"
                className="group relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
              >
                <a href="/dashboard">
                  <span className="relative z-10">Dashboard</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </a>
              </Button>
            </SignedIn>
          </div>
        </nav>

        {/* Mobile Menu */}
        <div className="block lg:hidden">
          <div className="flex items-center justify-between py-4">
            <a
              href="/"
              className="group flex items-center gap-2 transition-all duration-300"
            >
              <span className="text-lg font-bold tracking-tight transition-colors duration-300 group-hover:text-primary">
                Tribora
              </span>
            </a>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="transition-all duration-300 hover:border-primary/50 hover:bg-primary/5"
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>
                    <a href="/" className="flex items-center gap-2">
                      <span className="text-lg font-bold tracking-tight">
                        Tribora
                      </span>
                    </a>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 p-4">
                  <Accordion
                    type="single"
                    collapsible
                    className="flex w-full flex-col gap-4"
                  >
                    {menuItems.map((item) => renderMobileMenuItem(item))}
                  </Accordion>

                  <div className="flex flex-col gap-3">
                    <SignedOut>
                      <Button asChild variant="outline">
                        <a href="/sign-in">Sign In</a>
                      </Button>
                      <Button asChild>
                        <a href="/sign-up">Get Started</a>
                      </Button>
                    </SignedOut>
                    <SignedIn>
                      <Button asChild>
                        <a href="/dashboard">Dashboard</a>
                      </Button>
                    </SignedIn>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </section>
  );
}

const renderMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title}>
        <NavigationMenuTrigger
          className={cn(
            'group relative h-10 rounded-md px-4 py-2 text-sm font-medium',
            'bg-background transition-all duration-300',
            'hover:text-accent',
            'data-[state=open]:text-accent',
          )}
        >
          {item.title}
        </NavigationMenuTrigger>
        <NavigationMenuContent
          className={cn(
            'data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out',
            'data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out',
            'data-[motion=from-end]:slide-in-from-right-52',
            'data-[motion=from-start]:slide-in-from-left-52',
            'data-[motion=to-end]:slide-out-to-right-52',
            'data-[motion=to-start]:slide-out-to-left-52',
            'absolute left-0 top-0 w-full md:w-[400px]',
            'origin-top-center',
          )}
        >
          <ul className="grid gap-1 p-4 pb-6">
            {item.items.map((subItem) => (
              <li key={subItem.title}>
                <NavigationMenuLink asChild>
                  <SubMenuLink item={subItem} />
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.title}>
      <NavigationMenuLink
        href={item.url}
        className={cn(
          'group relative inline-flex h-10 w-max items-center justify-center',
          'rounded-md px-4 py-2 text-sm font-medium',
          'bg-background transition-all duration-300',
          'hover:text-accent',
        )}
      >
        {item.title}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

const renderMobileMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="text-md py-0 font-semibold hover:no-underline hover:text-primary">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.items.map((subItem) => (
            <SubMenuLink key={subItem.title} item={subItem} />
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <a
      key={item.title}
      href={item.url}
      className="text-md font-semibold transition-colors duration-300 hover:text-primary"
    >
      {item.title}
    </a>
  );
};

const SubMenuLink = ({ item }: { item: MenuItem }) => {
  return (
    <a
      className={cn(
        'group relative flex select-none flex-row gap-4 rounded-lg p-3',
        'leading-none no-underline outline-none',
        'transition-all duration-300',
        'hover:bg-accent/10 hover:text-accent',
        'hover:shadow-md hover:shadow-primary/10',
        'hover:scale-[1.02]',
        'overflow-hidden',
      )}
      href={item.url}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent transition-transform duration-500 group-hover:translate-x-0" />

      <div className="relative z-10 flex items-center justify-center rounded-md bg-primary/10 p-2 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
        {item.icon}
      </div>
      <div className="relative z-10 flex-1">
        <div className="mb-1 text-sm font-semibold transition-colors duration-300">
          {item.title}
        </div>
        {item.description && (
          <p className="text-muted-foreground text-xs leading-snug">
            {item.description}
          </p>
        )}
      </div>

      {/* Hover arrow indicator */}
      <div className="relative z-10 flex items-center opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1">
        <svg
          className="size-4 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </a>
  );
};
