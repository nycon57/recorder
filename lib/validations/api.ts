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

// ============================================================================
// Phase 7: Organization Management Validation Schemas
// ============================================================================

/**
 * User roles with hierarchy validation
 */
const roleEnum = z.enum(['owner', 'admin', 'contributor', 'reader']);

/**
 * User status validation
 */
const userStatusEnum = z.enum(['pending', 'active', 'suspended', 'deleted']);

/**
 * Visibility levels
 */
const visibilityEnum = z.enum(['private', 'department', 'org', 'public']);

/**
 * Timezone validation (IANA timezone strings)
 */
const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid timezone identifier' }
);

// ----------------------------------------------------------------------------
// Profile Management Schemas
// ----------------------------------------------------------------------------

/**
 * Update user profile schema
 */
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().max(255).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format (E.164)')
    .optional()
    .nullable(),
  timezone: timezoneSchema.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Avatar upload schema
 */
export const avatarUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive().max(5 * 1024 * 1024), // Max 5MB
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
});

export type UploadAvatarInput = z.infer<typeof avatarUploadSchema>;

/**
 * Update notification preferences
 */
export const updateNotificationPreferencesSchema = z.object({
  email: z
    .object({
      recordings_completed: z.boolean().optional(),
      share_received: z.boolean().optional(),
      mention: z.boolean().optional(),
      weekly_digest: z.boolean().optional(),
      security_alerts: z.boolean().optional(),
      billing_updates: z.boolean().optional(),
    })
    .optional(),
  in_app: z
    .object({
      recordings_completed: z.boolean().optional(),
      share_received: z.boolean().optional(),
      mention: z.boolean().optional(),
      system_updates: z.boolean().optional(),
    })
    .optional(),
  push: z
    .object({
      enabled: z.boolean().optional(),
      recordings_completed: z.boolean().optional(),
      mention: z.boolean().optional(),
    })
    .optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

/**
 * Update UI preferences
 */
export const updateUIPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  sidebar_collapsed: z.boolean().optional(),
  recordings_view: z.enum(['grid', 'list', 'table']).optional(),
  default_recording_visibility: visibilityEnum.optional(),
  language: z.string().min(2).max(5).optional(),
  items_per_page: z.number().int().min(10).max(100).optional(),
  compact_mode: z.boolean().optional(),
});

export type UpdateUIPreferencesInput = z.infer<typeof updateUIPreferencesSchema>;

// ----------------------------------------------------------------------------
// Organization Management Schemas
// ----------------------------------------------------------------------------

/**
 * Subscription status enum
 */
const subscriptionStatusEnum = z.enum([
  'active',
  'cancelled',
  'past_due',
  'trialing',
  'incomplete',
  'incomplete_expired',
  'unpaid',
]);

/**
 * Update organization details
 */
export const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  billing_email: z.string().email().optional(),
  logo_url: z.string().url().optional(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  domain: z
    .string()
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i, 'Invalid domain format')
    .optional(),
  settings: z
    .object({
      allow_member_invites: z.boolean().optional(),
      default_recording_visibility: visibilityEnum.optional(),
      require_2fa: z.boolean().optional(),
      enable_api_access: z.boolean().optional(),
      enable_webhooks: z.boolean().optional(),
      data_retention_days: z.number().int().min(0).max(3650).optional(),
      enable_audit_logs: z.boolean().optional(),
      enable_sso: z.boolean().optional(),
      allowed_email_domains: z.array(z.string()).optional(),
    })
    .optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

/**
 * Update organization branding
 */
export const updateOrgBrandingSchema = z.object({
  logo_url: z.string().url().optional(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  secondary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  accent_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  favicon_url: z.string().url().optional(),
  custom_css: z.string().max(10000).optional(),
});

export type UpdateOrgBrandingInput = z.infer<typeof updateOrgBrandingSchema>;

/**
 * Update organization features
 */
export const updateOrgFeaturesSchema = z.object({
  features: z
    .object({
      advanced_search: z.boolean().optional(),
      api_access: z.boolean().optional(),
      webhooks: z.boolean().optional(),
      sso: z.boolean().optional(),
      custom_branding: z.boolean().optional(),
      priority_support: z.boolean().optional(),
      unlimited_storage: z.boolean().optional(),
      video_analytics: z.boolean().optional(),
      team_collaboration: z.boolean().optional(),
      audit_logs: z.boolean().optional(),
    })
    .optional(),
  max_users: z.number().int().positive().optional(),
  max_storage_gb: z.number().int().positive().optional(),
});

export type UpdateOrgFeaturesInput = z.infer<typeof updateOrgFeaturesSchema>;

// ----------------------------------------------------------------------------
// Enhanced Member Management Schemas
// ----------------------------------------------------------------------------

/**
 * Invite a member to the organization (enhanced)
 */
export const enhancedInviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'contributor', 'reader'], {
    errorMap: () => ({ message: 'Role must be admin, contributor, or reader' }),
  }),
  department_ids: z.array(z.string().uuid()).optional().default([]),
  custom_message: z.string().max(500).optional(),
});

