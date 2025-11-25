"use client"

import React from 'react';
import { BaseContentCard, ContentItem } from './BaseContentCard';

interface ContentCardProps {
  item: ContentItem;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * ContentCard Component
 * Wrapper component that delegates to BaseContentCard
 * Maintains backwards compatibility with existing code
 *
 * Usage:
 * <ContentCard item={contentItem} onDelete={handleDelete} />
 */
export function ContentCard({ item }: ContentCardProps) {
  return (
    <BaseContentCard
      item={item}
    />
  );
}

// Re-export ContentItem type for convenience
export type { ContentItem };
