/**
 * Google Drive Connector
 *
 * Implements OAuth authentication, file/folder listing, downloading,
 * token refresh, webhook support, Google Workspace file conversion,
 * and bidirectional sync (publishing) capabilities.
 */

import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import TurndownService from 'turndown';
import { Readable } from 'stream';

import {
  Connector,
  ConnectorType,
  ConnectorCredentials,
  AuthResult,
  TestResult,
  SyncOptions,
  SyncResult,
  SyncError,
  ListOptions,
  ConnectorFile,
  FileContent,
  WebhookEvent,
} from './base';

import {
  PublishableConnector,
  FolderListRequest,
  FolderListResponse,
  FolderInfo,
  CreateFolderRequest,
  CreateFolderResponse,
  ConnectorPublishOptions,
  ConnectorPublishResult,
  ConnectorUpdateOptions,
  ExternalDocumentInfo,
  PublishFormat,
} from '@/lib/types/publishing';

import {
  TokenManager,
  createGoogleRefreshFunction,
  TokenSet,
} from '@/lib/services/token-manager';

// =====================================================
// CONSTANTS
// =====================================================

const GOOGLE_MIME_TYPES = {
  DOCUMENT: 'application/vnd.google-apps.document',
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  FOLDER: 'application/vnd.google-apps.folder',
} as const;

const EXPORT_FORMATS = {
  [GOOGLE_MIME_TYPES.DOCUMENT]: 'text/html',
  [GOOGLE_MIME_TYPES.SPREADSHEET]: 'text/csv',
  [GOOGLE_MIME_TYPES.PRESENTATION]: 'text/plain',
} as const;

const SUPPORTED_MIME_TYPES = [
  // Google Workspace (from EXPORT_FORMATS)
  ...Object.keys(EXPORT_FORMATS),
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/html',
  'text/csv',
  // Spreadsheets
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Video
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/mpeg',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/x-m4a',
  'audio/mp4',
];

/** OAuth scopes for read-only operations */
const READ_ONLY_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

/** OAuth scope for write operations (publishing) */
const WRITE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Full scopes including write permissions */
const FULL_SCOPES = [...READ_ONLY_SCOPES, WRITE_SCOPE];

/**
 * Map PublishFormat to Google Drive MIME types for upload
 */
const FORMAT_MIME_TYPES: Record<PublishFormat, string> = {
  native: 'application/vnd.google-apps.document', // Convert to Google Docs
  markdown: 'text/markdown',
  pdf: 'application/pdf',
  html: 'text/html',
};

/**
 * Map PublishFormat to file extensions
 */
const FORMAT_EXTENSIONS: Record<PublishFormat, string> = {
  native: '', // Google Docs don't need extension
  markdown: '.md',
  pdf: '.pdf',
  html: '.html',
};

/**
 * Escape a search term for use in Google Drive query strings.
 * Google Drive queries use single quotes for string values and requires
 * escaping both backslashes and single quotes within the value.
 */
