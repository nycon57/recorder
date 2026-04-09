/**
 * Chat Tool Definitions for AI Assistant
 *
 * Provides tool definitions for the Vercel AI SDK to enable the AI assistant
 * to search content, retrieve documents, access transcripts, and fetch metadata.
 *
 * Security:
 * - All tools enforce organization-level data isolation via orgId
 * - Database queries filtered by org_id to prevent cross-tenant data access
 * - Proper error handling with user-friendly messages
 *
 * Tools:
 * 1. searchRecordings - RAG-powered semantic search across content
 * 2. getDocument - Retrieve full document content by ID
 * 3. getTranscript - Get transcript with timestamps
 * 4. getRecordingMetadata - Fetch content metadata
 * 5. listRecordings - List recent content items
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
  { query, limit, contentIds, includeTranscripts, includeDocuments, minRelevance }: any,
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
        contentIds,
        useHierarchical: true,
        enableCache: true,
      });

      // Check if results found
      if (!ragContext.sources || ragContext.sources.length === 0) {
        return {
          success: true,
          data: {
            message: 'No relevant content found for your query. Try different keywords or check if you have any content.',
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
        contentId: source.contentId,
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
          : 'An unexpected error occurred while searching content',
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
          content_id,
          org_id,
          markdown,
          summary,
          version,
          model,
          status,
          created_at,
          updated_at,
          content!inner (
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
      const content = Array.isArray(document.content)
        ? document.content[0]
        : document.content;

      const result: any = {
        documentId: document.id,
        content: document.markdown,
        summary: document.summary,
        contentTitle: content?.title || 'Untitled Content',
        status: document.status,
      };

      if (includeMetadata !== false) {
        result.metadata = {
          contentId: document.content_id,
          version: document.version,
          model: document.model,
          duration: content?.duration_sec
            ? formatDuration(content.duration_sec)
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
 * Retrieves the full transcript with timestamps for content.
 * Returns formatted transcript with word-level timing information.
 */
