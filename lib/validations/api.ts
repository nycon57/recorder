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
  refreshEmbeddings: z.boolean().optional().default(false),
});

// Reprocess recording schema
export const reprocessRecordingSchema = z.object({
  step: z.enum(['transcribe', 'document', 'embeddings', 'all']),
});

// Phase 4: Visual Search and Frame Management Schemas

/**
 * Visual search request schema
 */
export const visualSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  threshold: z.coerce.number().min(0).max(1).optional().default(0.7),
  recordingIds: z.array(z.string().uuid()).optional(),
  includeOcr: z.boolean().optional().default(true),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

/**
 * Frame retrieval query parameters schema
 */
export const frameRetrievalSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(300).optional().default(50),
  includeDescriptions: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional()
    .default(false),
  includeOcr: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional()
    .default(false),
  startTime: z.coerce.number().min(0).optional(),
  endTime: z.coerce.number().min(0).optional(),
});

/**
 * Multimodal search enhancement schema
 */
export const multimodalSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(2000),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  threshold: z.coerce.number().min(0).max(1).optional().default(0.7),
  recordingIds: z.array(z.string().uuid()).optional(),
  source: z.enum(['transcript', 'document']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  mode: z
    .enum(['vector', 'hybrid', 'agentic', 'multimodal'])
    .optional()
    .default('vector'),
  rerank: z.boolean().optional().default(false),
  // Multimodal options
  includeVisual: z.boolean().optional().default(true),
  audioWeight: z.coerce.number().min(0).max(1).optional().default(0.7),
  visualWeight: z.coerce.number().min(0).max(1).optional().default(0.3),
  includeOcr: z.boolean().optional().default(true),
  // Agentic mode options (existing)
  maxIterations: z.coerce.number().int().min(1).max(5).optional().default(3),
  enableSelfReflection: z.boolean().optional().default(true),
});

// Phase 5: Connector System Validation Schemas

/**
 * Connector CRUD schemas
 */
export const createConnectorSchema = z.object({
  connectorType: z.enum([
    'google_drive',
    'notion',
    'zoom',
    'microsoft_teams',
    'file_upload',
    'url_import',
  ]),
  name: z.string().min(1).max(255).optional(),
  credentials: z.record(z.any()),
  settings: z.record(z.any()).optional().default({}),
  syncFrequency: z
    .enum(['manual', 'hourly', 'daily', 'weekly'])
    .optional()
    .default('manual'),
});

export const updateConnectorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  credentials: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  syncFrequency: z.enum(['manual', 'hourly', 'daily', 'weekly']).optional(),
  isActive: z.boolean().optional(),
});

export const syncConnectorSchema = z.object({
  fullSync: z.boolean().optional().default(false),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  fileTypes: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
});

export const listConnectorDocumentsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z
    .enum(['pending', 'processing', 'completed', 'failed'])
    .optional(),
  search: z.string().optional(),
});

/**
 * OAuth schemas
 */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/**
 * Webhook schemas
 */
export const zoomWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    account_id: z.string().optional(),
    object: z.any(),
  }),
  event_ts: z.number().optional(),
});

export const teamsWebhookSchema = z.object({
  subscriptionId: z.string(),
  changeType: z.string(),
  resource: z.string(),
  resourceData: z.any().optional(),
  clientState: z.string().optional(),
});

export const driveWebhookSchema = z.object({
  kind: z.string(),
  id: z.string(),
  resourceId: z.string(),
  resourceUri: z.string(),
  resourceState: z.enum(['sync', 'add', 'remove', 'update', 'trash', 'untrash', 'change']),
  expiration: z.string().optional(),
});

/**
 * File upload schemas
 */
export const singleFileUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive(),
  mimeType: z.string(),
  metadata: z.record(z.any()).optional(),
});

export const batchUploadSchema = z.object({
  batchName: z.string().min(1).max(255).optional(),
  files: z.array(
    z.object({
      fileName: z.string().min(1).max(255),
      fileSize: z.number().positive(),
      mimeType: z.string(),
      metadata: z.record(z.any()).optional(),
    })
  ).min(1).max(100),
  metadata: z.record(z.any()).optional(),
});

// Phase 6: Admin API Validation Schemas

/**
 * Admin metrics query schema
 */
export const adminMetricsQuerySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
  includeJobs: z.boolean().optional().default(true),
  includeQuotas: z.boolean().optional().default(true),
  includeAlerts: z.boolean().optional().default(true),
});

/**
 * Admin analytics query schema
 */
export const adminAnalyticsQuerySchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d', '90d']).optional().default('7d'),
  metric: z
    .enum(['searches', 'latency', 'cache', 'usage', 'all'])
    .optional()
    .default('all'),
  orgId: z.string().uuid().optional(),
  granularity: z.enum(['hour', 'day', 'week']).optional().default('day'),
});

/**
 * Admin quota management schemas
 */
export const adminQuotaQuerySchema = z.object({
  planTier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  nearLimit: z.boolean().optional().default(false),
  limitThreshold: z.coerce.number().min(0).max(1).optional().default(0.9),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminUpdateQuotaSchema = z.object({
  orgId: z.string().uuid(),
  planTier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  searchesPerMonth: z.number().int().positive().optional(),
  storageGb: z.number().int().positive().optional(),
  recordingsPerMonth: z.number().int().positive().optional(),
  aiRequestsPerMonth: z.number().int().positive().optional(),
  connectorsAllowed: z.number().int().positive().optional(),
  apiRateLimit: z.number().int().positive().optional(),
  searchRateLimit: z.number().int().positive().optional(),
});

/**
 * Admin alert management schemas
 */
export const adminAlertQuerySchema = z.object({
  status: z.enum(['open', 'acknowledged', 'resolved']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminAcknowledgeAlertSchema = z.object({
  incidentId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});

export const adminResolveAlertSchema = z.object({
  incidentId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});

/**
 * Admin experiment management schemas
 */
export const adminExperimentQuerySchema = z.object({
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional(),
  feature: z
    .enum(['search_ranking', 'chunking', 'reranking', 'all'])
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminCreateExperimentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  feature: z.enum([
    'search_ranking',
    'chunking',
    'reranking',
    'query_expansion',
  ]),
  variants: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        config: z.record(z.any()),
      })
    )
    .min(2)
    .max(5),
  trafficAllocation: z.record(z.number().min(0).max(1)),
});

export const adminUpdateExperimentSchema = z.object({
  experimentId: z.string().uuid(),
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional(),
  trafficAllocation: z.record(z.number().min(0).max(1)).optional(),
  description: z.string().max(1000).optional(),
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
