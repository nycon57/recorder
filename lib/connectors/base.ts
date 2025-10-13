/**
 * Base Connector Interface
 *
 * All connectors must implement this interface for consistent behavior across
 * different external data sources (Google Drive, Notion, Zoom, Teams, etc.)
 */

export enum ConnectorType {
  GOOGLE_DRIVE = 'google_drive',
  NOTION = 'notion',
  ZOOM = 'zoom',
  MICROSOFT_TEAMS = 'microsoft_teams',
  FILE_UPLOAD = 'file_upload',
  URL_IMPORT = 'url_import',
}

export interface ConnectorCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date | string;
  [key: string]: any;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  userName?: string;
  error?: string;
}

export interface TestResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, any>;
}

export interface SyncOptions {
  /** Full sync or incremental */
  fullSync?: boolean;

  /** Only sync files modified after this date */
  since?: Date;

  /** Maximum files to sync */
  limit?: number;

  /** File type filters */
  fileTypes?: string[];

  /** Folder/path filters */
  paths?: string[];

  /** Custom filters */
  filters?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  filesProcessed: number;
  filesUpdated: number;
  filesFailed: number;
  filesDeleted: number;
  errors: SyncError[];
  metadata?: Record<string, any>;
}

export interface SyncError {
  fileId: string;
  fileName: string;
  error: string;
  retryable: boolean;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  filters?: Record<string, any>;
}

export interface ConnectorFile {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  size?: number;
  modifiedAt: Date;
  createdAt?: Date;
  url?: string;
  path?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface FileContent {
  id: string;
  title: string;
  content: string | Buffer;
  mimeType: string;
  size: number;
  metadata: Record<string, any>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  source: string;
  payload: any;
  timestamp: Date;
}

/**
 * Base Connector Interface
 *
 * All connectors must implement this interface for consistent behavior.
 */
export interface Connector {
  /** Connector type identifier */
  readonly type: ConnectorType;

  /** Human-readable name */
  readonly name: string;

  /** Description of what this connector does */
  readonly description: string;

  /**
   * Authenticate with external service
   */
  authenticate(credentials: ConnectorCredentials): Promise<AuthResult>;

  /**
   * Test if connection is working
   */
  testConnection(): Promise<TestResult>;

  /**
   * Sync files from external source
   */
  sync(options?: SyncOptions): Promise<SyncResult>;

  /**
   * List available files
   */
  listFiles(options?: ListOptions): Promise<ConnectorFile[]>;

  /**
   * Download specific file
   */
  downloadFile(fileId: string): Promise<FileContent>;

  /**
   * Handle webhook event (if applicable)
   */
  handleWebhook?(event: WebhookEvent): Promise<void>;

  /**
   * Refresh expired credentials
   */
  refreshCredentials?(credentials: ConnectorCredentials): Promise<ConnectorCredentials>;
}
