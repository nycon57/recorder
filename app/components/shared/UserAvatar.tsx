'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';

/**
 * Variant definitions for UserAvatar component
 * Supports multiple size variants and optional online status indicator
 */
const userAvatarVariants = cva('relative', {
  variants: {
    size: {
      sm: 'size-8',
      md: 'size-10',
      lg: 'size-12',
      xl: 'size-16',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

/**
 * Online status indicator badge variant
 */
const statusIndicatorVariants = cva(
  'absolute bottom-0 right-0 block rounded-full ring-2 ring-background',
  {
    variants: {
      size: {
        sm: 'size-2',
        md: 'size-2.5',
        lg: 'size-3',
        xl: 'size-4',
      },
      status: {
        online: 'bg-green-500',
        offline: 'bg-gray-400',
        away: 'bg-yellow-500',
        busy: 'bg-red-500',
      },
    },
    defaultVariants: {
      size: 'md',
      status: 'offline',
    },
  }
);

export interface UserAvatarProps extends VariantProps<typeof userAvatarVariants> {
  /**
   * User's name for fallback initials
   */
  name: string;
  /**
   * URL to user's avatar image
   */
  avatarUrl?: string | null;
  /**
   * Optional email for additional tooltip info
   */
  email?: string | null;
  /**
   * Optional job title for tooltip
   */
  title?: string | null;
  /**
   * Online status indicator
   */
  status?: 'online' | 'offline' | 'away' | 'busy' | null;
  /**
   * Show tooltip with user info on hover
   */
  showTooltip?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Generate initials from a name
 * Takes first letter of first two words
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * UserAvatar Component
 *
 * A flexible user avatar component with multiple size variants, optional online status
 * indicator, and hover tooltip with user information.
 *
 * @example
 * ```tsx
 * <UserAvatar
 *   name="John Doe"
 *   avatarUrl="/avatars/john.jpg"
 *   email="john@example.com"
 *   title="Software Engineer"
 *   status="online"
 *   size="md"
 *   showTooltip
 * />
 * ```
 */
export function UserAvatar({
  name,
  avatarUrl,
  email,
  title,
  status,
  size = 'md',
  showTooltip = true,
  className,
}: UserAvatarProps) {
  const initials = React.useMemo(() => getInitials(name), [name]);
  const hasTooltipContent = email || title;

  const avatarElement = (
    <div className={cn(userAvatarVariants({ size }), className)}>
      <Avatar className="size-full">
        {avatarUrl && (
          <AvatarImage
            src={avatarUrl}
            alt={name}
            className="object-cover"
          />
        )}
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      {status && status !== 'offline' && (
        <span
          className={cn(statusIndicatorVariants({ size, status }))}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );

  if (!showTooltip || !hasTooltipContent) {
    return avatarElement;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {avatarElement}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold text-sm">{name}</p>
          {title && (
            <p className="text-xs text-muted-foreground">{title}</p>
          )}
          {email && (
            <p className="text-xs text-muted-foreground">{email}</p>
          )}
          {status && (
            <p className="text-xs text-muted-foreground capitalize">
              Status: {status}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
