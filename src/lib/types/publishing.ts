/**
 * Publishing Types for Bidirectional Sync
 *
 * Types for publishing documents to external systems (Google Drive, SharePoint, OneDrive)
 * and managing publication state, logs, and organization settings.
 */

// =====================================================
// ENUMS
// =====================================================

/** Status of a published document */
export type PublishStatus =
  | 'pending'
  | 'published'
  | 'failed'
  | 'syncing'
  | 'outdated';

/** Output format for published documents */
export type PublishFormat = 'native' | 'markdown' | 'pdf' | 'html';

/** Type of publish action for logging */
export type PublishAction = 'publish' | 'update' | 'delete' | 'sync' | 'retry';

/** What triggered the publish action */
export type PublishTrigger = 'manual' | 'auto' | 'webhook' | 'retry';

/** Supported publishing destinations */
export type PublishDestination =
  | 'google_drive'
  | 'sharepoint'
  | 'onedrive'
  | 'notion';

// =====================================================
// CORE TYPES
// =====================================================

/** Branding configuration for published documents */
export interface BrandingConfig {
  /** Include link back to original video/recording */
  includeVideoLink: boolean;
  /** Include "Powered by Tribora" footer */
  includePoweredByFooter: boolean;
  /** Include embedded video player (iframe) */
  includeEmbeddedPlayer: boolean;
  /** Custom footer text (overrides default) */
  customFooterText?: string;
}

/** Default branding configuration */
export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  includeVideoLink: true,
  includePoweredByFooter: true,
  includeEmbeddedPlayer: false,
};

// =====================================================
// DATABASE MODELS
// =====================================================

/** Published document record - tracks documents published to external systems */
export interface PublishedDocument {
  id: string;
  contentId: string;
  documentId: string;
  connectorId: string;
  orgId: string;
  publishedBy: string | null;

  // External system info
  destination: PublishDestination;
  externalId: string;
  externalUrl: string;
  externalPath?: string;
  folderId?: string;
  folderPath?: string;

  // Publishing config
  format: PublishFormat;
  customTitle?: string;
  brandingConfig: BrandingConfig;

  // Status tracking
  status: PublishStatus;
  lastPublishedAt?: Date;
  lastSyncedAt?: Date;
  lastError?: string;
  retryCount: number;

  // Version tracking
  documentVersion: number;
  externalVersion?: string;
  contentHash?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/** Database row representation (snake_case) */
export interface PublishedDocumentRow {
  id: string;
  content_id: string;
  document_id: string;
  connector_id: string;
  org_id: string;
  published_by: string | null;

  destination: string;
  external_id: string;
  external_url: string;
  external_path: string | null;
  folder_id: string | null;
  folder_path: string | null;

  format: string;
  custom_title: string | null;
  branding_config: Record<string, unknown>;

  status: string;
  last_published_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  retry_count: number;

  document_version: number;
  external_version: string | null;
  content_hash: string | null;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Publish log entry - audit trail for publish operations */
export interface PublishLog {
  id: string;
  publishedDocumentId?: string;
  contentId: string;
  orgId: string;
  userId?: string;

  // Action info
  action: PublishAction;
  destination: PublishDestination;
  status: 'pending' | 'success' | 'failed';

  // Error tracking
  errorMessage?: string;
  errorCode?: string;

  // Performance metrics
  durationMs?: number;
  contentSizeBytes?: number;
  apiCallsMade: number;

  // Context
  triggerType: PublishTrigger;
  requestMetadata: Record<string, unknown>;
  resultMetadata: Record<string, unknown>;

  // Timestamps
  createdAt: Date;
  completedAt?: Date;
}

/** Database row representation for publish logs */
export interface PublishLogRow {
  id: string;
  published_document_id: string | null;
  content_id: string;
  org_id: string;
  user_id: string | null;

  action: string;
  destination: string;
  status: string;

  error_message: string | null;
  error_code: string | null;

  duration_ms: number | null;
  content_size_bytes: number | null;
  api_calls_made: number;

  trigger_type: string;
  request_metadata: Record<string, unknown>;
  result_metadata: Record<string, unknown>;

  created_at: string;
  completed_at: string | null;
}

/** Organization publish settings */
export interface OrgPublishSettings {
  id: string;
  orgId: string;

  // Auto-publish settings
  autoPublishEnabled: boolean;
  autoPublishDestination?: PublishDestination;
  autoPublishConnectorId?: string;
  autoPublishFolderId?: string;
  autoPublishFolderPath?: string;

