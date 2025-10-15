"use client"

import React from 'react';

import { Checkbox } from '@/app/components/ui/checkbox';
import { cn } from '@/lib/utils';

import { ContentCard, ContentItem } from './ContentCard';

interface SelectableContentCardProps {
  item: ContentItem;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * SelectableContentCard Component
 * Wraps ContentCard with checkbox selection functionality
 *
 * Features:
 * - Checkbox for multi-select
 * - Visual indicator when selected
 * - Keyboard navigation support
 * - Click handling that doesn't interfere with card actions
 *
 * Usage:
 * <SelectableContentCard
 *   item={item}
 *   selected={selectedIds.includes(item.id)}
 *   onSelect={(id, selected) => handleSelect(id, selected)}
 * />
 */
export function SelectableContentCard({
  item,
  selected,
  onSelect,
  onDelete,
  onShare,
  onDownload,
}: SelectableContentCardProps) {
  const handleCheckboxChange = (checked: boolean) => {
    onSelect(item.id, checked);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Only toggle selection if clicking outside of interactive elements
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('a, button, input, [role="button"]');

    if (!isInteractive) {
      e.preventDefault();
      onSelect(item.id, !selected);
    }
  };

  return (
    <div
      className={cn(
        'relative group/selectable',
        'transition-all duration-200',
        selected && 'ring-2 ring-primary ring-offset-2 rounded-lg'
      )}
      onClick={handleCardClick}
    >
      {/* Selection checkbox - always visible on mobile, hover on desktop */}
      <div className="absolute top-2 left-2 z-10 sm:opacity-0 sm:group-hover/selectable:opacity-100 transition-opacity">
        <div
          className={cn(
            'w-6 h-6 flex items-center justify-center rounded-md',
            'bg-background border border-border shadow-sm',
            selected && 'bg-primary border-primary'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={handleCheckboxChange}
            aria-label={`Select ${item.title || 'item'}`}
            className="border-0 data-[state=checked]:bg-transparent"
          />
        </div>
      </div>

      {/* Content card */}
      <ContentCard
        item={item}
        onDelete={onDelete}
        onShare={onShare}
        onDownload={onDownload}
      />
    </div>
  );
}
