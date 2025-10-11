import { z } from 'zod';

// Recording validation schemas
export const createRecordingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateRecordingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export const finalizeRecordingSchema = z.object({
  recordingId: z.string().uuid(),
  storagePath: z.string(),
  sizeBytes: z.number().positive(),
  sha256: z.string(),
  durationSec: z.number().positive().optional(),
});

// Chat/Assistant validation schemas
export const chatQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  scope: z
    .object({
      type: z.enum(['all', 'recording', 'tag']),
      id: z.string().optional(),
    })
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      })
    )
    .max(10)
    .optional(),
});

// Document generation schemas
export const regenerateDocumentSchema = z.object({
  recordingId: z.string().uuid(),
  template: z.enum(['default', 'tutorial', 'summary', 'qa']).optional(),
  model: z.enum(['gpt-4-turbo-preview', 'gpt-3.5-turbo']).optional(),
});

export const updateDocumentSchema = z.object({
  markdown: z.string().min(1).optional(),
  isPublished: z.boolean().optional(),
});

// Share schemas
export const createShareSchema = z.object({
  targetType: z.enum(['recording', 'document']),
  targetId: z.string().uuid(),
  password: z.string().min(6).max(100).optional(),
  expiresAt: z.string().datetime().optional(),
});

// Organization schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'contributor', 'reader']),
});

export const updateMemberRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(['owner', 'admin', 'contributor', 'reader']),
});

// Webhook validation schemas
export const transcriptionWebhookSchema = z.object({
  recordingId: z.string().uuid(),
  status: z.enum(['completed', 'failed']),
  text: z.string().optional(),
  wordsJson: z.any().optional(),
  confidence: z.number().min(0).max(1).optional(),
  language: z.string().optional(),
  error: z.string().optional(),
});

export const stripeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.any(),
  }),
});

// Pagination schema
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// Transcript update schema
export const updateTranscriptSchema = z.object({
  text: z.string().min(1),
});

// Document update schema (already exists above but adding for consistency)
export const updateDocumentMarkdownSchema = z.object({
  markdown: z.string().min(1),
});

// Reprocess recording schema
export const reprocessRecordingSchema = z.object({
  step: z.enum(['transcribe', 'document', 'embeddings', 'all']),
});

// Common response types
export type ApiError = {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
};

export type ApiSuccess<T = any> = {
  data: T;
  requestId?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  requestId?: string;
};
