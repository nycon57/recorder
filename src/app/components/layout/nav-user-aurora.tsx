'use client';

import * as React from 'react';
import Link from 'next/link';
import * as motion from 'motion/react-client';
import type { Variants } from 'motion/react';
import {
  ChevronsUpDown,
  Settings,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

import { useSession, signOut } from '@/lib/auth/auth-client';
import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/app/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/app/components/ui/avatar';

/**
 * NavUserAurora Component
 * Motion-enhanced user dropdown for dashboard sidebar
 *
 * Features:
 * - Consistent app-surface dropdown styling
 * - Lightweight hover/focus feedback
 * - Staggered menu item animations
 */

// Motion variants for dropdown items
const menuItemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  }),
};

// Motion variants for entrance animation
const containerVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
      delay: 0.35,
    },
  },
};

export function NavUserAurora() {
  const { data: session, isPending } = useSession();
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch by only rendering motion after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Wait for session to load
  if (isPending || !session?.user) {
    return null;
  }

  const user = session.user;

  // Get user display information
  const userName = user.name || 'User';
  const userEmail = user.email || '';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  // Wrapper component - use motion only after mount to prevent hydration mismatch
  const Wrapper = mounted ? motion.div : 'div';
  const wrapperProps = mounted
    ? {
        initial: 'hidden',
        animate: 'visible',
        variants: containerVariants,
      }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className={cn(
                  'transition-all duration-300',
                  'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
                  'data-[state=open]:border-sidebar-border',
                )}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Avatar
                    className={cn(
                      'size-8 rounded-lg',
                      'transition-shadow duration-300',
                      'hover:shadow-[0_10px_18px_-14px_rgba(0,0,0,0.85)]',
                    )}
                  >
                    <AvatarImage src={user.image || undefined} alt={userName} />
                    <AvatarFallback className="rounded-lg bg-muted text-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{userName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/60" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className={cn(
                'w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg',
                'bg-popover/95 backdrop-blur-xl border-border',
                'shadow-[0_18px_44px_-30px_rgba(0,0,0,0.9)]',
              )}
              side="bottom"
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={user.image || undefined} alt={userName} />
                    <AvatarFallback className="rounded-lg bg-muted text-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <motion.div
                custom={0}
                initial="hidden"
                animate="visible"
                variants={menuItemVariants}
              >
                <DropdownMenuItem
                  asChild
                  className={cn(
                    'cursor-pointer',
                    'transition-all duration-200',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    'focus:bg-sidebar-accent focus:text-sidebar-accent-foreground',
                  )}
                >
                  <Link href="/settings/profile">
                    <UserIcon className="mr-2 size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
              </motion.div>
              <motion.div
                custom={1}
                initial="hidden"
                animate="visible"
                variants={menuItemVariants}
              >
                <DropdownMenuItem
                  asChild
                  className={cn(
                    'cursor-pointer',
                    'transition-all duration-200',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    'focus:bg-sidebar-accent focus:text-sidebar-accent-foreground',
                  )}
                >
                  <Link href="/settings">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </motion.div>
              <DropdownMenuSeparator className="bg-border" />
              <motion.div
                custom={2}
                initial="hidden"
                animate="visible"
                variants={menuItemVariants}
              >
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className={cn(
                    'cursor-pointer',
                    'transition-all duration-200',
                    'hover:bg-destructive/10 hover:text-destructive',
                    'focus:bg-destructive/10 focus:text-destructive',
                  )}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </motion.div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </Wrapper>
  );
}
