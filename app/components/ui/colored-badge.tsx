'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { generateColorVars } from '@/lib/utils/color';

/**
 * ColoredBadge - Unified foundation for dynamic color badges (tags, concepts, etc.)
 *
 * Uses CSS custom properties for dynamic colors, enabling proper theming and focus states.
 * Provides accessibility features including keyboard navigation and focus-visible rings.
 *
 * @example
 * // Simple usage
 * <ColoredBadge color="#3b82f6">Tag Name</ColoredBadge>
 *
 * // With icon and remove button
 * <ColoredBadge color="#00df82" icon={<Tag />} removable onRemove={() => {}}>
 *   Tag Name
 * </ColoredBadge>
 *
 * // Interactive (clickable)
 * <ColoredBadge color="#8b5cf6" onClick={() => console.log('clicked')}>
 *   Click Me
 * </ColoredBadge>
 */

const coloredBadgeVariants = cva(
  'inline-flex items-center rounded-full font-medium transition-all',
  {
    variants: {
      size: {
        sm: 'text-xs px-2 py-0.5 gap-1',
        md: 'text-sm px-2.5 py-1 gap-1.5',
        lg: 'text-base px-3 py-1.5 gap-2',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const iconSizeMap = {
  sm: 'size-3',
  md: 'size-3.5',
  lg: 'size-4',
} as const;

export interface ColoredBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof coloredBadgeVariants> {
  /** Background color in hex format (e.g., '#3b82f6') */
  color: string;
  /** Optional icon to display before the text */
  icon?: React.ReactNode;
  /** Whether to show a remove button */
  removable?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Callback when badge is clicked (makes badge interactive) */
  onClick?: () => void;
  /** Maximum width for text truncation (default: 150px) */
  maxWidth?: number | string;
  /** Render as a different element via Radix Slot */
  asChild?: boolean;
}

export const ColoredBadge = React.forwardRef<HTMLSpanElement, ColoredBadgeProps>(
  (
    {
      className,
      color,
      icon,
      size = 'md',
      removable = false,
      onRemove,
      onClick,
      maxWidth = 150,
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'span';

    // Determine if badge should be interactive (clickable but not removable)
    const isInteractive = !!onClick && !removable;

    // Keyboard handler for accessible button behavior
    const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
        if (e.key === ' ') {
          e.preventDefault(); // Prevent page scroll on Space
        }
        onClick?.();
      }
    };

    const iconSize = iconSizeMap[size || 'md'];
    const maxWidthValue = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;

    return (
      <Comp
        ref={ref}
        data-slot="colored-badge"
        data-interactive={isInteractive || undefined}
        className={cn(
          coloredBadgeVariants({ size }),
          // Focus ring styles are handled by CSS via data-slot
          className
        )}
        style={generateColorVars(color)}
        onClick={isInteractive ? onClick : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        {...props}
      >
        {icon && (
          <span className={cn(iconSize, 'shrink-0 flex items-center justify-center')}>
            {icon}
          </span>
        )}
        <span className="truncate" style={{ maxWidth: maxWidthValue }}>
          {children}
        </span>
        {removable && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={cn(
              'ml-0.5 -mr-1 rounded-full transition-colors',
              'hover:bg-black/10 dark:hover:bg-white/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'lg' ? 'p-1' : 'p-0.5'
            )}
            aria-label="Remove"
          >
            <X className={iconSize} />
          </button>
        )}
      </Comp>
    );
  }
);

ColoredBadge.displayName = 'ColoredBadge';

/**
 * ColoredBadgeList - Display a list of badges with overflow handling
 */
export interface ColoredBadgeListProps {
  /** Array of items to render as badges */
  items: Array<{
    id: string;
    name: string;
    color: string;
    icon?: React.ReactNode;
  }>;
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
  /** Allow removal of badges */
  removable?: boolean;
  /** Callback when a badge is removed */
  onRemove?: (id: string) => void;
  /** Callback when a badge is clicked */
  onItemClick?: (id: string) => void;
  /** Maximum number of visible badges (rest shown as "+N more") */
  maxVisible?: number;
  /** Additional class names */
  className?: string;
}

export function ColoredBadgeList({
  items,
  size = 'md',
  removable = false,
  onRemove,
  onItemClick,
  maxVisible = 5,
  className,
}: ColoredBadgeListProps) {
  const visibleItems = maxVisible ? items.slice(0, maxVisible) : items;
  const hiddenCount = items.length - visibleItems.length;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visibleItems.map((item) => (
        <ColoredBadge
          key={item.id}
          color={item.color}
          size={size}
          icon={item.icon}
          removable={removable}
          onRemove={onRemove ? () => onRemove(item.id) : undefined}
          onClick={onItemClick ? () => onItemClick(item.id) : undefined}
        >
          {item.name}
        </ColoredBadge>
      ))}
      {hiddenCount > 0 && (
        <span
          className={cn(
            'inline-flex items-center rounded-full bg-muted text-muted-foreground',
            sizeClasses[size]
          )}
        >
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}
