/**
 * Chat Tool Definitions for AI Assistant
 *
 * Provides tool definitions for the Vercel AI SDK to enable the AI assistant
 * to search recordings, retrieve documents, access transcripts, and fetch metadata.
 *
 * Security:
 * - All tools enforce organization-level data isolation via orgId
 * - Database queries filtered by org_id to prevent cross-tenant data access
 * - Proper error handling with user-friendly messages
 *
 * Tools:
 * 1. searchRecordings - RAG-powered semantic search across recordings
 * 2. getDocument - Retrieve full document content by ID
 * 3. getTranscript - Get transcript with timestamps
 * 4. getRecordingMetadata - Fetch recording metadata
 * 5. listRecordings - List recent recordings
 */

import { tool } from 'ai';
import { z } from 'zod';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import {
  searchRecordingsInputSchema,
  getDocumentInputSchema,
  getTranscriptInputSchema,
  getRecordingMetadataInputSchema,
  listRecordingsInputSchema,
} from '@/lib/validations/chat';

import { injectRAGContext, type SourceCitation } from './chat-rag-integration';

/**
 * Tool execution context
 * Passed to all tool execute functions
 */
export interface ToolContext {
  orgId: string;
  userId: string;
}

/**
 * Standard tool response format
 */
interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  sources?: SourceCitation[];
}

/**
 * Helper: Format timestamp as MM:SS
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper: Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Search Recordings Execute Function
 *
 * Uses RAG integration to perform semantic search across recordings and transcripts.
 * Returns relevant excerpts with source citations.
 */
export async function executeSearchRecordings(
  { query, limit, recordingIds, includeTranscripts, includeDocuments, minRelevance }: any,
  { orgId }: ToolContext
): Promise<ToolResponse> {
    try {
      // Input validation
      if (!orgId) {
        return {
          success: false,
          error: 'Organization context is required for search operations',
        };
      }

      // Perform RAG search
      const ragContext = await injectRAGContext(query, orgId, {
        limit: limit || 5,
        minRelevance: minRelevance || 0.7,
        includeTranscripts: includeTranscripts !== false,
        includeDocuments: includeDocuments !== false,
        recordingIds,
        useHierarchical: true,
        enableCache: true,
      });

      // Check if results found
      if (!ragContext.sources || ragContext.sources.length === 0) {
        return {
          success: true,
          data: {
            message: 'No relevant recordings found for your query. Try different keywords or check if you have any recordings.',
            results: [],
            searchMetadata: ragContext.metadata,
          },
          sources: [],
        };
      }

      // Format results for the assistant
      const formattedResults = ragContext.sources.map((source, index) => ({
        rank: index + 1,
        title: source.title,
        excerpt: source.excerpt,
        relevanceScore: Math.round(source.relevanceScore * 100),
        type: source.type,
        recordingId: source.recordingId,
        timestamp: source.timestamp ? formatTimestamp(source.timestamp) : undefined,
        url: source.url,
        hasVisualContext: source.metadata?.hasVisualContext || false,
      }));

      return {
        success: true,
        data: {
          message: `Found ${ragContext.sources.length} relevant result(s)`,
          results: formattedResults,
          searchMetadata: {
            searchMode: ragContext.metadata?.searchMode,
            searchTimeMs: ragContext.metadata?.searchTimeMs,
            cacheHit: ragContext.metadata?.cacheHit,
          },
        },
        sources: ragContext.sources,
      };
  } catch (error) {
    console.error('[ChatTools] searchRecordings error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? `Search failed: ${error.message}`
          : 'An unexpected error occurred while searching recordings',
    };
  }
}

/**
 * Get Document Execute Function
 *
 * Retrieves the full content of a specific document by ID.
 * Verifies user has access via organization membership.
 */
export async function executeGetDocument(
  { documentId, includeMetadata }: any,
  { orgId }: ToolContext
): Promise<ToolResponse> {
    try {
      // Use admin client - auth already verified in API route
      const { data: document, error } = await supabaseAdmin
        .from('documents')
        .select(
          `
          id,
          recording_id,
          org_id,
          markdown,
          summary,
          version,
          model,
          status,
          created_at,
          updated_at,
          recordings!inner (
            id,
            title,
            description,
            status,
            duration_sec,
            created_at
          )
        `
        )
        .eq('id', documentId)
        .eq('org_id', orgId)
        .single();

      if (error || !document) {
        return {
          success: false,
          error: error
            ? 'Document not found or you do not have permission to access it'
            : 'Document not found',
        };
      }

      // Format response
      const recording = Array.isArray(document.recordings)
        ? document.recordings[0]
        : document.recordings;

      const result: any = {
        documentId: document.id,
        content: document.markdown,
        summary: document.summary,
        recordingTitle: recording?.title || 'Untitled Recording',
        status: document.status,
      };

      if (includeMetadata !== false) {
        result.metadata = {
          recordingId: document.recording_id,
          version: document.version,
          model: document.model,
          duration: recording?.duration_sec
            ? formatDuration(recording.duration_sec)
            : undefined,
          createdAt: new Date(document.created_at).toLocaleString(),
          updatedAt: new Date(document.updated_at).toLocaleString(),
        };
      }

      return {
        success: true,
        data: result,
      };
  } catch (error) {
    console.error('[ChatTools] getDocument error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? `Failed to retrieve document: ${error.message}`
          : 'An unexpected error occurred while retrieving the document',
    };
  }
}

