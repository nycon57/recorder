/**
 * Type definitions for Phase 4 Advanced Video Processing
 * Visual search and frame management
 */

import { Database } from './database';

export type VideoFrame = Database['public']['Tables']['video_frames']['Row'];

export type VideoFrameInsert =
  Database['public']['Tables']['video_frames']['Insert'];

export type VideoFrameUpdate =
  Database['public']['Tables']['video_frames']['Update'];

/**
 * Visual search result with frame data
 */
export interface VisualSearchResult {
  id: string;
  recordingId: string;
  frameTimeSec: number;
  frameUrl: string;
  visualDescription: string | null;
  ocrText: string | null;
  similarity: number;
  metadata: {
    frameIndex?: number;
    extractionMethod?: string;
    confidence?: number;
    [key: string]: any;
  };
  recording?: {
    id: string;
    title: string | null;
    duration_sec: number | null;
    created_at: string;
  };
}

/**
 * Frame extraction status
 */
export type FrameExtractionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * Frame extraction metadata
 */
export interface FrameExtractionMetadata {
  status: FrameExtractionStatus;
  frameCount: number;
  framesExtracted: boolean;
  extractionRate?: number; // frames per second
  totalDuration?: number; // seconds
  startedAt?: string;
  completedAt?: string;
  estimatedCompletion?: number; // seconds remaining
  error?: string;
}

/**
 * Multimodal search mode
 */
export type MultimodalSearchMode = 'audio' | 'visual' | 'multimodal';

/**
 * Multimodal search options
 */
export interface MultimodalSearchOptions {
  orgId: string;
  limit?: number;
  threshold?: number;
  recordingIds?: string[];
  includeVisual?: boolean;
  audioWeight?: number; // 0-1, default 0.7
  visualWeight?: number; // 0-1, default 0.3
  includeOcr?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  contentTypes?: ('recording' | 'video' | 'audio' | 'document' | 'text')[];
  tagIds?: string[];
  tagFilterMode?: 'AND' | 'OR';
  collectionId?: string;
  favoritesOnly?: boolean;
}

/**
 * Multimodal search result
 */
export interface MultimodalSearchResult {
  query: string;
  mode: MultimodalSearchMode;
  audioResults?: Array<{
    id: string;
    recordingId: string;
    chunkText: string;
    similarity: number;
    startTimeSec?: number;
    endTimeSec?: number;
  }>;
  visualResults?: VisualSearchResult[];
  combinedResults?: Array<{
    type: 'audio' | 'visual';
    score: number;
    data: any;
  }>;
  metadata: {
    totalResults: number;
    audioCount: number;
    visualCount: number;
    threshold: number;
    processingTime: number;
    weights?: {
      audio: number;
      visual: number;
    };
  };
}

/**
 * Frame retrieval pagination options
 */
export interface FrameRetrievalOptions {
  page?: number;
  limit?: number;
  includeDescriptions?: boolean;
  includeOcr?: boolean;
  startTime?: number; // filter by time range
  endTime?: number;
}

/**
 * Paginated frame response
 */
export interface PaginatedFrameResponse {
  frames: Array<{
    id: string;
    frameTimeSec: number;
    frameUrl: string;
    visualDescription?: string;
    ocrText?: string;
    metadata: any;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    totalPages: number;
  };
  recording: {
    id: string;
    title: string | null;
    duration: number | null;
    frameCount: number;
  };
}