  // Default settings
  defaultFormat: PublishFormat;
  defaultBranding: BrandingConfig;

  // White-label options
  whiteLabelEnabled: boolean;
  customFooterText?: string;
  customVideoDomain?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/** Database row representation for org publish settings */
export interface OrgPublishSettingsRow {
  id: string;
  org_id: string;

  auto_publish_enabled: boolean;
  auto_publish_destination: string | null;
  auto_publish_connector_id: string | null;
  auto_publish_folder_id: string | null;
  auto_publish_folder_path: string | null;

  default_format: string;
  default_branding: Record<string, unknown>;

  white_label_enabled: boolean;
  custom_footer_text: string | null;
  custom_video_domain: string | null;

  created_at: string;
  updated_at: string;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

/** Request to publish a document */
export interface PublishRequest {
  destination: PublishDestination;
  connectorId?: string;
  folderId?: string;
  folderPath?: string;
  format?: PublishFormat;
  branding?: Partial<BrandingConfig>;
  customTitle?: string;
}

/** Response from publish operation */
export interface PublishResponse {
  success: boolean;
  publication: PublishedDocument;
  externalUrl: string;
}

/** Request to list folders */
export interface FolderListRequest {
  connectorId: string;
  parentId?: string;
  search?: string;
  pageToken?: string;
  pageSize?: number;
}

/** Folder information from external system */
export interface FolderInfo {
  id: string;
  name: string;
  path: string;
  hasChildren: boolean;
  parentId?: string;
  webUrl?: string;
  modifiedAt?: Date;
}

/** Response from folder list operation */
export interface FolderListResponse {
  folders: FolderInfo[];
  nextPageToken?: string;
  hasMore: boolean;
}

/** Request to create a folder */
export interface CreateFolderRequest {
  connectorId: string;
  name: string;
  parentId?: string;
}

/** Response from folder creation */
export interface CreateFolderResponse {
  folder: FolderInfo;
}

// =====================================================
// CONNECTOR TYPES
// =====================================================

/** Connector configuration extensions for publishing */
export interface PublishableConnectorConfig {
  supportsPublish: boolean;
  publishScopes?: string[];
  lastPublishAt?: Date;
}

/**
 * Options for publishing a document via connector.
 *
 * Content can be provided as either a string or Buffer:
 * - For text formats (markdown, html, native): provide a UTF-8 string
 * - For binary formats (pdf): provide a Buffer or base64-encoded string
 *
 * When content is a string and format is 'pdf', the connector will attempt
 * to decode it as base64. If the string doesn't appear to be base64-encoded
 * (e.g., it's actual binary data as a string), it will be used as-is.
 */
export interface ConnectorPublishOptions {
  title: string;
  /** Document content - string for text formats, Buffer for binary formats */
  content: Buffer | string;
  format: PublishFormat;
  folderId?: string;
  metadata?: Record<string, unknown>;
}

/** Result from connector publish operation */
export interface ConnectorPublishResult {
  externalId: string;
  externalUrl: string;
  externalPath?: string;
}

/**
 * Options for updating a document via connector.
 *
 * Content can be provided as either a string or Buffer:
 * - For text formats (markdown, html, native): provide a UTF-8 string
 * - For binary formats (pdf): provide a Buffer or base64-encoded string
 */
export interface ConnectorUpdateOptions {
  externalId: string;
  title?: string;
  /** Document content - string for text formats, Buffer for binary formats */
  content?: Buffer | string;
}

/** Document info from external system */
export interface ExternalDocumentInfo {
  exists: boolean;
  title?: string;
  modifiedAt?: Date;
  webUrl?: string;
  version?: string;
}

/** Interface for connectors that support publishing */
export interface PublishableConnector {
  /** Check if connector supports publishing (has write permissions) */
  supportsPublish(): boolean;

  /** List folders in external system */
  listFolders(options: FolderListRequest): Promise<FolderListResponse>;

  /** Create a new folder */
  createFolder(options: CreateFolderRequest): Promise<CreateFolderResponse>;

  /** Publish a document to external system */
  publishDocument(
    options: ConnectorPublishOptions
  ): Promise<ConnectorPublishResult>;

  /** Update an existing document */
  updateDocument(options: ConnectorUpdateOptions): Promise<void>;

  /** Delete a document from external system */
  deleteDocument(externalId: string): Promise<void>;