export async function executeGetTranscript(
  { contentId, includeTimestamps, formatTimestamps }: any,
  { orgId }: ToolContext
): Promise<ToolResponse> {
    try {
      // Use admin client - auth already verified in API route
      const { data: transcript, error } = await supabaseAdmin
        .from('transcripts')
        .select(
          `
          id,
          content_id,
          language,
          text,
          words_json,
          confidence,
          provider,
          created_at,
          content!inner (
            id,
            org_id,
            title,
            description,
            duration_sec,
            status
          )
        `
        )
        .eq('content_id', contentId)
        .single();

      if (error || !transcript) {
        return {
          success: false,
          error: error
            ? 'Transcript not found or you do not have permission to access it'
            : 'Transcript not found for this content',
        };
      }

      // Verify organization access
      const content = Array.isArray(transcript.content)
        ? transcript.content[0]
        : transcript.content;

      if (content.org_id !== orgId) {
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
        contentId: transcript.content_id,
        contentTitle: content.title || 'Untitled Content',
        transcript: formattedText,
        language: transcript.language || 'en',
        confidence: transcript.confidence
          ? Math.round(transcript.confidence * 100)
          : undefined,
        provider: transcript.provider,
        duration: content.duration_sec
          ? formatDuration(content.duration_sec)
          : undefined,
        status: content.status,
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
 * Get Content Metadata Execute Function
 *
 * Retrieves metadata about a specific content item including title, duration,
 * status, and creation date.
 */
export async function executeGetRecordingMetadata(
  { contentId, includeStats }: any,
  { orgId }: ToolContext
): Promise<ToolResponse> {
    try {
      // Use admin client - auth already verified in API route
      const { data: content, error } = await supabaseAdmin
        .from('content')
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
        .eq('id', contentId)
        .eq('org_id', orgId)
        .single();

      if (error || !content) {
        return {
          success: false,
          error: error
            ? 'Content not found or you do not have permission to access it'
            : 'Content not found',
        };
      }

      const result: any = {
        contentId: content.id,
        title: content.title || 'Untitled Content',
        description: content.description,
        status: content.status,
        duration: content.duration_sec
          ? formatDuration(content.duration_sec)
          : undefined,
        thumbnailUrl: content.thumbnail_url,
        createdAt: new Date(content.created_at).toLocaleString(),
        lastUpdated: new Date(content.updated_at).toLocaleString(),
        completedAt: content.completed_at
          ? new Date(content.completed_at).toLocaleString()
          : undefined,
      };

      // Include additional stats if requested
      if (includeStats !== false) {
        const stats: any = {
          durationSeconds: content.duration_sec,
        };

        // Get transcript word count if available
        const { data: transcript } = await supabaseAdmin
          .from('transcripts')
          .select('text')
          .eq('content_id', contentId)
          .single();

        if (transcript?.text) {
          stats.wordCount = transcript.text.split(/\s+/).length;
        }

        // Get chunk count
        const { count: chunkCount } = await supabaseAdmin
          .from('transcript_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', contentId);

        if (chunkCount !== null) {
          stats.chunks = chunkCount;
        }

        // Get document status
        const { data: document } = await supabaseAdmin
          .from('documents')
          .select('status, version')
          .eq('content_id', contentId)
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
 * List Content Execute Function
 *
 * Lists recent content items with optional filtering and sorting.
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
        .from('content')
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

      const { data: contentItems, error, count } = await query;

      if (error) {
        return {
          success: false,
          error: `Failed to retrieve content: ${error.message}`,
        };
      }

      if (!contentItems || contentItems.length === 0) {
        return {
          success: true,
          data: {
            message: status
              ? `No content found with status "${status}"`
              : 'No content found. Create your first content item to get started.',
            content: [],
            total: 0,
          },
        };
      }

      // Format content items
      const formattedContent = contentItems.map((item) => ({
        id: item.id,
        title: item.title || 'Untitled Content',
        description: item.description,
        status: item.status,
        duration: item.duration_sec ? formatDuration(item.duration_sec) : undefined,
        thumbnailUrl: item.thumbnail_url,
        createdAt: new Date(item.created_at).toLocaleString(),
        lastUpdated: new Date(item.updated_at).toLocaleString(),
      }));

      return {
        success: true,
        data: {
          content: formattedContent,
          total: count || contentItems.length,
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
          ? `Failed to list content: ${error.message}`
          : 'An unexpected error occurred while listing content',
    };
  }
}

/**
 * Search Concepts Execute Function
 *
 * Search for concepts across the knowledge graph.
 * Returns matching concepts with their types and mention counts.
 */
export async function executeSearchConcepts(
  args: {
    query: string;
    limit?: number;
    types?: string[];
    minMentions?: number;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const { orgId } = context;
  const { query, limit = 10, types, minMentions = 1 } = args;

  try {
    const { findMatchingConcepts } = await import('./concept-search');

    const concepts = await findMatchingConcepts(query, orgId, {
      limit,
      types: types as any,
      minMentions,
    });

    if (concepts.length === 0) {
      return {
        success: true,
        data: {
          message: `No concepts found matching "${query}". Try a different search term or check your content library.`,
          concepts: [],
        },
      };
    }

    // Format for AI understanding
    const conceptSummary = concepts
      .map(
        (c, i) =>
          `${i + 1}. **${c.name}** (${c.conceptType}) - mentioned ${c.mentionCount} times, ${Math.round(c.matchScore * 100)}% match`
      )
      .join('\n');

    return {
      success: true,
      data: {
        message: `Found ${concepts.length} concepts matching "${query}":\n${conceptSummary}`,
        concepts: concepts.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.conceptType,
          mentionCount: c.mentionCount,
          matchScore: Math.round(c.matchScore * 100),
        })),
      },
    };
  } catch (error) {
    console.error('[ChatTools] searchConcepts error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search concepts',
    };
  }
}

/**
 * Get Concept Details Execute Function
 *
 * Get detailed information about a specific concept including
 * related concepts and recent content mentions.
 */
export async function executeGetConceptDetails(
  args: {
    conceptId: string;
    includeRelated?: boolean;
    includeMentions?: boolean;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const { orgId } = context;
  const { conceptId, includeRelated = true, includeMentions = true } = args;

  try {
    // Get concept
    const { data: concept, error } = await supabaseAdmin
      .from('knowledge_concepts')
      .select('*')
      .eq('id', conceptId)
      .eq('org_id', orgId)
      .single();

    if (error || !concept) {
      return {
        success: false,
        error: 'Concept not found or access denied',
      };
    }

    let relatedConcepts: any[] = [];
    let recentMentions: any[] = [];

    // Get related concepts if requested
    // SECURITY NOTE: concept_relationships table is scoped by org_id via RLS.
    // The parent concept was already verified to belong to the org (line 692 above).
    if (includeRelated) {
      const { data: related } = await supabaseAdmin
        .from('concept_relationships')
        .select(
          `
          strength,
          relationship_type,
          related:related_concept_id(id, name, concept_type, mention_count)
        `
        )
        .eq('concept_id', conceptId)
        .order('strength', { ascending: false })
        .limit(10);

      relatedConcepts = (related || [])
        .map((r: any) => ({
          id: r.related?.id,
          name: r.related?.name,
          type: r.related?.concept_type,
          relationshipType: r.relationship_type,
          strength: Math.round(r.strength * 100),
        }))
        .filter((r) => r.id);
    }

    // Get recent mentions if requested
    if (includeMentions) {
      const { data: mentions } = await supabaseAdmin
        .from('concept_mentions')
        .select(
          `
          context,
          confidence,
          created_at,
          content:content_id(id, title, content_type)
        `
        )
        .eq('concept_id', conceptId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5);

      recentMentions = (mentions || [])
        .map((m: any) => ({
          contentId: m.content?.id,
          contentTitle: m.content?.title || 'Untitled',
          contentType: m.content?.content_type,
          context:
            m.context?.substring(0, 200) + (m.context?.length > 200 ? '...' : ''),
          confidence: Math.round(m.confidence * 100),
        }))
        .filter((m) => m.contentId);
    }

    // Format for AI
    let summary = `**${concept.name}** (${concept.concept_type})\n`;
    summary += `Mentioned ${concept.mention_count} times across your content.\n`;
    if (concept.description) {
      summary += `\nDescription: ${concept.description}\n`;
    }

    if (relatedConcepts.length > 0) {
      summary += `\nRelated concepts: ${relatedConcepts.map((r) => r.name).join(', ')}`;
    }

    if (recentMentions.length > 0) {
      summary += `\n\nRecent mentions:\n${recentMentions.map((m, i) => `${i + 1}. "${m.contentTitle}" - ${m.context}`).join('\n')}`;
    }

    return {
      success: true,
      data: {
        message: summary,
        concept: {
          id: concept.id,
          name: concept.name,
          type: concept.concept_type,
          description: concept.description,
          mentionCount: concept.mention_count,
          firstSeen: concept.first_seen_at,
          lastSeen: concept.last_seen_at,
        },
        relatedConcepts,
        recentMentions,
      },
    };
  } catch (error) {
    console.error('[ChatTools] getConceptDetails error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get concept details',
    };
  }
}

/**
 * Explore Knowledge Graph Execute Function
 *
 * Explore the knowledge graph structure to discover concepts and relationships.
 * Returns top concepts and their connections.
 */
export async function executeExploreKnowledgeGraph(
  args: {
    focusConceptId?: string;
    maxNodes?: number;
    types?: string[];
  },
  context: ToolContext
): Promise<ToolResponse> {
  const { orgId } = context;
  const { focusConceptId, maxNodes = 20, types } = args;

  try {
    // Build query for concepts
    let query = supabaseAdmin
      .from('knowledge_concepts')
      .select('id, name, concept_type, mention_count, description')
      .eq('org_id', orgId)
      .gte('mention_count', 2)
      .order('mention_count', { ascending: false })
      .limit(maxNodes);

    if (types && types.length > 0) {
      query = query.in('concept_type', types);
    }

    const { data: concepts, error } = await query;

    if (error) {
      throw error;
    }

    if (!concepts || concepts.length === 0) {
      return {
        success: true,
        data: {
          message:
            'Your knowledge graph is empty. Add more content to build your concept network.',
          concepts: [],
          relationships: [],
          stats: { totalConcepts: 0, totalRelationships: 0 },
        },
      };
    }

    // Get relationships between these concepts
    const conceptIds = concepts.map((c) => c.id);
    const { data: relationships } = await supabaseAdmin
      .from('concept_relationships')
      .select('concept_id, related_concept_id, relationship_type, strength')
      .in('concept_id', conceptIds)
      .in('related_concept_id', conceptIds)
      .gte('strength', 0.3);

    // Group by type for summary
    const byType: Record<string, number> = {};
    concepts.forEach((c) => {
      byType[c.concept_type] = (byType[c.concept_type] || 0) + 1;
    });

    // Format summary
    const typeBreakdown = Object.entries(byType)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');

    const topConcepts = concepts
      .slice(0, 5)
      .map(
        (c, i) =>
          `${i + 1}. **${c.name}** (${c.concept_type}, ${c.mention_count} mentions)`
      )
      .join('\n');

    return {
      success: true,
      data: {
        message: `Your knowledge graph contains ${concepts.length} concepts (${typeBreakdown}) with ${relationships?.length || 0} connections.\n\nTop concepts:\n${topConcepts}`,
        concepts: concepts.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.concept_type,
          mentionCount: c.mention_count,
          description: c.description,
        })),
        relationships: (relationships || []).map((r) => ({
          from: r.concept_id,
          to: r.related_concept_id,
          type: r.relationship_type,
          strength: Math.round(r.strength * 100),
        })),
        stats: {
          totalConcepts: concepts.length,
          totalRelationships: relationships?.length || 0,
          byType,
        },
      },
    };
  } catch (error) {
    console.error('[ChatTools] exploreKnowledgeGraph error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to explore knowledge graph',
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
  searchConcepts:
    'Search for key concepts and topics mentioned across your recordings. ' +
    'Use this to discover what technologies, tools, processes, or topics are covered in your knowledge base.',
  getConceptDetails:
    'Get detailed information about a specific concept, including related concepts and recent content mentions. ' +
    'Use this after finding a concept via searchConcepts.',
  exploreKnowledgeGraph:
    'Explore your knowledge graph to see how concepts are connected. ' +
    'Use this to understand the big picture of what topics and technologies are covered across your content.',
};
