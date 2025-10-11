'use client';

import { X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TagBadgeProps {
  name: string;
  color?: string;
  onRemove?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export default function TagBadge({
  name,
  color,
  onRemove,
  className,
  size = 'sm'
}: TagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary/50 border border-secondary text-secondary-foreground font-medium",
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className
      )}
    >
      <Tag className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      <span>{name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 transition-opacity"
          aria-label={`Remove ${name} tag`}
        >
          <X className={size === 'sm' ? 'size-3' : 'size-3.5'} />
        </button>
      )}
    </span>
  );
}
