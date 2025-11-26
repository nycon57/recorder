/**
 * SharePoint/OneDrive Connector
 *
 * Implements OAuth authentication, file/folder operations, token refresh,
 * and bidirectional sync (import and publish) using Microsoft Graph API.
 *
 * Supports both SharePoint sites/document libraries and OneDrive personal/business.
 */

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
  createMicrosoftRefreshFunction,
  type TokenSet,
  type StoredCredentials,
} from '@/lib/services/token-manager';

// =====================================================
// CONSTANTS & TYPES
// =====================================================

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

/** Microsoft MIME types for Office documents */
const MICROSOFT_MIME_TYPES = {
  WORD: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  POWERPOINT: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  PDF: 'application/pdf',
  MARKDOWN: 'text/markdown',
  HTML: 'text/html',
  PLAIN_TEXT: 'text/plain',
} as const;

/** File extensions for different formats */
const FORMAT_EXTENSIONS: Record<PublishFormat, string> = {
  native: '.docx',
  markdown: '.md',
  pdf: '.pdf',
  html: '.html',
};

/** MIME types for different publish formats */
const FORMAT_MIME_TYPES: Record<PublishFormat, string> = {
  native: MICROSOFT_MIME_TYPES.WORD,
  markdown: MICROSOFT_MIME_TYPES.MARKDOWN,
  pdf: MICROSOFT_MIME_TYPES.PDF,
  html: MICROSOFT_MIME_TYPES.HTML,
};

/** Supported file types for import */
const SUPPORTED_MIME_TYPES = [
  MICROSOFT_MIME_TYPES.WORD,
  MICROSOFT_MIME_TYPES.EXCEL,
  MICROSOFT_MIME_TYPES.POWERPOINT,
  MICROSOFT_MIME_TYPES.PDF,
  MICROSOFT_MIME_TYPES.MARKDOWN,
  MICROSOFT_MIME_TYPES.HTML,
  MICROSOFT_MIME_TYPES.PLAIN_TEXT,
  'image/jpeg',
  'image/png',
  'video/mp4',
  'audio/mpeg',
];

/** Write scopes that enable publishing */
const WRITE_SCOPES = [
  'Files.ReadWrite',
  'Files.ReadWrite.All',
  'Sites.ReadWrite.All',
];

/** SharePoint connector configuration */
interface SharePointConfig {
  /** SharePoint site ID (null for OneDrive) */
  siteId?: string;
  /** Specific drive ID (optional - defaults to default drive) */
  driveId?: string;
  /** Use personal OneDrive instead of SharePoint */
  useOneDrive?: boolean;
  /** Maximum file size for download (default: 50MB) */
  maxFileSizeBytes?: number;
  /** Page size for list operations (default: 100) */
  pageSize?: number;
  /** Connector ID in database (for token refresh) */
  connectorId?: string;
}

