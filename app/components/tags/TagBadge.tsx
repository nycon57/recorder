'use client';

import React from 'react';
import { Tag } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  ColoredBadge,
  ColoredBadgeList,
  type ColoredBadgeProps,
} from '@/app/components/ui/colored-badge';

/**
 * TagBadge - Display a tag with color and optional remove button
 *
 * Built on ColoredBadge foundation for consistent styling and accessibility.
 *
 * @param tag - Tag object with name and color
 * @param name - Tag name to display (alternative to tag object)
 * @param color - Hex color code for the tag (alternative to tag object)
 * @param size - Size variant (sm, md, lg)
 * @param showIcon - Show tag icon
 * @param removable - Show remove button (deprecated, use showRemoveButton)
 * @param showRemoveButton - Show remove button
 * @param onRemove - Callback when remove is clicked
 * @param onClick - Callback when tag is clicked
 */
export interface TagBadgeProps
  extends Omit<ColoredBadgeProps, 'color' | 'icon' | 'removable'> {
  /** Tag object with name and color */
  tag?: {
    id?: string;
    name: string;
    color: string;
  };
  /** Tag name to display (alternative to tag object) */
  name?: string;
  /** Hex color code for the tag (alternative to tag object) */
  color?: string;
  /** Show tag icon */
  showIcon?: boolean;
  /** @deprecated Use showRemoveButton instead */
  removable?: boolean;
  /** Show remove button */
  showRemoveButton?: boolean;
}

export function TagBadge({
  tag,
  name: propName,
  color: propColor = '#3b82f6',
  size = 'md',
  showIcon = false,
  removable = false,
  showRemoveButton = false,
  onRemove,
  className,
  onClick,
  ...props
}: TagBadgeProps) {
  // Support both tag object and individual props
  const name = tag?.name || propName || '';
  const color = tag?.color || propColor;

  return (
    <ColoredBadge
      color={color}
      size={size}
      icon={showIcon ? <Tag className="size-full" /> : undefined}
      removable={showRemoveButton || removable}
      onRemove={onRemove}
      onClick={onClick}
      className={className}
      {...props}
    >
      {name}
    </ColoredBadge>
  );
}

/**
 * TagList - Display a list of tags
 */
export interface TagListProps {
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  removable?: boolean;
  onRemove?: (tagId: string) => void;
  onTagClick?: (tagId: string) => void;
  className?: string;
  maxVisible?: number;
}

export function TagList({
  tags,
  size = 'md',
  showIcon = false,
  removable = false,
  onRemove,
  onTagClick,
  className,
  maxVisible = 5,
}: TagListProps) {
  // Convert tags to ColoredBadgeList format
  const items = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: showIcon ? <Tag className="size-full" /> : undefined,
  }));

  return (
    <ColoredBadgeList
      items={items}
      size={size}
      removable={removable}
      onRemove={onRemove}
      onItemClick={onTagClick}
      maxVisible={maxVisible}
      className={className}
    />
  );
}