/**
 * Get Transcript Execute Function
 *
 * Retrieves the full transcript with timestamps for a recording.
 * Returns formatted transcript with word-level timing information.
 */
export async function executeGetTranscript(
  { recordingId, includeTimestamps, formatTimestamps }: any,
  { orgId }: ToolContext
): Promise<ToolResponse> {
    try {
      // Use admin client - auth already verified in API route
      const { data: transcript, error } = await supabaseAdmin
        .from('transcripts')
        .select(
          `
          id,
          recording_id,
          language,
          text,
          words_json,
          confidence,
          provider,
          created_at,
          recordings!inner (
            id,
            org_id,
            title,
            description,
            duration_sec,
            status
          )
        `
        )
        .eq('recording_id', recordingId)
        .single();

      if (error || !transcript) {
        return {
          success: false,
          error: error
            ? 'Transcript not found or you do not have permission to access it'
            : 'Transcript not found for this recording',
        };
      }

      // Verify organization access
      const recording = Array.isArray(transcript.recordings)
        ? transcript.recordings[0]
        : transcript.recordings;

      if (recording.org_id !== orgId) {
        return {
          success: false,
          error: 'You do not have permission to access this transcript',
        };
      }

      // Format transcript text
      let formattedText = transcript.text;

      // Add timestamps if requested and available
      if (includeTimestamps && transcript.words_json) {
        try {
          const words = Array.isArray(transcript.words_json)
            ? transcript.words_json
            : JSON.parse(transcript.words_json as string);

          if (Array.isArray(words) && words.length > 0) {
            // Group words into sentences or chunks with timestamps
            const chunks: string[] = [];
            let currentChunk = '';
            let currentTime = 0;

            words.forEach((word: any, index: number) => {
              const timestamp = word.start || word.timestamp || 0;

              // Add timestamp marker every 30 seconds or at sentence boundaries
              if (
                timestamp - currentTime >= 30 ||
                (index > 0 && /[.!?]$/.test(word.word || word.text || ''))
              ) {
                if (currentChunk) {
                  const timeStr = formatTimestamps
                    ? formatTimestamp(currentTime)
                    : `${currentTime}s`;
                  chunks.push(`[${timeStr}] ${currentChunk.trim()}`);
                  currentChunk = '';
                }
                currentTime = timestamp;
              }

              currentChunk += (word.word || word.text || '') + ' ';
            });

            // Add remaining chunk
            if (currentChunk) {
              const timeStr = formatTimestamps
                ? formatTimestamp(currentTime)
                : `${currentTime}s`;
              chunks.push(`[${timeStr}] ${currentChunk.trim()}`);
            }

            formattedText = chunks.join('\n\n');
          }
        } catch (parseError) {
          console.error('[ChatTools] Error parsing words_json:', parseError);
          // Fall back to plain text
        }
      }

      const result = {
        recordingId: transcript.recording_id,
        recordingTitle: recording.title || 'Untitled Recording',
        transcript: formattedText,
        language: transcript.language || 'en',
        confidence: transcript.confidence
          ? Math.round(transcript.confidence * 100)
          : undefined,
        provider: transcript.provider,
        duration: recording.duration_sec
          ? formatDuration(recording.duration_sec)
          : undefined,
        status: recording.status,
        createdAt: new Date(transcript.created_at).toLocaleString(),
      };

      return {
        success: true,
        data: result,
      };
  } catch (error) {
    console.error('[ChatTools] getTranscript error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? `Failed to retrieve transcript: ${error.message}`
          : 'An unexpected error occurred while retrieving the transcript',
    };
  }
}

/**
 * Get Recording Metadata Execute Function
 *
 * Retrieves metadata about a specific recording including title, duration,
 * status, and creation date.
 */