  /** Get document info from external system */
  getDocumentInfo(externalId: string): Promise<ExternalDocumentInfo>;
}

// =====================================================
// SERVICE TYPES
// =====================================================

/** Options for DocumentPublisher.publish() */
export interface PublishOptions {
  contentId: string;
  documentId: string;
  orgId: string;
  userId?: string;
  connectorId: string;
  destination: PublishDestination;
  folderId?: string;
  folderPath?: string;
  format?: PublishFormat;
  branding?: Partial<BrandingConfig>;
  customTitle?: string;
  triggerType?: PublishTrigger;
}

/** Result from DocumentPublisher.publish() */
export interface PublishResult {
  success: boolean;
  publication?: PublishedDocument;
  externalUrl?: string;
  error?: string;
  errorCode?: string;
}

/** Error codes for publish operations */
export type PublishErrorCode =
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'SERVICE_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_FORMAT'
  | 'CONTENT_TOO_LARGE'
  | 'QUOTA_EXCEEDED'
  | 'UNKNOWN_ERROR';

/** Retryable error codes */
export const RETRYABLE_ERROR_CODES: PublishErrorCode[] = [
  'RATE_LIMITED',
  'TIMEOUT',
  'SERVICE_UNAVAILABLE',
];

// =====================================================
// JOB TYPES
// =====================================================

/** Payload for publish_document job */
export interface PublishDocumentJobPayload {
  contentId: string;
  documentId: string;
  orgId: string;
  userId?: string;
  connectorId: string;
  destination: PublishDestination;
  folderId?: string;
  folderPath?: string;
  format?: PublishFormat;
  branding?: Partial<BrandingConfig>;
  customTitle?: string;
  triggerType?: PublishTrigger;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/** Convert database row to PublishedDocument model */
export function mapPublishedDocumentRow(
  row: PublishedDocumentRow
): PublishedDocument {
  return {
    id: row.id,
    contentId: row.content_id,
    documentId: row.document_id,
    connectorId: row.connector_id,
    orgId: row.org_id,
    publishedBy: row.published_by,
    destination: row.destination as PublishDestination,
    externalId: row.external_id,
    externalUrl: row.external_url,
    externalPath: row.external_path ?? undefined,
    folderId: row.folder_id ?? undefined,
    folderPath: row.folder_path ?? undefined,
    format: row.format as PublishFormat,
    customTitle: row.custom_title ?? undefined,
    brandingConfig: (row.branding_config as BrandingConfig) ?? DEFAULT_BRANDING_CONFIG,
    status: row.status as PublishStatus,
    lastPublishedAt: row.last_published_at
      ? new Date(row.last_published_at)
      : undefined,
    lastSyncedAt: row.last_synced_at
      ? new Date(row.last_synced_at)
      : undefined,
    lastError: row.last_error ?? undefined,
    retryCount: row.retry_count,
    documentVersion: row.document_version,
    externalVersion: row.external_version ?? undefined,
    contentHash: row.content_hash ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
  };
}

/** Convert database row to PublishLog model */
export function mapPublishLogRow(row: PublishLogRow): PublishLog {
  return {
    id: row.id,
    publishedDocumentId: row.published_document_id ?? undefined,
    contentId: row.content_id,
    orgId: row.org_id,
    userId: row.user_id ?? undefined,
    action: row.action as PublishAction,
    destination: row.destination as PublishDestination,
    status: row.status as 'pending' | 'success' | 'failed',
    errorMessage: row.error_message ?? undefined,
    errorCode: row.error_code ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    contentSizeBytes: row.content_size_bytes ?? undefined,
    apiCallsMade: row.api_calls_made,
    triggerType: row.trigger_type as PublishTrigger,
    requestMetadata: row.request_metadata,
    resultMetadata: row.result_metadata,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

/** Convert database row to OrgPublishSettings model */
export function mapOrgPublishSettingsRow(
  row: OrgPublishSettingsRow
): OrgPublishSettings {
  return {
    id: row.id,
    orgId: row.org_id,
    autoPublishEnabled: row.auto_publish_enabled,
    autoPublishDestination: row.auto_publish_destination
      ? (row.auto_publish_destination as PublishDestination)
      : undefined,
    autoPublishConnectorId: row.auto_publish_connector_id ?? undefined,
    autoPublishFolderId: row.auto_publish_folder_id ?? undefined,
    autoPublishFolderPath: row.auto_publish_folder_path ?? undefined,
    defaultFormat: row.default_format as PublishFormat,
    defaultBranding: (row.default_branding as BrandingConfig) ?? DEFAULT_BRANDING_CONFIG,
    whiteLabelEnabled: row.white_label_enabled,
    customFooterText: row.custom_footer_text ?? undefined,
    customVideoDomain: row.custom_video_domain ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
