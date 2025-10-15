"use client"

import React from 'react';

import { ContentType } from '@/lib/types/database';

import { VideoCard } from './VideoCard';
import { AudioCard } from './AudioCard';
import { DocumentCard } from './DocumentCard';
import { TextCard } from './TextCard';
import { RecordingCard as RecordingVideoCard } from './RecordingCard';

/**
 * Content item interface for library display
 */
export interface ContentItem {
  id: string;
  title: string | null;
  description: string | null;
  content_type: ContentType | null;
  file_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  duration_sec: number | null;
  file_size: number | null;
  thumbnail_url: string | null;
  original_filename: string | null;
  created_by: string;
  org_id: string;
  metadata?: any;
}

interface ContentCardProps {
  item: ContentItem;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * ContentCard Component
 * Delegates rendering to type-specific card components based on content_type
 *
 * Usage:
 * <ContentCard item={contentItem} onDelete={handleDelete} />
 */
export function ContentCard({ item, onDelete, onShare, onDownload }: ContentCardProps) {
  const contentType = item.content_type || 'recording';

  // Delegate to appropriate card type
  switch (contentType) {
    case 'recording':
      return (
        <RecordingVideoCard
          item={item}
          onDelete={onDelete}
          onShare={onShare}
          onDownload={onDownload}
        />
      );
    case 'video':
      return (
        <VideoCard
          item={item}
          onDelete={onDelete}
          onShare={onShare}
          onDownload={onDownload}
        />
      );
    case 'audio':
      return (
        <AudioCard
          item={item}
          onDelete={onDelete}
          onShare={onShare}
          onDownload={onDownload}
        />
      );
    case 'document':
      return (
        <DocumentCard
          item={item}
          onDelete={onDelete}
          onShare={onShare}
          onDownload={onDownload}
        />
      );
    case 'text':
      return (
        <TextCard
          item={item}
          onDelete={onDelete}
          onShare={onShare}
          onDownload={onDownload}
        />
      );
    default:
      // Fallback to recording card
      return (
        <RecordingVideoCard
          item={item}
          onDelete={onDelete}
          onShare={onShare}
          onDownload={onDownload}
        />
      );
  }
}
