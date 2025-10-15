/**
 * Phase 8: Library Organization & Content Management Types
 *
 * TypeScript types for collections, favorites, activity tracking, and analytics.
 */

import type { ContentType, Visibility } from './database';

// ============================================================================
// Tags
// ============================================================================

export interface Tag {
  id: string;
  org_id: string;
  name: string;
  color: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RecordingTag {
  recording_id: string;
  tag_id: string;
  created_at: string;
  created_by: string | null;
}

export interface TagWithUsage extends Tag {
  usage_count: number;
}

export interface CreateTagRequest {
  name: string;
  color: string;
  description?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
  description?: string;
}

export interface ApplyTagsRequest {
  recording_ids: string[];
  tag_ids: string[];
}

// ============================================================================
// Collections
// ============================================================================

export interface Collection {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  color: string;
  icon: string | null;
  visibility: Visibility;
  item_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CollectionItem {
  collection_id: string;
  recording_id: string;
  added_by: string;
  created_at: string;
}

export interface CollectionWithItems extends Collection {
  items: Array<{
    id: string;
    title: string;
    content_type: ContentType;
    created_at: string;
  }>;
}

export interface CollectionTree extends Collection {
  children: CollectionTree[];
}

// ============================================================================
// Favorites
// ============================================================================

export interface Favorite {
  user_id: string;
  recording_id: string;
  created_at: string;
}

export interface FavoriteItem {
  recording_id: string;
  title: string | null;
  content_type: ContentType | null;
  created_at: string;
  favorited_at: string;
}

// ============================================================================
// Activity Tracking
// ============================================================================

export type ActivityAction =
  | 'recording.created'
  | 'recording.updated'
  | 'recording.deleted'
  | 'recording.shared'
  | 'recording.favorited'
  | 'recording.unfavorited'
  | 'collection.created'
  | 'collection.updated'
  | 'collection.deleted'
  | 'collection.item_added'
  | 'collection.item_removed'
  | 'tag.created'
  | 'tag.updated'
  | 'tag.deleted'
  | 'tag.applied'
  | 'tag.removed'
  | 'document.generated'
  | 'document.updated'
  | 'search.executed'
  | 'user.login';

export type ActivityResourceType = 'recording' | 'collection' | 'tag' | 'document' | 'user';

export interface ActivityLog {
  id: string;
  org_id: string;
  user_id: string;
  action: ActivityAction;
  resource_type: ActivityResourceType;
  resource_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ActivityFeedItem extends ActivityLog {
  user_name: string | null;
  user_avatar: string | null;
  resource_title: string | null;
}

// ============================================================================
// Analytics
// ============================================================================

export interface StorageByContentType {
  content_type: ContentType;
  total_size_bytes: number;
  item_count: number;
  percentage: number;
}

export interface StorageByUser {
  user_id: string;
  user_name: string | null;
  total_size_bytes: number;
  item_count: number;
}

export interface StorageByDate {
  date: string;
  total_size_bytes: number;
  item_count: number;
}

export interface PopularItem {
  recording_id: string;
  title: string | null;
  content_type: ContentType | null;
  metric_value: number;
  created_at: string;
}

export interface UsageTrend {
  period: string;
  value: number;
}

export interface ProcessingStats {
  job_type: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  avg_processing_time_ms: number | null;
  min_processing_time_ms: number | null;
  max_processing_time_ms: number | null;
}

// ============================================================================
// Enhanced Library
// ============================================================================

export interface LibraryFilters {
  content_type?: ContentType;
  status?: string;
  search?: string;
  tag_ids?: string[];
  collection_id?: string;
  favorites_only?: boolean;
  date_from?: string;
  date_to?: string;
  created_by?: string;
}

export interface LibrarySort {
  field: 'created_at' | 'title' | 'duration_sec' | 'file_size';
  direction: 'asc' | 'desc';
}

export interface BulkUploadItem {
  content_type: ContentType;
  title: string;
  description?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  metadata?: Record<string, any>;
}

export interface BulkUploadResult {
  success: boolean;
  recording_id?: string;
  error?: string;
  item: BulkUploadItem;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'markdown' | 'zip';
  include_transcripts: boolean;
  include_documents: boolean;
  include_metadata: boolean;
}

export interface ExportResult {
  download_url: string;
  expires_at: string;
  file_size_bytes: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface CollectionsListResponse {
  collections: Collection[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CollectionItemsResponse {
  items: Array<{
    id: string;
    title: string | null;
    content_type: ContentType | null;
    created_at: string;
    added_at: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface FavoritesListResponse {
  favorites: FavoriteItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ActivityFeedResponse {
  activities: ActivityFeedItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface StorageAnalyticsResponse {
  by_content_type?: StorageByContentType[];
  by_user?: StorageByUser[];
  by_date?: StorageByDate[];
  total_size_bytes: number;
  total_items: number;
}

export interface PopularItemsResponse {
  items: PopularItem[];
  timeframe: '7d' | '30d' | '90d' | 'all';
  metric: 'views' | 'shares' | 'favorites' | 'searches';
}

export interface UsageTrendsResponse {
  trends: UsageTrend[];
  metric: 'uploads' | 'searches' | 'shares' | 'storage' | 'users';
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface ProcessingStatsResponse {
  stats: ProcessingStats[];
  total_jobs: number;
  overall_success_rate: number;
}