export async function executeGetRecordingMetadata(
  { recordingId, includeStats }: any,
  { orgId }: ToolContext
): Promise<ToolResponse> {
    try {
      // Use admin client - auth already verified in API route
      const { data: recording, error } = await supabaseAdmin
        .from('recordings')
        .select(
          `
          id,
          title,
          description,
          status,
          duration_sec,
          thumbnail_url,
          created_at,
          updated_at,
          completed_at,
          metadata
        `
        )
        .eq('id', recordingId)
        .eq('org_id', orgId)
        .single();

      if (error || !recording) {
        return {
          success: false,
          error: error
            ? 'Recording not found or you do not have permission to access it'
            : 'Recording not found',
        };
      }

      const result: any = {
        recordingId: recording.id,
        title: recording.title || 'Untitled Recording',
        description: recording.description,
        status: recording.status,
        duration: recording.duration_sec
          ? formatDuration(recording.duration_sec)
          : undefined,
        thumbnailUrl: recording.thumbnail_url,
        createdAt: new Date(recording.created_at).toLocaleString(),
        lastUpdated: new Date(recording.updated_at).toLocaleString(),
        completedAt: recording.completed_at
          ? new Date(recording.completed_at).toLocaleString()
          : undefined,
      };

      // Include additional stats if requested
      if (includeStats !== false) {
        const stats: any = {
          durationSeconds: recording.duration_sec,
        };

        // Get transcript word count if available
        const { data: transcript } = await supabaseAdmin
          .from('transcripts')
          .select('text')
          .eq('recording_id', recordingId)
          .single();

        if (transcript?.text) {
          stats.wordCount = transcript.text.split(/\s+/).length;
        }

        // Get chunk count
        const { count: chunkCount } = await supabaseAdmin
          .from('transcript_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('recording_id', recordingId);

        if (chunkCount !== null) {
          stats.chunks = chunkCount;
        }

        // Get document status
        const { data: document } = await supabaseAdmin
          .from('documents')
          .select('status, version')
          .eq('recording_id', recordingId)
          .single();

        if (document) {
          stats.documentStatus = document.status;
          stats.documentVersion = document.version;
        }

        result.stats = stats;
      }

      return {
        success: true,
        data: result,
      };
  } catch (error) {
    console.error('[ChatTools] getRecordingMetadata error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? `Failed to retrieve recording metadata: ${error.message}`
          : 'An unexpected error occurred while retrieving recording metadata',
    };
  }
}

/**
 * List Recordings Execute Function
 *
 * Lists recent recordings with optional filtering and sorting.
 * Useful for browsing available content.
 */
export async function executeListRecordings(
  { limit, status, sortBy, sortOrder }: any,
  { orgId }: ToolContext
): Promise<ToolResponse> {
    try {
      // Use admin client - auth already verified in API route
      // Build query
      let query = supabaseAdmin
        .from('recordings')
        .select(
          `
          id,
          title,
          description,
          status,
          duration_sec,
          thumbnail_url,
          created_at,
          updated_at
        `,
          { count: 'exact' }
        )
        .eq('org_id', orgId);

      // Apply status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      // Apply sorting
      const sortField = sortBy || 'created_at';
      const sortAsc = sortOrder === 'asc';
      query = query.order(sortField, { ascending: sortAsc });

      // Apply limit
      query = query.limit(limit || 10);

      const { data: recordings, error, count } = await query;

      if (error) {
        return {
          success: false,
          error: `Failed to retrieve recordings: ${error.message}`,
        };
      }

      if (!recordings || recordings.length === 0) {
        return {
          success: true,
          data: {
            message: status
              ? `No recordings found with status "${status}"`
              : 'No recordings found. Create your first recording to get started.',
            recordings: [],
            total: 0,
          },
        };
      }

      // Format recordings
      const formattedRecordings = recordings.map((rec) => ({
        id: rec.id,
        title: rec.title || 'Untitled Recording',
        description: rec.description,
        status: rec.status,
        duration: rec.duration_sec ? formatDuration(rec.duration_sec) : undefined,
        thumbnailUrl: rec.thumbnail_url,
        createdAt: new Date(rec.created_at).toLocaleString(),
        lastUpdated: new Date(rec.updated_at).toLocaleString(),
      }));

      return {
        success: true,
        data: {
          recordings: formattedRecordings,
          total: count || recordings.length,
          limit: limit || 10,
          sortedBy: `${sortField} (${sortOrder || 'desc'})`,
        },
      };
  } catch (error) {
    console.error('[ChatTools] listRecordings error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? `Failed to list recordings: ${error.message}`
          : 'An unexpected error occurred while listing recordings',
    };
  }
}

/**
 * Tool descriptions for AI SDK
 */
export const toolDescriptions = {
  searchRecordings:
    'Search through recordings and transcripts to find relevant information. ' +
    'Use this when the user asks about specific topics, wants to find recordings, ' +
    'or needs information from their recorded content. Returns relevant excerpts with timestamps.',
  getDocument:
    'Retrieve the full content of a specific document or summary. ' +
    'Use this when the user asks to see a complete document, wants to read a full summary, ' +
    'or needs detailed information from a specific recording document. ' +
    'Requires the document ID (UUID).',
  getTranscript:
    'Get the full transcript with timestamps for a recording. ' +
    'Use this when the user wants to see the complete transcript, ' +
    'needs specific timing information, or wants to reference exact words spoken. ' +
    'Requires the recording ID (UUID).',
  getRecordingMetadata:
    'Get metadata about a specific recording including title, duration, status, and creation date. ' +
    "Use this when the user asks about a specific recording's details, " +
    'wants to know when something was recorded, or needs basic information about a recording. ' +
    'Requires the recording ID (UUID).',
  listRecordings:
    'List recent recordings with optional filtering by status and sorting. ' +
    'Use this when the user wants to see their recordings, ' +
    'browse available content, or get an overview of recorded sessions. ' +
    'Returns a list of recordings with basic metadata.',
};
