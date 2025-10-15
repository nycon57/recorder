'use client';

import React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface TagBadgeProps {
  tag?: {
    id?: string;
    name: string;
    color: string;
  };
  name?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  removable?: boolean;
  showRemoveButton?: boolean;
  onRemove?: () => void;
  className?: string;
  onClick?: () => void;
}

/**
 * TagBadge - Display a tag with color and optional remove button
 *
 * @param tag - Tag object with name and color
 * @param name - Tag name to display (alternative to tag object)
 * @param color - Hex color code for the tag (alternative to tag object)
 * @param size - Size variant (sm, md, lg)
 * @param removable - Show remove button (deprecated, use showRemoveButton)
 * @param showRemoveButton - Show remove button
 * @param onRemove - Callback when remove is clicked
 * @param onClick - Callback when tag is clicked
 */
export function TagBadge({
  tag,
  name: propName,
  color: propColor = '#3b82f6',
  size = 'md',
  removable = false,
  showRemoveButton = false,
  onRemove,
  className,
  onClick,
}: TagBadgeProps) {
  // Support both tag object and individual props
  const name = tag?.name || propName || '';
  const color = tag?.color || propColor;
  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  // Calculate text color based on background color
  const getTextColor = (bgColor: string): string => {
    // Convert hex to RGB
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black or white based on luminance
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const textColor = getTextColor(color);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium transition-all',
        sizeClasses[size],
        onClick && !removable && 'cursor-pointer hover:opacity-80',
        className
      )}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
      onClick={onClick && !removable ? onClick : undefined}
    >
      <span className="truncate max-w-[150px]">{name}</span>
      {(removable || showRemoveButton) && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'ml-0.5 -mr-1 rounded-full hover:bg-black/10 transition-colors',
            size === 'sm' && 'p-0.5',
            size === 'md' && 'p-0.5',
            size === 'lg' && 'p-1'
          )}
          aria-label={`Remove ${name} tag`}
        >
          <X
            className={cn(
              size === 'sm' && 'h-3 w-3',
              size === 'md' && 'h-3.5 w-3.5',
              size === 'lg' && 'h-4 w-4'
            )}
          />
        </button>
      )}
    </span>
  );
}

/**
 * TagList - Display a list of tags
 */
interface TagListProps {
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  size?: 'sm' | 'md' | 'lg';
  removable?: boolean;
  onRemove?: (tagId: string) => void;
  onTagClick?: (tagId: string) => void;
  className?: string;
  maxVisible?: number;
}

export function TagList({
  tags,
  size = 'md',
  removable = false,
  onRemove,
  onTagClick,
  className,
  maxVisible = 5,
}: TagListProps) {
  const visibleTags = maxVisible ? tags.slice(0, maxVisible) : tags;
  const hiddenCount = tags.length - visibleTags.length;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visibleTags.map((tag) => (
        <TagBadge
          key={tag.id}
          name={tag.name}
          color={tag.color}
          size={size}
          removable={removable}
          onRemove={onRemove ? () => onRemove(tag.id) : undefined}
          onClick={onTagClick ? () => onTagClick(tag.id) : undefined}
        />
      ))}
      {hiddenCount > 0 && (
        <span
          className={cn(
            'inline-flex items-center rounded-full bg-gray-100 text-gray-600',
            size === 'sm' && 'text-xs px-2 py-0.5',
            size === 'md' && 'text-sm px-2.5 py-1',
            size === 'lg' && 'text-base px-3 py-1.5'
          )}
        >
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}