export type EnhancedInviteMemberInput = z.infer<typeof enhancedInviteMemberSchema>;

/**
 * Bulk invite members via CSV
 */
export const bulkInviteMemberSchema = z.object({
  invitations: z
    .array(
      z.object({
        email: z.string().email(),
        role: z.enum(['admin', 'contributor', 'reader']),
        department_ids: z.array(z.string().uuid()).optional().default([]),
        custom_message: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one invitation required')
    .max(100, 'Maximum 100 invitations at once'),
});

export type BulkInviteMemberInput = z.infer<typeof bulkInviteMemberSchema>;

/**
 * Update member role with permission validation (enhanced)
 * Note: Admins cannot promote users to owner or admin roles
 */
export const enhancedUpdateMemberRoleSchema = z
  .object({
    userId: z.string().uuid(),
    role: roleEnum,
    currentUserRole: z.enum(['owner', 'admin']).optional(), // For validation context
  })
  .refine(
    (data) => {
      // If current user is admin (not owner), they can't set owner/admin roles
      if (data.currentUserRole === 'admin') {
        return !['owner', 'admin'].includes(data.role);
      }
      return true;
    },
    {
      message: 'Admins cannot promote users to owner or admin roles',
      path: ['role'],
    }
  );

export type EnhancedUpdateMemberRoleInput = z.infer<typeof enhancedUpdateMemberRoleSchema>;

/**
 * Update member department assignments
 */
export const updateMemberDepartmentsSchema = z.object({
  userId: z.string().uuid(),
  department_ids: z
    .array(z.string().uuid())
    .min(0)
    .max(20, 'Maximum 20 departments per user'),
});

export type UpdateMemberDepartmentsInput = z.infer<typeof updateMemberDepartmentsSchema>;

/**
 * Remove member from organization
 */
export const removeMemberSchema = z.object({
  userId: z.string().uuid(),
  transferContentTo: z.string().uuid().optional(),
  deleteContent: z.boolean().optional().default(false),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

// ----------------------------------------------------------------------------
// Department Management Schemas
// ----------------------------------------------------------------------------

/**
 * Create a department
 */
export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  parent_id: z.string().uuid().optional(),
  default_visibility: visibilityEnum.optional().default('department'),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

/**
 * Update a department
 */
export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  parent_id: z.string().uuid().nullable().optional(),
  default_visibility: visibilityEnum.optional(),
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

/**
 * Delete a department with optional content reassignment
 */
export const deleteDepartmentSchema = z.object({
  reassign_to_department_id: z.string().uuid().optional(),
  delete_content: z.boolean().optional().default(false),
});

export type DeleteDepartmentInput = z.infer<typeof deleteDepartmentSchema>;

// ----------------------------------------------------------------------------
// Permission Management Schemas
// ----------------------------------------------------------------------------

/**
 * Resource types that support permissions
 */
const resourceTypeEnum = z.enum(['recording', 'document', 'tag', 'share']);

/**
 * Create a permission rule for content
 */
export const createPermissionRuleSchema = z.object({
  resource_type: resourceTypeEnum,
  resource_id: z.string().uuid(),
  visibility: visibilityEnum.default('org'),
  department_ids: z.array(z.string().uuid()).optional().default([]),
  allowed_user_ids: z.array(z.string().uuid()).optional().default([]),
  can_view: z.boolean().default(true),
  can_edit: z.boolean().default(false),
  can_delete: z.boolean().default(false),
  can_share: z.boolean().default(false),
});

export type CreatePermissionRuleInput = z.infer<typeof createPermissionRuleSchema>;

/**
 * Update a permission rule
 */
export const updatePermissionRuleSchema = z.object({
  visibility: visibilityEnum.optional(),
  department_ids: z.array(z.string().uuid()).optional(),
  allowed_user_ids: z.array(z.string().uuid()).optional(),
  can_view: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  can_delete: z.boolean().optional(),
  can_share: z.boolean().optional(),
});

export type UpdatePermissionRuleInput = z.infer<typeof updatePermissionRuleSchema>;

// ----------------------------------------------------------------------------
// API Key Management Schemas
// ----------------------------------------------------------------------------

/**
 * API key scopes
 */
const apiKeyScopeEnum = z.enum([
  '*', // Full access
  'recordings:read',
  'recordings:write',
  'recordings:delete',
  'search:execute',
  'documents:read',
  'documents:write',
  'analytics:read',
  'users:read',
  'webhooks:manage',
]);

/**
 * Create an API key
 */
export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(500).optional(),
  scopes: z
    .array(apiKeyScopeEnum)
    .min(1, 'At least one scope required')
    .max(20, 'Maximum 20 scopes'),
  rate_limit: z.number().int().positive().max(10000).optional().default(1000),
  ip_whitelist: z
    .array(z.string().ip({ version: 'v4', message: 'Invalid IPv4 address' }))
    .max(50, 'Maximum 50 IP addresses')
    .optional(),
  expires_at: z
    .string()
    .datetime()
    .refine((date) => new Date(date) > new Date(), {
      message: 'Expiration date must be in the future',
    })
    .optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/**
 * Update API key (limited fields)
 */
export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  scopes: z.array(apiKeyScopeEnum).min(1).max(20).optional(),
  rate_limit: z.number().int().positive().max(10000).optional(),
  ip_whitelist: z.array(z.string().ip({ version: 'v4' })).max(50).optional(),
  status: z.enum(['active', 'revoked']).optional(),
});

export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;

/**
 * Revoke API key
 */
export const revokeApiKeySchema = z.object({
  keyId: z.string().uuid(),
});

export type RevokeApiKeyInput = z.infer<typeof revokeApiKeySchema>;

// ----------------------------------------------------------------------------
// Webhook Management Schemas
// ----------------------------------------------------------------------------

/**
 * Webhook event types
 */
const webhookEventEnum = z.enum([
  'recording.created',
  'recording.completed',
  'recording.deleted',
  'recording.shared',
  'document.generated',
  'document.updated',
  'user.created',
  'user.updated',
  'user.deleted',
  'search.executed',
  'job.completed',
  'job.failed',
]);

/**
 * Create a webhook
 */
export const createWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(500).optional(),
  url: z.string().url('Invalid webhook URL'),
  events: z
    .array(webhookEventEnum)
    .min(1, 'At least one event type required')
    .max(20, 'Maximum 20 event types'),
  headers: z.record(z.string(), z.string()).optional().default({}),
  retry_enabled: z.boolean().optional().default(true),
  max_retries: z.number().int().min(0).max(10).optional().default(3),
  timeout_ms: z.number().int().min(1000).max(30000).optional().default(5000),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

/**
 * Update a webhook
 */
export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  url: z.string().url().optional(),
  events: z.array(webhookEventEnum).min(1).max(20).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  retry_enabled: z.boolean().optional(),
  max_retries: z.number().int().min(0).max(10).optional(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

/**
 * Test a webhook
 */
export const testWebhookSchema = z.object({
  webhookId: z.string().uuid(),
  event_type: webhookEventEnum.optional().default('recording.created'),
  test_payload: z.record(z.any()).optional(),
});

export type TestWebhookInput = z.infer<typeof testWebhookSchema>;

// ----------------------------------------------------------------------------
// Audit Log Schemas
// ----------------------------------------------------------------------------

/**
 * Audit log action types
 */
const auditActionEnum = z.enum([
  'user.created',
  'user.updated',
  'user.deleted',
  'user.login',
  'user.logout',
  'recording.created',
  'recording.updated',
  'recording.deleted',
  'recording.shared',
  'organization.updated',
  'organization.deleted',
  'role.updated',
  'permission.created',
  'permission.updated',
  'permission.deleted',
  'api_key.created',
  'api_key.revoked',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted',
  'department.created',
  'department.updated',
  'department.deleted',
]);

/**
 * Audit log filter schema
 */
export const auditLogFilterSchema = z.object({
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  user_id: z.string().uuid().optional(),
  action: auditActionEnum.optional(),
  resource_type: z
    .enum(['user', 'recording', 'organization', 'department', 'api_key', 'webhook'])
    .optional(),
  resource_id: z.string().uuid().optional(),
  ip_address: z.string().ip().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type AuditLogFilterInput = z.infer<typeof auditLogFilterSchema>;

/**
 * Export audit logs schema
 */
export const exportAuditLogsSchema = z.object({
  date_from: z.string().datetime(),
  date_to: z.string().datetime(),
  format: z.enum(['csv', 'json', 'xlsx']).optional().default('csv'),
  filters: auditLogFilterSchema.omit({ page: true, limit: true }).optional(),
});

export type ExportAuditLogsInput = z.infer<typeof exportAuditLogsSchema>;

// ----------------------------------------------------------------------------
// Session Management Schemas
// ----------------------------------------------------------------------------

/**
 * List active sessions
 */
export const listSessionsSchema = z.object({
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListSessionsInput = z.infer<typeof listSessionsSchema>;

/**
 * Revoke session schema
 */
export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;

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
