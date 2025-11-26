/**
 * Zod Validation Schemas for Publishing API
 *
 * Validation schemas for publish requests, folder operations,
 * and organization publish settings.
 */

import { z } from 'zod';

// =====================================================
// ENUM SCHEMAS
// =====================================================

/** Supported publishing destinations */
export const publishDestinationSchema = z.enum([
  'google_drive',
  'sharepoint',
  'onedrive',
  'notion',
]);

/** Output format for published documents */
export const publishFormatSchema = z.enum(['native', 'markdown', 'pdf', 'html']);

/** Type of publish action */
export const publishActionSchema = z.enum([
  'publish',
  'update',
  'delete',
  'sync',
  'retry',
]);

/** What triggered the publish action */
export const publishTriggerSchema = z.enum([
  'manual',
  'auto',
  'webhook',
  'retry',
]);

/** Publication status */
export const publishStatusSchema = z.enum([
  'pending',
  'published',
  'failed',
  'syncing',
  'outdated',
]);

// =====================================================
// BRANDING SCHEMA
// =====================================================

/** Branding configuration for published documents */
export const brandingConfigSchema = z.object({
  includeVideoLink: z.boolean().default(true),
  includePoweredByFooter: z.boolean().default(true),
  includeEmbeddedPlayer: z.boolean().default(false),
  customFooterText: z.string().max(500).optional(),
});

/** Partial branding config for updates */
export const partialBrandingConfigSchema = brandingConfigSchema.partial();

// =====================================================
// PUBLISH REQUEST SCHEMAS
// =====================================================

/** POST /api/library/[id]/publish - Publish a document */
export const publishRequestSchema = z.object({
  destination: publishDestinationSchema,
  connectorId: z.string().uuid().optional(),
  folderId: z.string().max(500).optional(),
  folderPath: z.string().max(1000).optional(),
  format: publishFormatSchema.default('native'),
  branding: partialBrandingConfigSchema.optional(),
  customTitle: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(255, 'Title must be 255 characters or less')
    .optional(),
});

export type PublishRequestInput = z.infer<typeof publishRequestSchema>;

