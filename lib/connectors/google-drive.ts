/**
 * Google Drive Connector
 *
 * Implements OAuth authentication, file/folder listing, downloading,
 * token refresh, webhook support, and Google Workspace file conversion.
 */

import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import TurndownService from 'turndown';

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
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'text/html',
  'image/jpeg',
  'image/png',
  ...Object.keys(EXPORT_FORMATS),
];

interface GoogleDriveConfig {
  folderIds?: string[];
  includeSharedDrives?: boolean;
  maxFileSizeBytes?: number;
  pageSize?: number;
}

export class GoogleDriveConnector implements Connector {
  readonly type = ConnectorType.GOOGLE_DRIVE;
  readonly name = 'Google Drive';
  readonly description = 'Sync documents from Google Drive including Docs, Sheets, Slides, and PDFs';

  private oauth2Client: OAuth2Client;
  private drive: drive_v3.Drive | null = null;
  private credentials: ConnectorCredentials;
  private config: GoogleDriveConfig;
  private turndown: TurndownService;

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
  }

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
  }

  async authenticate(credentials: ConnectorCredentials): Promise<AuthResult> {
    try {
      if (credentials.code) {
        const { tokens } = await this.oauth2Client.getToken(credentials.code as string);

        this.credentials = {
          accessToken: tokens.access_token || undefined,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        };

        this.setCredentials(this.credentials);
        const userInfo = await this.getUserInfo();

        return {
          success: true,
          userId: userInfo.emailAddress,
          userName: userInfo.displayName,
        };
      }

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        prompt: 'consent',
      });

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

      const response = await this.drive.about.get({ fields: 'user,storageQuota' });
      const user = response.data.user;
      const quota = response.data.storageQuota;

      return {
        success: true,
        message: 'Connection successful',
        metadata: {
          user: { name: user?.displayName, email: user?.emailAddress },
          storage: { used: quota?.usage, total: quota?.limit },
        },
      };
    } catch (error: any) {
      console.error('[GoogleDrive] Connection test failed:', error);

      if (error.code === 401 && this.credentials.refreshToken) {
        try {
          await this.refreshCredentials(this.credentials);
          return this.testConnection();
        } catch {
          return { success: false, message: 'Token expired and refresh failed' };
        }
      }

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
      const files = await this.listAllFiles(query, options);

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
      const files = await this.listAllFiles(query, undefined, options?.limit);

      return files.map((file) => this.mapDriveFileToConnectorFile(file));
    } catch (error: any) {
      console.error('[GoogleDrive] List files failed:', error);
      throw error;
    }
  }

  async downloadFile(fileId: string): Promise<FileContent> {
    if (!this.drive) throw new Error('Not authenticated');

    try {
      const fileResponse = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,modifiedTime,createdTime,webViewLink,owners',
      });

      const file = fileResponse.data;
      const mimeType = file.mimeType!;

      let content: string | Buffer;
      let exportMimeType = mimeType;

      if (mimeType in EXPORT_FORMATS) {
        exportMimeType = EXPORT_FORMATS[mimeType as keyof typeof EXPORT_FORMATS];

        const response = await this.drive.files.export(
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
        const response = await this.drive.files.get(
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
    } catch (error: any) {
      console.error(`[GoogleDrive] Download file ${fileId} failed:`, error);
      throw error;
    }
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

      const refreshedCredentials: ConnectorCredentials = {
        accessToken: newCredentials.access_token || undefined,
        refreshToken: newCredentials.refresh_token || credentials.refreshToken,
        expiresAt: newCredentials.expiry_date ? new Date(newCredentials.expiry_date) : undefined,
      };

      this.credentials = refreshedCredentials;
      this.setCredentials(refreshedCredentials);

      return refreshedCredentials;
    } catch (error: any) {
      console.error('[GoogleDrive] Token refresh failed:', error);
      throw error;
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
    if (mimeType === GOOGLE_MIME_TYPES.FOLDER) return 'folder';
    if (mimeType === GOOGLE_MIME_TYPES.DOCUMENT) return 'google_doc';
    if (mimeType === GOOGLE_MIME_TYPES.SPREADSHEET) return 'google_sheet';
    if (mimeType === GOOGLE_MIME_TYPES.PRESENTATION) return 'google_slide';
    if (mimeType.startsWith('application/pdf')) return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('text/')) return 'text';
    return 'file';
  }
}
