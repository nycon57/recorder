/**
 * Chat Tool Validation Schemas
 *
 * Zod schemas for AI assistant tool inputs and outputs.
 * These schemas are used by the Vercel AI SDK tools.
 */

import { z } from 'zod';

/**
 * Schema for searchRecordings tool input
 */
export const searchRecordingsInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .max(500, 'Query too long')
    .describe('The search query to find relevant recordings and transcripts'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe('Maximum number of results to return'),
  recordingIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Limit search to specific recording IDs'),
  includeTranscripts: z
    .boolean()
    .default(true)
    .describe('Include transcript chunks in results'),
  includeDocuments: z
    .boolean()
    .default(true)
    .describe('Include document chunks in results'),
  minRelevance: z
    .number()
    .min(0)
    .max(1)
    .default(0.7)
    .describe('Minimum relevance score (0-1)'),
});

/**
 * Schema for getDocument tool input
 */
export const getDocumentInputSchema = z.object({
  documentId: z
    .string()
    .uuid('Invalid document ID format')
    .describe('The UUID of the document to retrieve'),
  includeMetadata: z
    .boolean()
    .default(true)
    .describe('Include document metadata in response'),
});

/**
 * Schema for getTranscript tool input
 */
export const getTranscriptInputSchema = z.object({
  recordingId: z
    .string()
    .uuid('Invalid recording ID format')
    .describe('The UUID of the recording'),
  includeTimestamps: z
    .boolean()
    .default(true)
    .describe('Include word-level timestamps'),
  formatTimestamps: z
    .boolean()
    .default(true)
    .describe('Format timestamps as MM:SS'),
});

/**
 * Schema for getRecordingMetadata tool input
 */
export const getRecordingMetadataInputSchema = z.object({
  recordingId: z
    .string()
    .uuid('Invalid recording ID format')
    .describe('The UUID of the recording'),
  includeStats: z
    .boolean()
    .default(true)
    .describe('Include statistics like duration, word count, etc.'),
});

/**
 * Schema for listRecordings tool input
 */
export const listRecordingsInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum number of recordings to return'),
  status: z
    .enum(['uploading', 'uploaded', 'transcribing', 'transcribed', 'doc_generating', 'completed', 'error'])
    .optional()
    .describe('Filter by recording status'),
  sortBy: z
    .enum(['created_at', 'updated_at', 'title', 'duration'])
    .default('created_at')
    .describe('Field to sort by'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .default('desc')
    .describe('Sort order'),
});

/**
 * Schema for tool response wrapper
 */
export const toolResponseSchema = z.object({
  success: z.boolean().describe('Whether the operation succeeded'),
  data: z.any().optional().describe('The result data'),
  error: z.string().optional().describe('Error message if failed'),
  sources: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['transcript', 'document']),
        title: z.string(),
        excerpt: z.string(),
        relevanceScore: z.number(),
        recordingId: z.string().optional(),
        timestamp: z.number().optional(),
        url: z.string(),
      })
    )
    .optional()
    .describe('Source citations for search results'),
});

/**
 * Type exports for TypeScript
 */
export type SearchRecordingsInput = z.infer<typeof searchRecordingsInputSchema>;
export type GetDocumentInput = z.infer<typeof getDocumentInputSchema>;
export type GetTranscriptInput = z.infer<typeof getTranscriptInputSchema>;
export type GetRecordingMetadataInput = z.infer<typeof getRecordingMetadataInputSchema>;
export type ListRecordingsInput = z.infer<typeof listRecordingsInputSchema>;
export type ToolResponse = z.infer<typeof toolResponseSchema>;