function escapeSearchTerm(term: string): string {
  // First escape backslashes, then escape single quotes
  return term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// =====================================================
// CONFIG INTERFACE
// =====================================================

interface GoogleDriveConfig {
  folderIds?: string[];
  includeSharedDrives?: boolean;
  maxFileSizeBytes?: number;
  pageSize?: number;
  /** Connector ID for token refresh management */
  connectorId?: string;
}

// =====================================================
// CONNECTOR CLASS
// =====================================================

export class GoogleDriveConnector implements Connector, PublishableConnector {
  readonly type = ConnectorType.GOOGLE_DRIVE;
  readonly name = 'Google Drive';
  readonly description = 'Sync documents from Google Drive including Docs, Sheets, Slides, and PDFs';

  private oauth2Client: OAuth2Client;
  private drive: drive_v3.Drive | null = null;
  private credentials: ConnectorCredentials;
  private config: GoogleDriveConfig;
  private turndown: TurndownService;
  private grantedScopes: string[] = [];

  constructor(credentials: ConnectorCredentials, config?: GoogleDriveConfig) {
    this.credentials = credentials;
    this.config = {
      includeSharedDrives: false,
      maxFileSizeBytes: 50 * 1024 * 1024,
      pageSize: 100,
      ...config,
    };

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    if (credentials.accessToken) {
      this.setCredentials(credentials);
    }

    // Track granted scopes if available
    if (credentials.scopes && Array.isArray(credentials.scopes)) {
      this.grantedScopes = credentials.scopes;
    }
  }

  // =====================================================
  // CREDENTIAL MANAGEMENT
  // =====================================================

  private setCredentials(credentials: ConnectorCredentials): void {
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date:
        credentials.expiresAt instanceof Date
          ? credentials.expiresAt.getTime()
          : new Date(credentials.expiresAt || 0).getTime(),
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    // Update granted scopes if available
    if (credentials.scopes && Array.isArray(credentials.scopes)) {
      this.grantedScopes = credentials.scopes;
    }
  }

  /**
   * Generate an OAuth URL with specified scopes.
   * Use this to get user authorization for read-only or full (read+write) access.
   *
   * @param scopes - Optional array of scopes. Defaults to read-only scopes.
   * @returns OAuth authorization URL
   */
  generateAuthUrl(scopes?: string[]): string {
    const requestedScopes = scopes || READ_ONLY_SCOPES;

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: requestedScopes,
      prompt: 'consent',
    });
  }

  /**
   * Generate an OAuth URL with write permissions for publishing.
   * @returns OAuth authorization URL with write scope
   */
  generatePublishAuthUrl(): string {
    return this.generateAuthUrl(FULL_SCOPES);
  }

  // =====================================================
  // TOKEN MANAGEMENT
  // =====================================================

  /**
   * Ensure we have a valid access token, refreshing if necessary.
   * Uses TokenManager for centralized token refresh handling.
   */
  private async ensureValidToken(): Promise<string> {
    if (!this.config.connectorId) {
      // No connector ID, fall back to basic refresh
      if (this.isTokenExpired()) {
        await this.refreshCredentials(this.credentials);
      }
      return this.credentials.accessToken!;
    }

    const refreshFn = createGoogleRefreshFunction(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    );

    const tokens: TokenSet = {
      accessToken: this.credentials.accessToken || '',
      refreshToken: this.credentials.refreshToken || '',
      expiresAt: this.credentials.expiresAt instanceof Date
        ? this.credentials.expiresAt
        : new Date(this.credentials.expiresAt || 0),
      scopes: this.grantedScopes,
    };

    const validToken = await TokenManager.ensureValidToken(
      this.config.connectorId,
      tokens,
      refreshFn
    );

    // Update local credentials if token was refreshed
    if (validToken !== this.credentials.accessToken) {
      this.credentials.accessToken = validToken;
      this.setCredentials(this.credentials);
    }

    return validToken;
  }

  /**
   * Check if token is expired (simple check without TokenManager)
   */
  private isTokenExpired(): boolean {
    if (!this.credentials.expiresAt) return true;
    const expiresAt = this.credentials.expiresAt instanceof Date
      ? this.credentials.expiresAt
      : new Date(this.credentials.expiresAt);
    return expiresAt.getTime() < Date.now() + 5 * 60 * 1000; // 5 minute buffer
  }

  /**
   * Execute an API call with automatic token refresh on 401 errors.
   */
  private async withTokenRefresh<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.ensureValidToken();
      return await operation();
    } catch (error: any) {
      if (error.code === 401 && this.credentials.refreshToken) {
        console.log('[GoogleDrive] Got 401, attempting token refresh...');
        await this.refreshCredentials(this.credentials);
        return await operation();
      }
      throw error;
    }
  }

  // =====================================================
  // CONNECTOR INTERFACE METHODS
  // =====================================================

  async authenticate(credentials: ConnectorCredentials): Promise<AuthResult> {
    try {
      if (credentials.code) {
        const { tokens } = await this.oauth2Client.getToken(credentials.code as string);

        // Extract scopes from the token response
        const scopes = tokens.scope?.split(' ') || [];

        this.credentials = {
          accessToken: tokens.access_token || undefined,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          scopes,
        };

        this.grantedScopes = scopes;
        this.setCredentials(this.credentials);
        const userInfo = await this.getUserInfo();

        return {
          success: true,
          userId: userInfo.emailAddress,
          userName: userInfo.displayName,
        };
      }

      const authUrl = this.generateAuthUrl();

      return {
        success: false,
        error: `Please visit this URL to authorize: ${authUrl}`,
      };
    } catch (error: any) {
      console.error('[GoogleDrive] Authentication failed:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed',
      };
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      if (!this.drive) {
        return { success: false, message: 'Not authenticated' };
      }

      const response = await this.withTokenRefresh(() =>
        this.drive!.about.get({ fields: 'user,storageQuota' })
      );

      const user = response.data.user;
      const quota = response.data.storageQuota;

      return {
        success: true,
        message: 'Connection successful',
        metadata: {
          user: { name: user?.displayName, email: user?.emailAddress },
          storage: { used: quota?.usage, total: quota?.limit },
          supportsPublish: this.supportsPublish(),
          grantedScopes: this.grantedScopes,
        },
      };
    } catch (error: any) {
      console.error('[GoogleDrive] Connection test failed:', error);
      return { success: false, message: error.message || 'Connection test failed' };
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    if (!this.drive) throw new Error('Not authenticated');

    const errors: SyncError[] = [];
    let filesProcessed = 0;
    let filesUpdated = 0;
    let filesFailed = 0;

    try {
      const query = this.buildQuery(options);
      const files = await this.withTokenRefresh(() =>
        this.listAllFiles(query, options)
      );

      console.log(`[GoogleDrive] Found ${files.length} files to sync`);

      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (file) => {
            try {
              filesProcessed++;

              if (file.mimeType === GOOGLE_MIME_TYPES.FOLDER) return;

              const size = parseInt(file.size || '0');
              if (size > (this.config.maxFileSizeBytes || 50 * 1024 * 1024)) {
                throw new Error(`File too large: ${size} bytes`);
              }

              filesUpdated++;
            } catch (error: any) {
              console.error(`[GoogleDrive] Failed to process file ${file.id}:`, error);
              filesFailed++;
              errors.push({
                fileId: file.id!,
                fileName: file.name!,
                error: error.message || 'Unknown error',
                retryable: error.code !== 404,
              });
            }
          })
        );
      }

      return {
        success: filesFailed === 0,
        filesProcessed,
        filesUpdated,
        filesFailed,
        filesDeleted: 0,
        errors,
      };
    } catch (error: any) {
      console.error('[GoogleDrive] Sync failed:', error);
      throw error;
    }
  }

  async listFiles(options?: ListOptions): Promise<ConnectorFile[]> {
    if (!this.drive) throw new Error('Not authenticated');

    try {
      const query = this.buildQuery();
      const files = await this.withTokenRefresh(() =>
        this.listAllFiles(query, undefined, options?.limit)
      );

      return files.map((file) => this.mapDriveFileToConnectorFile(file));
    } catch (error: any) {
      console.error('[GoogleDrive] List files failed:', error);
      throw error;
    }
  }

  /**
   * List all files for browser UI - includes folders, videos, zips, etc.
   * Unlike listFiles(), this doesn't filter by supported MIME types.
   * Used by the import modal to show the full folder structure.
   */
  async listFilesForBrowser(options?: {
    folderId?: string;
    search?: string;
    limit?: number;
    pageToken?: string;
  }): Promise<{ files: ConnectorFile[]; nextPageToken?: string }> {
    if (!this.drive) throw new Error('Not authenticated');

    return this.withTokenRefresh(async () => {
      const queryConditions: string[] = ['trashed = false'];

      // Filter by parent folder
      if (options?.folderId && options.folderId !== 'root') {
        queryConditions.push(`'${options.folderId}' in parents`);
      } else if (!options?.search) {
        // If no folder specified and no search, show root files
        queryConditions.push("'root' in parents");
      }

      // Search by name
      if (options?.search) {
        queryConditions.push(`name contains '${escapeSearchTerm(options.search)}'`);
      }

      const query = queryConditions.join(' and ');
      const pageSize = Math.min(options?.limit || 100, 100);

      const response = await this.drive!.files.list({
        q: query,
        pageSize,
        pageToken: options?.pageToken,
        fields:
          'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, owners, thumbnailLink)',
        includeItemsFromAllDrives: this.config.includeSharedDrives,
        supportsAllDrives: this.config.includeSharedDrives,
        orderBy: 'folder,name', // Folders first, then alphabetically
      });

      const files = (response.data.files || []).map((file) =>
        this.mapDriveFileToConnectorFile(file)
      );

      return {
        files,
        nextPageToken: response.data.nextPageToken || undefined,
      };
    });
  }

  /**
   * Check if a file type is supported for import.
   */
  isFileTypeSupported(mimeType: string): boolean {
    return (
      SUPPORTED_MIME_TYPES.includes(mimeType) ||
      mimeType.startsWith('text/') ||
      mimeType.startsWith('video/') ||
      mimeType.startsWith('audio/')
    );
  }

  async downloadFile(fileId: string): Promise<FileContent> {
    if (!this.drive) throw new Error('Not authenticated');

    return this.withTokenRefresh(async () => {
      const fileResponse = await this.drive!.files.get({
        fileId,
        fields: 'id,name,mimeType,size,modifiedTime,createdTime,webViewLink,owners',
      });

      const file = fileResponse.data;
      const mimeType = file.mimeType!;

      let content: string | Buffer;
      let exportMimeType = mimeType;

      if (mimeType in EXPORT_FORMATS) {
        exportMimeType = EXPORT_FORMATS[mimeType as keyof typeof EXPORT_FORMATS];

        const response = await this.drive!.files.export(
          { fileId, mimeType: exportMimeType },
          { responseType: 'arraybuffer' }
        );

        if (mimeType === GOOGLE_MIME_TYPES.DOCUMENT) {
          const html = Buffer.from(response.data as ArrayBuffer).toString('utf-8');
          content = this.turndown.turndown(html);
          exportMimeType = 'text/markdown';
        } else {
          content = Buffer.from(response.data as ArrayBuffer);
        }
      } else {
        const response = await this.drive!.files.get(
          { fileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );

        content = Buffer.from(response.data as ArrayBuffer);
      }

      return {
        id: file.id!,
        title: file.name!,
        content,
        mimeType: exportMimeType,
        size: typeof content === 'string' ? content.length : content.length,
        metadata: {
          webViewLink: file.webViewLink,
          modifiedTime: file.modifiedTime,
          createdTime: file.createdTime,
          owners: file.owners,
          originalMimeType: mimeType,
        },
      };
    });
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    console.log('[GoogleDrive] Webhook received:', event.type);
  }

  async refreshCredentials(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    try {
      if (!credentials.refreshToken) {
        throw new Error('No refresh token available');
      }

      this.oauth2Client.setCredentials({ refresh_token: credentials.refreshToken });

      const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();

      // Preserve existing scopes or extract from new token
      const scopes = newCredentials.scope?.split(' ') || this.grantedScopes;

      const refreshedCredentials: ConnectorCredentials = {
        accessToken: newCredentials.access_token || undefined,
        refreshToken: newCredentials.refresh_token || credentials.refreshToken,
        expiresAt: newCredentials.expiry_date ? new Date(newCredentials.expiry_date) : undefined,
        scopes,
      };

      this.credentials = refreshedCredentials;
      this.grantedScopes = scopes;
      this.setCredentials(refreshedCredentials);

      return refreshedCredentials;
    } catch (error: any) {
      console.error('[GoogleDrive] Token refresh failed:', error);
      throw error;
    }
  }

  // =====================================================
  // PUBLISHABLE CONNECTOR INTERFACE METHODS
  // =====================================================

  /**
   * Check if connector supports publishing (has write permissions).
   * Returns true if the connector was authenticated with the drive.file scope.
   */
  supportsPublish(): boolean {
    return this.grantedScopes.includes(WRITE_SCOPE);
  }

  /**
   * List folders in Google Drive.
   * Supports filtering by parent folder, searching by name, and pagination.
   */
  async listFolders(options: FolderListRequest): Promise<FolderListResponse> {
    if (!this.drive) throw new Error('Not authenticated');

    return this.withTokenRefresh(async () => {
      const queryConditions: string[] = [
        `mimeType='${GOOGLE_MIME_TYPES.FOLDER}'`,
        'trashed=false',
      ];

      // Filter by parent folder
      if (options.parentId) {
        queryConditions.push(`'${options.parentId}' in parents`);
      }

      // Search by name
      if (options.search) {
        queryConditions.push(`name contains '${escapeSearchTerm(options.search)}'`);
      }

      const query = queryConditions.join(' and ');
      const pageSize = options.pageSize || 50;

      const response = await this.drive!.files.list({
        q: query,
        pageSize,
        pageToken: options.pageToken,
        fields: 'nextPageToken, files(id, name, parents, webViewLink, modifiedTime, mimeType)',
        includeItemsFromAllDrives: this.config.includeSharedDrives,
        supportsAllDrives: this.config.includeSharedDrives,
        orderBy: 'name',
      });

      const folders: FolderInfo[] = (response.data.files || []).map((file) => ({
        id: file.id!,
        name: file.name!,
        path: file.name!, // Google Drive doesn't provide full path easily
        hasChildren: true, // We'd need another API call to know for sure
        parentId: file.parents?.[0],
        webUrl: file.webViewLink || undefined,
        modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      }));

      return {
        folders,
        nextPageToken: response.data.nextPageToken || undefined,
        hasMore: !!response.data.nextPageToken,
      };
    });
  }

  /**
   * Create a new folder in Google Drive.
   */
  async createFolder(options: CreateFolderRequest): Promise<CreateFolderResponse> {
    if (!this.drive) throw new Error('Not authenticated');
    if (!this.supportsPublish()) {
      throw new Error('Write permissions not granted. Please re-authenticate with publish permissions.');
    }

    return this.withTokenRefresh(async () => {
      const fileMetadata: drive_v3.Schema$File = {
        name: options.name,
        mimeType: GOOGLE_MIME_TYPES.FOLDER,
      };

      if (options.parentId) {
        fileMetadata.parents = [options.parentId];
      }

      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        fields: 'id, name, parents, webViewLink, modifiedTime',
      });

      const file = response.data;

      const folder: FolderInfo = {
        id: file.id!,
        name: file.name!,
        path: file.name!,
        hasChildren: false, // Newly created, no children yet
        parentId: file.parents?.[0],
        webUrl: file.webViewLink || undefined,
        modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      };

      console.log(`[GoogleDrive] Created folder: ${folder.name} (${folder.id})`);

      return { folder };
    });
  }

  /**
   * Publish a document to Google Drive.
   *
   * Supports multiple formats:
   * - native: Converts content to Google Docs format
   * - markdown: Uploads as .md file
   * - pdf: Uploads as .pdf file (content should be a Buffer or base64 string)
   * - html: Uploads as .html file
   *
   * For binary formats like PDF, content should be provided as a Buffer.
   * If content is a string for binary formats, it will be treated as base64
   * and decoded to a Buffer.
   */
  async publishDocument(options: ConnectorPublishOptions): Promise<ConnectorPublishResult> {
    if (!this.drive) throw new Error('Not authenticated');
    if (!this.supportsPublish()) {
      throw new Error('Write permissions not granted. Please re-authenticate with publish permissions.');
    }

    return this.withTokenRefresh(async () => {
      const { title, content, format, folderId, metadata } = options;

      // Determine file name and MIME type based on format
      const extension = FORMAT_EXTENSIONS[format];
      const fileName = format === 'native' ? title : `${title}${extension}`;
      const uploadMimeType = this.getUploadMimeType(format);

      // Prepare file metadata
      const fileMetadata: drive_v3.Schema$File = {
        name: fileName,
      };

      // Set parent folder if specified
      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      // Add custom metadata if provided
      if (metadata) {
        fileMetadata.properties = Object.entries(metadata).reduce(
          (acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>
        );
      }

      // Prepare content buffer - handle both string and Buffer inputs
      const contentBuffer = this.prepareContentBuffer(content, format);

      const media = {
        mimeType: uploadMimeType,
        body: Readable.from(contentBuffer),
      };

      // For native format, we need to specify conversion
      const requestBody = format === 'native'
        ? { ...fileMetadata, mimeType: FORMAT_MIME_TYPES.native }
        : fileMetadata;

      // Create the file
      const response = await this.drive!.files.create({
        requestBody,
        media,
        fields: 'id, name, webViewLink, webContentLink, parents',
      });

      const file = response.data;
      const webUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;

      console.log(`[GoogleDrive] Published document: ${file.name} (${file.id})`);

      return {
        externalId: file.id!,
        externalUrl: webUrl,
        externalPath: file.parents?.[0] ? `/${file.parents[0]}/${file.name}` : `/${file.name}`,
      };
    });
  }

  /**
   * Update an existing document in Google Drive.
   *
   * For binary formats like PDF, content should be provided as a Buffer.
   * If content is a string for binary formats, it will be treated as base64
   * and decoded to a Buffer.
   */
  async updateDocument(options: ConnectorUpdateOptions): Promise<void> {
    if (!this.drive) throw new Error('Not authenticated');
    if (!this.supportsPublish()) {
      throw new Error('Write permissions not granted. Please re-authenticate with publish permissions.');
    }

    return this.withTokenRefresh(async () => {
      const { externalId, title, content } = options;

      // Get current file info to determine format
      const currentFile = await this.drive!.files.get({
        fileId: externalId,
        fields: 'id, name, mimeType',
      });

      const fileMetadata: drive_v3.Schema$File = {};

      // Update title if provided
      if (title) {
        fileMetadata.name = title;
      }

      // Update content if provided
      if (content !== undefined) {
        const mimeType = currentFile.data.mimeType || 'text/plain';
        const uploadMimeType = mimeType === GOOGLE_MIME_TYPES.DOCUMENT
          ? 'text/html'
          : mimeType;

        // Determine format based on MIME type for proper buffer handling
        const format = this.getFormatFromMimeType(mimeType);
        const contentBuffer = this.prepareContentBuffer(content, format);

        const media = {
          mimeType: uploadMimeType,
          body: Readable.from(contentBuffer),
        };

        await this.drive!.files.update({
          fileId: externalId,
          requestBody: Object.keys(fileMetadata).length > 0 ? fileMetadata : undefined,
          media,
        });
      } else if (Object.keys(fileMetadata).length > 0) {
        // Only update metadata (no content change)
        await this.drive!.files.update({
          fileId: externalId,
          requestBody: fileMetadata,
        });
      }

      console.log(`[GoogleDrive] Updated document: ${externalId}`);
    });
  }

  /**
   * Delete a document from Google Drive.
   * Moves the file to trash rather than permanently deleting.
   */
  async deleteDocument(externalId: string): Promise<void> {
    if (!this.drive) throw new Error('Not authenticated');
    if (!this.supportsPublish()) {
      throw new Error('Write permissions not granted. Please re-authenticate with publish permissions.');
    }

    return this.withTokenRefresh(async () => {
      // Move to trash instead of permanent deletion for safety
      await this.drive!.files.update({
        fileId: externalId,
        requestBody: {
          trashed: true,
        },
      });

      console.log(`[GoogleDrive] Deleted (trashed) document: ${externalId}`);
    });
  }

  /**
   * Permanently delete a document from Google Drive.
   * Use with caution - this cannot be undone.
   */
  async permanentlyDeleteDocument(externalId: string): Promise<void> {
    if (!this.drive) throw new Error('Not authenticated');
    if (!this.supportsPublish()) {
      throw new Error('Write permissions not granted. Please re-authenticate with publish permissions.');
    }

    return this.withTokenRefresh(async () => {
      await this.drive!.files.delete({
        fileId: externalId,
      });

      console.log(`[GoogleDrive] Permanently deleted document: ${externalId}`);
    });
  }

  /**
   * Get information about an external document.
   * Useful for checking if a previously published document still exists
   * and what its current state is.
   */
  async getDocumentInfo(externalId: string): Promise<ExternalDocumentInfo> {
    if (!this.drive) throw new Error('Not authenticated');

    return this.withTokenRefresh(async () => {
      try {
        const response = await this.drive!.files.get({
          fileId: externalId,
          fields: 'id, name, modifiedTime, webViewLink, version, trashed',
        });

        const file = response.data;

        // File exists but is in trash
        if (file.trashed) {
          return {
            exists: false,
            title: file.name || undefined,
            modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
          };
        }

        return {
          exists: true,
          title: file.name || undefined,
          modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
          webUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          version: file.version || undefined,
        };
      } catch (error: any) {
        if (error.code === 404) {
          return { exists: false };
        }
        throw error;
      }
    });
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Determine the upload MIME type based on format.
   *
   * @param format - The publish format
   * @returns The appropriate MIME type for uploading to Google Drive
   */
  private getUploadMimeType(format: PublishFormat): string {
    switch (format) {
      case 'native':
        // For conversion to Google Docs, upload as HTML by default
        // The actual content type detection is done in prepareContentBuffer
        return 'text/html';

      case 'markdown':
        return 'text/markdown';

      case 'pdf':
        return 'application/pdf';

      case 'html':
        return 'text/html';

      default:
        return 'text/plain';
    }
  }

  /**
   * Prepare content buffer for upload, handling both string and Buffer inputs.
   *
   * For text formats (markdown, html, native), content is expected to be a UTF-8 string
   * or a Buffer of UTF-8 encoded text.
   *
   * For binary formats (pdf), content can be:
   * - A Buffer: used directly
   * - A string: treated as base64 and decoded to a Buffer
   *
   * @param content - The content to prepare (Buffer or string)
   * @param format - The publish format
   * @returns A Buffer ready for upload
   */
  private prepareContentBuffer(content: Buffer | string, format: PublishFormat): Buffer {
    // If content is already a Buffer, use it directly
    if (Buffer.isBuffer(content)) {
      return content;
    }

    // For binary formats like PDF, try to decode as base64
    if (format === 'pdf') {
      // Check if it looks like base64 (only contains valid base64 characters)
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      const trimmedContent = content.replace(/\s/g, ''); // Remove whitespace

      if (base64Regex.test(trimmedContent) && trimmedContent.length > 0) {
        try {
          const decoded = Buffer.from(trimmedContent, 'base64');
          // Verify it looks like a PDF by checking the magic bytes
          if (decoded.length >= 4 && decoded.toString('ascii', 0, 4) === '%PDF') {
            return decoded;
          }
          // If it doesn't look like a PDF but was valid base64, still use the decoded version
          // This handles cases where the PDF might be corrupted or a different binary format
          if (decoded.length > 0) {
            console.warn('[GoogleDrive] Content decoded as base64 but does not have PDF magic bytes');
            return decoded;
          }
        } catch {
          // If base64 decoding fails, fall through to UTF-8 encoding
          console.warn('[GoogleDrive] Failed to decode content as base64, treating as UTF-8');
        }
      }
    }

    // For text formats or if base64 decoding failed, encode as UTF-8
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Determine the PublishFormat from a MIME type.
   * Used when updating documents to determine how to handle content.
   *
   * @param mimeType - The MIME type of the file
   * @returns The corresponding PublishFormat
   */
  private getFormatFromMimeType(mimeType: string): PublishFormat {
    switch (mimeType) {
      case 'application/pdf':
        return 'pdf';
      case 'text/html':
        return 'html';
      case 'text/markdown':
        return 'markdown';
      case GOOGLE_MIME_TYPES.DOCUMENT:
        return 'native';
      default:
        // Default to markdown for unknown text types
        return 'markdown';
    }
  }

  private buildQuery(options?: SyncOptions): string {
    const conditions: string[] = [];

    conditions.push('trashed = false');

    const mimeConditions = SUPPORTED_MIME_TYPES.map((type) => `mimeType='${type}'`).join(' or ');
    conditions.push(`(${mimeConditions})`);

    if (options?.since) {
      const isoDate = options.since.toISOString();
      conditions.push(`modifiedTime > '${isoDate}'`);
    }

    if (this.config.folderIds && this.config.folderIds.length > 0) {
      const folderConditions = this.config.folderIds
        .map((folderId) => `'${folderId}' in parents`)
        .join(' or ');
      conditions.push(`(${folderConditions})`);
    }

    return conditions.join(' and ');
  }

  private async listAllFiles(
    query: string,
    syncOptions?: SyncOptions,
    limit?: number
  ): Promise<drive_v3.Schema$File[]> {
    if (!this.drive) throw new Error('Not authenticated');

    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    const maxResults = limit || syncOptions?.limit;

    do {
      const response = await this.drive.files.list({
        q: query,
        pageSize: Math.min(this.config.pageSize || 100, maxResults ? maxResults - files.length : 100),
        pageToken,
        fields:
          'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, owners)',
        includeItemsFromAllDrives: this.config.includeSharedDrives,
        supportsAllDrives: this.config.includeSharedDrives,
      });

      if (response.data.files) {
        files.push(...response.data.files);
      }

      pageToken = response.data.nextPageToken || undefined;

      if (maxResults && files.length >= maxResults) break;
    } while (pageToken);

    return files;
  }

  private async getUserInfo(): Promise<{ emailAddress?: string; displayName?: string }> {
    if (!this.drive) throw new Error('Not authenticated');

    const response = await this.drive.about.get({ fields: 'user' });

    return {
      emailAddress: response.data.user?.emailAddress || undefined,
      displayName: response.data.user?.displayName || undefined,
    };
  }

  private mapDriveFileToConnectorFile(file: drive_v3.Schema$File): ConnectorFile {
    return {
      id: file.id!,
      name: file.name!,
      type: this.getFileType(file.mimeType!),
      mimeType: file.mimeType!,
      size: file.size ? parseInt(file.size) : undefined,
      modifiedAt: new Date(file.modifiedTime!),
      createdAt: file.createdTime ? new Date(file.createdTime) : undefined,
      url: file.webViewLink || undefined,
      parentId: file.parents?.[0] || undefined,
      metadata: {
        owners: file.owners,
        isGoogleWorkspace: file.mimeType?.startsWith('application/vnd.google-apps.'),
      },
    };
  }

  private getFileType(mimeType: string): string {
    // Google Workspace types
    if (mimeType === GOOGLE_MIME_TYPES.FOLDER) return 'folder';
    if (mimeType === GOOGLE_MIME_TYPES.DOCUMENT) return 'google_doc';
    if (mimeType === GOOGLE_MIME_TYPES.SPREADSHEET) return 'google_sheet';
    if (mimeType === GOOGLE_MIME_TYPES.PRESENTATION) return 'google_slide';

    // Documents
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return 'word';
    if (mimeType.includes('spreadsheetml') || mimeType === 'application/vnd.ms-excel') return 'excel';
    if (mimeType === 'text/csv') return 'csv';
    if (mimeType === 'text/markdown') return 'markdown';
    if (mimeType === 'text/html') return 'html';
    if (mimeType === 'text/plain') return 'text';

    // Media
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';

    // Archives
    if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return 'archive';
    if (mimeType === 'application/x-rar-compressed' || mimeType === 'application/vnd.rar') return 'archive';
    if (mimeType === 'application/x-7z-compressed') return 'archive';
    if (mimeType === 'application/gzip' || mimeType === 'application/x-tar') return 'archive';

    // Code files
    if (mimeType === 'application/json') return 'code';
    if (mimeType === 'application/javascript' || mimeType === 'text/javascript') return 'code';
    if (mimeType === 'application/xml' || mimeType === 'text/xml') return 'code';

    // Other text types
    if (mimeType.startsWith('text/')) return 'text';

    return 'file';
  }
}