/** DELETE /api/library/[id]/publish/[publicationId] - Query params */
export const deletePublicationQuerySchema = z.object({
  deleteExternal: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type DeletePublicationQueryInput = z.infer<
  typeof deletePublicationQuerySchema
>;

// =====================================================
// FOLDER SCHEMAS
// =====================================================

/** Regex for invalid folder name characters */
const INVALID_FOLDER_NAME_CHARS = /[<>:"/\\|?*]/;

/** GET /api/integrations/[type]/folders - List folders */
export const folderListQuerySchema = z.object({
  connectorId: z.string().uuid('Invalid connector ID'),
  parentId: z.string().max(500).optional(),
  search: z.string().max(100).optional(),
  pageToken: z.string().max(500).optional(),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .default(50),
});

export type FolderListQueryInput = z.infer<typeof folderListQuerySchema>;

/** POST /api/integrations/[type]/folders - Create folder */
export const createFolderSchema = z.object({
  connectorId: z.string().uuid('Invalid connector ID'),
  name: z
    .string()
    .min(1, 'Folder name cannot be empty')
    .max(255, 'Folder name must be 255 characters or less')
    .refine(
      (name) => !INVALID_FOLDER_NAME_CHARS.test(name),
      'Folder name contains invalid characters: < > : " / \\ | ? *'
    ),
  parentId: z.string().max(500).optional(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

// =====================================================
// ORG PUBLISH SETTINGS SCHEMAS
// =====================================================

/** Base schema for org publish settings (without refinement) */
const orgPublishSettingsBaseSchema = z.object({
  autoPublishEnabled: z.boolean(),
  autoPublishDestination: publishDestinationSchema.nullable(),
  autoPublishConnectorId: z.string().uuid().nullable(),
  autoPublishFolderId: z.string().max(500).nullable(),
  autoPublishFolderPath: z.string().max(1000).nullable(),
  defaultFormat: publishFormatSchema.default('native'),
  defaultBranding: brandingConfigSchema.default({
    includeVideoLink: true,
    includePoweredByFooter: true,
    includeEmbeddedPlayer: false,
  }),
  whiteLabelEnabled: z.boolean().default(false),
  customFooterText: z.string().max(500).nullable(),
  customVideoDomain: z
    .string()
    .url('Invalid URL format')
    .nullable()
    .or(z.literal('')),
});

/** PUT /api/organizations/[orgId]/settings/publish - Update settings */
export const orgPublishSettingsSchema = orgPublishSettingsBaseSchema.refine(
  (data) => {
    // If auto-publish is enabled, destination and connector must be set
    if (data.autoPublishEnabled) {
      return (
        data.autoPublishDestination !== null &&
        data.autoPublishConnectorId !== null
      );
    }
    return true;
  },
  {
    message:
      'Auto-publish destination and connector are required when auto-publish is enabled',
    path: ['autoPublishDestination'],
  }
);

export type OrgPublishSettingsInput = z.infer<typeof orgPublishSettingsSchema>;

/** Partial settings update - uses base schema to avoid refine/partial conflict */
export const orgPublishSettingsUpdateSchema = orgPublishSettingsBaseSchema.partial();

export type OrgPublishSettingsUpdateInput = z.infer<
  typeof orgPublishSettingsUpdateSchema
>;

// =====================================================
// CONNECTOR PUBLISH SCHEMAS
// =====================================================

/** Schema for connector publish configuration in connector_configs */
export const connectorPublishConfigSchema = z.object({
  supportsPublish: z.boolean().default(false),
  publishScopes: z.array(z.string()).optional(),
  lastPublishAt: z.string().datetime().optional(),
});

export type ConnectorPublishConfigInput = z.infer<
  typeof connectorPublishConfigSchema
>;

// =====================================================
// JOB PAYLOAD SCHEMAS
// =====================================================

/** Payload for publish_document background job */
export const publishDocumentJobPayloadSchema = z.object({
  contentId: z.string().uuid(),
  documentId: z.string().uuid(),
  orgId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  connectorId: z.string().uuid(),
  destination: publishDestinationSchema,
  folderId: z.string().max(500).optional(),
  folderPath: z.string().max(1000).optional(),
  format: publishFormatSchema.optional(),
  branding: partialBrandingConfigSchema.optional(),
  customTitle: z.string().max(255).optional(),
  triggerType: publishTriggerSchema.default('manual'),
});

export type PublishDocumentJobPayloadInput = z.infer<
  typeof publishDocumentJobPayloadSchema
>;

// =====================================================
// RESPONSE SCHEMAS (for type safety in API routes)
// =====================================================

/** Folder info in responses */
export const folderInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  hasChildren: z.boolean(),
  parentId: z.string().optional(),
  webUrl: z.string().url().optional(),
  modifiedAt: z.string().datetime().optional(),
});

export type FolderInfoOutput = z.infer<typeof folderInfoSchema>;

/** Folder list response */
export const folderListResponseSchema = z.object({
  folders: z.array(folderInfoSchema),
  nextPageToken: z.string().optional(),
  hasMore: z.boolean(),
});

export type FolderListResponseOutput = z.infer<typeof folderListResponseSchema>;

/** Publication in responses */
export const publicationResponseSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid(),
  documentId: z.string().uuid(),
  connectorId: z.string().uuid(),
  destination: publishDestinationSchema,
  externalId: z.string(),
  externalUrl: z.string().url(),
  externalPath: z.string().optional(),
  folderId: z.string().optional(),
  folderPath: z.string().optional(),
  format: publishFormatSchema,
  customTitle: z.string().optional(),
  brandingConfig: brandingConfigSchema,
  status: publishStatusSchema,
  lastPublishedAt: z.string().datetime().optional(),
  lastSyncedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PublicationResponseOutput = z.infer<
  typeof publicationResponseSchema
>;

/** Publish success response */
export const publishSuccessResponseSchema = z.object({
  success: z.literal(true),
  publication: publicationResponseSchema,
  externalUrl: z.string().url(),
});

export type PublishSuccessResponseOutput = z.infer<
  typeof publishSuccessResponseSchema
>;

/** Publications list response */
export const publicationsListResponseSchema = z.object({
  publications: z.array(publicationResponseSchema),
  total: z.number().int().min(0),
});

export type PublicationsListResponseOutput = z.infer<
  typeof publicationsListResponseSchema
>;

// =====================================================
// VALIDATION HELPERS
// =====================================================

/**
 * Validate publish request body
 * Returns validated data or throws ZodError
 */
export function validatePublishRequest(data: unknown): PublishRequestInput {
  return publishRequestSchema.parse(data);
}

/**
 * Validate folder list query params
 * Returns validated data or throws ZodError
 */
export function validateFolderListQuery(data: unknown): FolderListQueryInput {
  return folderListQuerySchema.parse(data);
}

/**
 * Validate create folder request
 * Returns validated data or throws ZodError
 */
export function validateCreateFolderRequest(data: unknown): CreateFolderInput {
  return createFolderSchema.parse(data);
}

/**
 * Validate org publish settings update
 * Returns validated data or throws ZodError
 */
export function validateOrgPublishSettings(
  data: unknown
): OrgPublishSettingsInput {
  return orgPublishSettingsSchema.parse(data);
}

/**
 * Validate job payload
 * Returns validated data or throws ZodError
 */
export function validatePublishJobPayload(
  data: unknown
): PublishDocumentJobPayloadInput {
  return publishDocumentJobPayloadSchema.parse(data);
}

/**
 * Safe parse publish request (returns result object instead of throwing)
 */
export function safeParsePublishRequest(data: unknown) {
  return publishRequestSchema.safeParse(data);
}

/**
 * Safe parse folder list query
 */
export function safeParseFolderListQuery(data: unknown) {
  return folderListQuerySchema.safeParse(data);
}

/**
 * Safe parse create folder request
 */
export function safeParseCreateFolderRequest(data: unknown) {
  return createFolderSchema.safeParse(data);
}