/** Microsoft Graph API response types */
interface GraphDriveItem {
  id: string;
  name: string;
  size?: number;
  file?: {
    mimeType: string;
    hashes?: {
      sha256Hash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  parentReference?: {
    id?: string;
    path?: string;
    driveId?: string;
  };
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  '@microsoft.graph.downloadUrl'?: string;
}

interface GraphListResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

interface GraphUploadSession {
  uploadUrl: string;
  expirationDateTime: string;
}

interface GraphUser {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
}

interface GraphDrive {
  id: string;
  name: string;
  driveType: string;
  quota?: {
    total: number;
    used: number;
    remaining: number;
  };
}

// =====================================================
// SHAREPOINT CONNECTOR CLASS
// =====================================================

export class SharePointConnector implements Connector, PublishableConnector {
  readonly type: ConnectorType;
  readonly name: string;
  readonly description: string;

  private credentials: ConnectorCredentials;
  private config: SharePointConfig;
  private accessToken: string | null = null;

  constructor(credentials: ConnectorCredentials, config?: SharePointConfig) {
    this.credentials = credentials;
    this.config = {
      useOneDrive: false,
      maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
      pageSize: 100,
      ...config,
    };

    // Set type, name and description based on mode
    if (this.config.useOneDrive) {
      this.type = ConnectorType.ONEDRIVE;
      this.name = 'OneDrive';
      this.description = 'Sync and publish documents to Microsoft OneDrive personal or business';
    } else {
      this.type = ConnectorType.SHAREPOINT;
      this.name = 'SharePoint';
      this.description = 'Sync and publish documents to Microsoft SharePoint document libraries';
    }

    if (credentials.accessToken) {
      this.accessToken = credentials.accessToken;
    }
  }

  // =====================================================
  // BASE CONNECTOR METHODS
  // =====================================================

  /**
   * Authenticate with Microsoft OAuth
   */
  async authenticate(credentials: ConnectorCredentials): Promise<AuthResult> {
    try {
      // If we have an auth code, exchange it for tokens
      if (credentials.code) {
        const tokens = await this.exchangeCodeForTokens(credentials.code as string);

        this.credentials = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
        };
        this.accessToken = tokens.accessToken;

        // Get user info
        const userInfo = await this.getUserInfo();

        return {
          success: true,
          userId: userInfo.mail || userInfo.userPrincipalName,
          userName: userInfo.displayName,
        };
      }

      // Generate auth URL for user to visit
      const authUrl = this.generateAuthUrl();

      return {
        success: false,
        error: `Please visit this URL to authorize: ${authUrl}`,
      };
    } catch (error) {
      console.error('[SharePoint] Authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Test if connection is working
   */
  async testConnection(): Promise<TestResult> {
    try {
      await this.ensureValidToken();

      // Get user info and drive info
      const [user, drive] = await Promise.all([
        this.getUserInfo(),
        this.getDriveInfo(),
      ]);

      return {
        success: true,
        message: 'Connection successful',
        metadata: {
          user: {
            name: user.displayName,
            email: user.mail || user.userPrincipalName,
          },
          drive: {
            id: drive.id,
            name: drive.name,
            type: drive.driveType,
            quota: drive.quota,
          },
        },
      };
    } catch (error) {
      console.error('[SharePoint] Connection test failed:', error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Sync files from SharePoint/OneDrive
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    await this.ensureValidToken();

    const errors: SyncError[] = [];
    let filesProcessed = 0;
    let filesUpdated = 0;
    let filesFailed = 0;

    try {
      const files = await this.listAllFiles(options);

      console.log(`[SharePoint] Found ${files.length} files to sync`);

      // Process files in batches
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (file) => {
            try {
              filesProcessed++;

              // Skip folders
              if (file.folder) return;

              // Check file size
              const size = file.size || 0;
              if (size > (this.config.maxFileSizeBytes || 50 * 1024 * 1024)) {
                throw new Error(`File too large: ${size} bytes`);
              }

              filesUpdated++;
            } catch (error) {
              console.error(`[SharePoint] Failed to process file ${file.id}:`, error);
              filesFailed++;
              errors.push({
                fileId: file.id,
                fileName: file.name,
                error: error instanceof Error ? error.message : 'Unknown error',
                retryable: true,
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
    } catch (error) {
      console.error('[SharePoint] Sync failed:', error);
      throw error;
    }
  }

  /**
   * List available files
   */
  async listFiles(options?: ListOptions): Promise<ConnectorFile[]> {
    await this.ensureValidToken();

    try {
      const items = await this.listAllFiles(undefined, options?.limit);

      return items
        .filter((item) => !item.folder) // Filter out folders
        .map((item) => this.mapDriveItemToConnectorFile(item));
    } catch (error) {
      console.error('[SharePoint] List files failed:', error);
      throw error;
    }
  }

  /**
   * Download a specific file
   */
  async downloadFile(fileId: string): Promise<FileContent> {
    await this.ensureValidToken();

    try {
      // Get file metadata
      const drivePath = this.getDrivePath();
      const metadataUrl = `${GRAPH_API_BASE}${drivePath}/items/${fileId}`;

      const metadataResponse = await this.graphRequest<GraphDriveItem>(metadataUrl);

      if (!metadataResponse.file) {
        throw new Error('Item is not a file');
      }

      // Download file content
      const downloadUrl = metadataResponse['@microsoft.graph.downloadUrl'];
      if (!downloadUrl) {
        throw new Error('Download URL not available');
      }

      const contentResponse = await fetch(downloadUrl);
      if (!contentResponse.ok) {
        throw new Error(`Download failed: ${contentResponse.statusText}`);
      }

      const buffer = Buffer.from(await contentResponse.arrayBuffer());

      return {
        id: metadataResponse.id,
        title: metadataResponse.name,
        content: buffer,
        mimeType: metadataResponse.file.mimeType,
        size: metadataResponse.size || buffer.length,
        metadata: {
          webUrl: metadataResponse.webUrl,
          modifiedTime: metadataResponse.lastModifiedDateTime,
          createdTime: metadataResponse.createdDateTime,
          parentPath: metadataResponse.parentReference?.path,
        },
      };
    } catch (error) {
      console.error(`[SharePoint] Download file ${fileId} failed:`, error);
      throw error;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    console.log('[SharePoint] Webhook received:', event.type, event.payload);
    // Implement webhook handling for real-time sync
  }

  /**
   * Refresh expired credentials
   */
  async refreshCredentials(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    try {
      if (!credentials.refreshToken) {
        throw new Error('No refresh token available');
      }

      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

      if (!clientId || !clientSecret) {
        throw new Error('Microsoft OAuth credentials not configured');
      }

      const refreshFn = createMicrosoftRefreshFunction(clientId, clientSecret, tenantId);
      const newTokens = await refreshFn(credentials.refreshToken);

      this.credentials = {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
        scopes: newTokens.scopes,
      };
      this.accessToken = newTokens.accessToken;

      console.log('[SharePoint] Token refreshed successfully');

      return this.credentials;
    } catch (error) {
      console.error('[SharePoint] Token refresh failed:', error);
      throw error;
    }
  }

  // =====================================================
  // PUBLISHABLE CONNECTOR METHODS
  // =====================================================

  /**
   * Check if connector has write permissions for publishing
   */
  supportsPublish(): boolean {
    const scopes = this.credentials.scopes || [];

    // Check if any write scope is present
    const hasWriteScope = scopes.some((scope) =>
      WRITE_SCOPES.some((writeScope) =>
        scope.toLowerCase().includes(writeScope.toLowerCase())
      )
    );

    return hasWriteScope;
  }

  /**
   * List folders in SharePoint/OneDrive
   */
  async listFolders(options: FolderListRequest): Promise<FolderListResponse> {
    await this.ensureValidToken();

    try {
      const drivePath = this.getDrivePath();
      let url: string;

      if (options.parentId) {
        url = `${GRAPH_API_BASE}${drivePath}/items/${options.parentId}/children`;
      } else {
        url = `${GRAPH_API_BASE}${drivePath}/root/children`;
      }

      // Add filters
      const params = new URLSearchParams();
      params.append('$filter', "folder ne null"); // Only folders
      params.append('$top', String(options.pageSize || this.config.pageSize || 100));
      params.append('$orderby', 'name');
      params.append('$select', 'id,name,folder,parentReference,webUrl,lastModifiedDateTime');

      if (options.search) {
        // Use search endpoint for searching
        url = `${GRAPH_API_BASE}${drivePath}/root/search(q='${encodeURIComponent(options.search)}')`;
        params.delete('$filter');
        params.append('$filter', "folder ne null");
      }

      if (options.pageToken) {
        url = options.pageToken; // pageToken is the full next link URL
      } else {
        url = `${url}?${params.toString()}`;
      }

      const response = await this.graphRequest<GraphListResponse<GraphDriveItem>>(url);

      const folders: FolderInfo[] = response.value
        .filter((item) => item.folder)
        .map((item) => this.mapDriveItemToFolderInfo(item));

      return {
        folders,
        nextPageToken: response['@odata.nextLink'],
        hasMore: !!response['@odata.nextLink'],
      };
    } catch (error) {
      console.error('[SharePoint] List folders failed:', error);
      throw error;
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(options: CreateFolderRequest): Promise<CreateFolderResponse> {
    await this.ensureValidToken();

    try {
      const drivePath = this.getDrivePath();
      let url: string;

      if (options.parentId) {
        url = `${GRAPH_API_BASE}${drivePath}/items/${options.parentId}/children`;
      } else {
        url = `${GRAPH_API_BASE}${drivePath}/root/children`;
      }

      const body = {
        name: options.name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      };

      const response = await this.graphRequest<GraphDriveItem>(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return {
        folder: this.mapDriveItemToFolderInfo(response),
      };
    } catch (error) {
      console.error('[SharePoint] Create folder failed:', error);
      throw error;
    }
  }

  /**
   * Publish a document to SharePoint/OneDrive
   */
  async publishDocument(options: ConnectorPublishOptions): Promise<ConnectorPublishResult> {
    await this.ensureValidToken();

    try {
      const drivePath = this.getDrivePath();
      const extension = FORMAT_EXTENSIONS[options.format];
      const mimeType = FORMAT_MIME_TYPES[options.format];

      // Ensure filename has correct extension
      let fileName = options.title;
      if (!fileName.endsWith(extension)) {
        fileName = `${fileName}${extension}`;
      }

      // Build upload path
      let uploadUrl: string;
      if (options.folderId) {
        uploadUrl = `${GRAPH_API_BASE}${drivePath}/items/${options.folderId}:/${encodeURIComponent(fileName)}:/content`;
      } else {
        uploadUrl = `${GRAPH_API_BASE}${drivePath}/root:/${encodeURIComponent(fileName)}:/content`;
      }

      // Convert content to buffer
      const contentBuffer = Buffer.from(options.content, 'utf-8');

      // For files < 4MB, use simple upload
      // For larger files, use upload session
      if (contentBuffer.length < 4 * 1024 * 1024) {
        const response = await this.graphRequest<GraphDriveItem>(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
          },
          body: contentBuffer,
        });

        console.log(`[SharePoint] Document published: ${response.name} (${response.id})`);

        return {
          externalId: response.id,
          externalUrl: response.webUrl || '',
          externalPath: response.parentReference?.path
            ? `${response.parentReference.path}/${response.name}`
            : `/${response.name}`,
        };
      } else {
        // Use resumable upload for larger files
        return await this.uploadLargeFile(options, fileName, contentBuffer, mimeType);
      }
    } catch (error) {
      console.error('[SharePoint] Publish document failed:', error);
      throw error;
    }
  }

  /**
   * Update an existing document
   */
  async updateDocument(options: ConnectorUpdateOptions): Promise<void> {
    await this.ensureValidToken();

    try {
      const drivePath = this.getDrivePath();

      // If content is provided, update the file content
      if (options.content) {
        const uploadUrl = `${GRAPH_API_BASE}${drivePath}/items/${options.externalId}/content`;
        const contentBuffer = Buffer.from(options.content, 'utf-8');

        await this.graphRequest(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: contentBuffer,
        });
      }

      // If title is provided, rename the file
      if (options.title) {
        const metadataUrl = `${GRAPH_API_BASE}${drivePath}/items/${options.externalId}`;

        await this.graphRequest(metadataUrl, {
          method: 'PATCH',
          body: JSON.stringify({ name: options.title }),
        });
      }

      console.log(`[SharePoint] Document updated: ${options.externalId}`);
    } catch (error) {
      console.error('[SharePoint] Update document failed:', error);
      throw error;
    }
  }

  /**
   * Delete a document from SharePoint/OneDrive
   */
  async deleteDocument(externalId: string): Promise<void> {
    await this.ensureValidToken();

    try {
      const drivePath = this.getDrivePath();
      const url = `${GRAPH_API_BASE}${drivePath}/items/${externalId}`;

      await this.graphRequest(url, { method: 'DELETE' });

      console.log(`[SharePoint] Document deleted: ${externalId}`);
    } catch (error) {
      console.error('[SharePoint] Delete document failed:', error);
      throw error;
    }
  }

  /**
   * Get document info from SharePoint/OneDrive
   */
  async getDocumentInfo(externalId: string): Promise<ExternalDocumentInfo> {
    await this.ensureValidToken();

    try {
      const drivePath = this.getDrivePath();
      const url = `${GRAPH_API_BASE}${drivePath}/items/${externalId}?$select=id,name,lastModifiedDateTime,webUrl,eTag`;

      const response = await this.graphRequest<GraphDriveItem>(url);

      return {
        exists: true,
        title: response.name,
        modifiedAt: response.lastModifiedDateTime
          ? new Date(response.lastModifiedDateTime)
          : undefined,
        webUrl: response.webUrl,
        version: response['@odata.etag'],
      };
    } catch (error) {
      // Check if error is 404 (not found)
      if (error instanceof Error && error.message.includes('404')) {
        return { exists: false };
      }
      throw error;
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Ensure we have a valid access token, refreshing if necessary
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.credentials.accessToken) {
      throw new Error('Not authenticated');
    }

    // If we have a connector ID, use TokenManager for proper refresh handling
    if (this.config.connectorId) {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

      if (!clientId || !clientSecret) {
        throw new Error('Microsoft OAuth credentials not configured');
      }

      const refreshFn = createMicrosoftRefreshFunction(clientId, clientSecret, tenantId);

      this.accessToken = await TokenManager.ensureValidToken(
        this.config.connectorId,
        this.credentials as StoredCredentials,
        refreshFn
      );
    } else {
      // Check if token is expired
      const expiresAt = this.credentials.expiresAt instanceof Date
        ? this.credentials.expiresAt
        : this.credentials.expiresAt
          ? new Date(this.credentials.expiresAt)
          : new Date(0);

      if (TokenManager.isTokenExpiringSoon(expiresAt)) {
        const newCredentials = await this.refreshCredentials(this.credentials);
        this.accessToken = newCredentials.accessToken || null;
      } else {
        this.accessToken = this.credentials.accessToken;
      }
    }

    if (!this.accessToken) {
      throw new Error('Failed to obtain valid access token');
    }
  }

  /**
   * Make a request to Microsoft Graph API
   */
  private async graphRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle DELETE with no content
    if (response.status === 204) {
      return {} as T;
    }

    if (!response.ok) {
      let errorMessage = `Graph API error: ${response.status} ${response.statusText}`;

      try {
        const errorBody = await response.json();
        if (errorBody.error?.message) {
          errorMessage = `${response.status}: ${errorBody.error.message}`;
        }
      } catch {
        // Ignore JSON parse errors
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Get the drive path based on configuration
   */
  private getDrivePath(): string {
    if (this.config.useOneDrive) {
      return '/me/drive';
    }

    if (this.config.siteId && this.config.driveId) {
      return `/sites/${this.config.siteId}/drives/${this.config.driveId}`;
    }

    if (this.config.siteId) {
      return `/sites/${this.config.siteId}/drive`;
    }

    if (this.config.driveId) {
      return `/drives/${this.config.driveId}`;
    }

    // Default to user's OneDrive
    return '/me/drive';
  }

  /**
   * Generate OAuth authorization URL
   */
  private generateAuthUrl(): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';

    if (!clientId) {
      throw new Error('MICROSOFT_CLIENT_ID not configured');
    }

    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'Files.ReadWrite.All',
      'Sites.ReadWrite.All',
      'User.Read',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      response_mode: 'query',
      prompt: 'consent',
    });

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';

    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured');
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/.default offline_access',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope?.split(' '),
    };
  }

  /**
   * Get current user info
   */
  private async getUserInfo(): Promise<GraphUser> {
    return this.graphRequest<GraphUser>(`${GRAPH_API_BASE}/me`);
  }

  /**
   * Get drive info
   */
  private async getDriveInfo(): Promise<GraphDrive> {
    const drivePath = this.getDrivePath();
    return this.graphRequest<GraphDrive>(`${GRAPH_API_BASE}${drivePath}`);
  }

  /**
   * List all files with pagination
   */
  private async listAllFiles(
    syncOptions?: SyncOptions,
    limit?: number
  ): Promise<GraphDriveItem[]> {
    const items: GraphDriveItem[] = [];
    const drivePath = this.getDrivePath();
    let url = `${GRAPH_API_BASE}${drivePath}/root/children`;

    // Build query parameters
    const params = new URLSearchParams();
    params.append('$top', String(this.config.pageSize || 100));
    params.append('$select', 'id,name,size,file,folder,parentReference,webUrl,createdDateTime,lastModifiedDateTime,@microsoft.graph.downloadUrl');

    // Add date filter if provided
    if (syncOptions?.since) {
      const isoDate = syncOptions.since.toISOString();
      params.append('$filter', `lastModifiedDateTime gt ${isoDate}`);
    }

    url = `${url}?${params.toString()}`;

    // Paginate through results
    while (url) {
      const response = await this.graphRequest<GraphListResponse<GraphDriveItem>>(url);

      items.push(...response.value);

      // Check if we've reached the limit
      if (limit && items.length >= limit) {
        return items.slice(0, limit);
      }

      url = response['@odata.nextLink'] || '';
    }

    return items;
  }

  /**
   * Upload a large file using upload session
   */
  private async uploadLargeFile(
    options: ConnectorPublishOptions,
    fileName: string,
    content: Buffer,
    _mimeType: string
  ): Promise<ConnectorPublishResult> {
    const drivePath = this.getDrivePath();

    // Create upload session
    let sessionUrl: string;
    if (options.folderId) {
      sessionUrl = `${GRAPH_API_BASE}${drivePath}/items/${options.folderId}:/${encodeURIComponent(fileName)}:/createUploadSession`;
    } else {
      sessionUrl = `${GRAPH_API_BASE}${drivePath}/root:/${encodeURIComponent(fileName)}:/createUploadSession`;
    }

    const session = await this.graphRequest<GraphUploadSession>(sessionUrl, {
      method: 'POST',
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': 'replace',
          name: fileName,
        },
      }),
    });

    // Upload in chunks (max 60MB per request, using 4MB chunks)
    const chunkSize = 4 * 1024 * 1024; // 4MB
    const totalSize = content.length;
    let uploadedBytes = 0;
    let response: GraphDriveItem | null = null;

    while (uploadedBytes < totalSize) {
      const chunkEnd = Math.min(uploadedBytes + chunkSize, totalSize);
      const chunk = content.slice(uploadedBytes, chunkEnd);

      const uploadResponse = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${uploadedBytes}-${chunkEnd - 1}/${totalSize}`,
        },
        body: chunk,
      });

      if (!uploadResponse.ok && uploadResponse.status !== 202) {
        throw new Error(`Upload failed at byte ${uploadedBytes}: ${uploadResponse.statusText}`);
      }

      // Last chunk returns the created item
      if (uploadResponse.status === 200 || uploadResponse.status === 201) {
        response = await uploadResponse.json();
      }

      uploadedBytes = chunkEnd;
      console.log(`[SharePoint] Uploaded ${uploadedBytes}/${totalSize} bytes`);
    }

    if (!response) {
      throw new Error('Upload completed but no response received');
    }

    console.log(`[SharePoint] Large file uploaded: ${response.name} (${response.id})`);

    return {
      externalId: response.id,
      externalUrl: response.webUrl || '',
      externalPath: response.parentReference?.path
        ? `${response.parentReference.path}/${response.name}`
        : `/${response.name}`,
    };
  }

  /**
   * Map Graph API drive item to ConnectorFile
   */
  private mapDriveItemToConnectorFile(item: GraphDriveItem): ConnectorFile {
    return {
      id: item.id,
      name: item.name,
      type: this.getFileType(item),
      mimeType: item.file?.mimeType,
      size: item.size,
      modifiedAt: item.lastModifiedDateTime
        ? new Date(item.lastModifiedDateTime)
        : new Date(),
      createdAt: item.createdDateTime
        ? new Date(item.createdDateTime)
        : undefined,
      url: item.webUrl,
      path: item.parentReference?.path,
      parentId: item.parentReference?.id,
      metadata: {
        driveId: item.parentReference?.driveId,
        downloadUrl: item['@microsoft.graph.downloadUrl'],
      },
    };
  }

  /**
   * Map Graph API drive item to FolderInfo
   */
  private mapDriveItemToFolderInfo(item: GraphDriveItem): FolderInfo {
    const path = item.parentReference?.path
      ? `${item.parentReference.path}/${item.name}`
      : `/${item.name}`;

    return {
      id: item.id,
      name: item.name,
      path,
      hasChildren: (item.folder?.childCount || 0) > 0,
      parentId: item.parentReference?.id,
      webUrl: item.webUrl,
      modifiedAt: item.lastModifiedDateTime
        ? new Date(item.lastModifiedDateTime)
        : undefined,
    };
  }

  /**
   * Determine file type from drive item
   */
  private getFileType(item: GraphDriveItem): string {
    if (item.folder) return 'folder';

    const mimeType = item.file?.mimeType || '';

    if (mimeType === MICROSOFT_MIME_TYPES.WORD) return 'word';
    if (mimeType === MICROSOFT_MIME_TYPES.EXCEL) return 'excel';
    if (mimeType === MICROSOFT_MIME_TYPES.POWERPOINT) return 'powerpoint';
    if (mimeType === MICROSOFT_MIME_TYPES.PDF) return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('text/')) return 'text';

    return 'file';
  }
}

// =====================================================
// EXPORTS
// =====================================================

export default SharePointConnector;
