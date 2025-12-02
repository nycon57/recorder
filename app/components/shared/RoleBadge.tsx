'use client';

import * as React from 'react';
import { Crown, Shield, PenLine, Eye } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import type { UserRole } from '@/lib/types/database';

/**
 * Role badge variant definitions
 * Color-coded for each role with appropriate styling
 */
const roleBadgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium transition-colors',
  {
    variants: {
      role: {
        owner: 'bg-primary/15 text-primary border-primary/30',
        admin: 'bg-accent/15 text-accent border-accent/30',
        contributor: 'bg-secondary/15 text-secondary border-secondary/30',
        reader: 'bg-muted text-muted-foreground border-border/50',
      },
      size: {
        sm: 'text-xs px-1.5 py-0.5 [&>svg]:size-2.5',
        md: 'text-xs px-2 py-0.5 [&>svg]:size-3',
        lg: 'text-sm px-2.5 py-1 [&>svg]:size-3.5',
      },
    },
    defaultVariants: {
      role: 'reader',
      size: 'md',
    },
  }
);

/**
 * Role metadata including icon, label, and description
 */
const ROLE_CONFIG: Record<
  UserRole,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
  }
> = {
  owner: {
    icon: Crown,
    label: 'Owner',
    description: 'Full access to all organization features, settings, and billing',
  },
  admin: {
    icon: Shield,
    label: 'Admin',
    description: 'Manage users, content, and organization settings (excluding billing)',
  },
  contributor: {
    icon: PenLine,
    label: 'Contributor',
    description: 'Create, edit, and share content within the organization',
  },
  reader: {
    icon: Eye,
    label: 'Reader',
    description: 'View and search content shared with them',
  },
};

export interface RoleBadgeProps extends VariantProps<typeof roleBadgeVariants> {
  /**
   * User role to display
   */
  role: UserRole;
  /**
   * Show icon alongside role label
   */
  showIcon?: boolean;
  /**
   * Show tooltip with role description on hover
   */
  showTooltip?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * RoleBadge Component
 *
 * A color-coded badge component for displaying user roles with optional icons
 * and descriptive tooltips. Each role has a distinct color scheme and icon:
 * - Owner: Purple with crown icon
 * - Admin: Blue with shield icon
 * - Contributor: Green with pen icon
 * - Reader: Gray with eye icon
 *
 * Fully supports dark mode with appropriate color adjustments.
 *
 * @example
 * ```tsx
 * <RoleBadge role="admin" showIcon showTooltip size="md" />
 * ```
 */
export function RoleBadge({
  role,
  size = 'md',
  showIcon = true,
  showTooltip = true,
  className,
}: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  const badgeElement = (
    <Badge
      className={cn(roleBadgeVariants({ role, size }), className)}
      variant="outline"
      aria-label={`Role: ${config.label}`}
    >
      {showIcon && <Icon className="shrink-0" aria-hidden="true" />}
      <span>{config.label}</span>
    </Badge>
  );

  if (!showTooltip) {
    return badgeElement;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badgeElement}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <Icon className="size-3.5" />
            {config.label}
          </p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Get the color class for a role (useful for other components)
 */
export function getRoleColor(role: UserRole): string {
  const colorMap: Record<UserRole, string> = {
    owner: 'text-primary',
    admin: 'text-accent',
    contributor: 'text-secondary',
    reader: 'text-muted-foreground',
  };
  return colorMap[role];
}

/**
 * Get the role configuration
 */
export function getRoleConfig(role: UserRole) {
  return ROLE_CONFIG[role];
}
