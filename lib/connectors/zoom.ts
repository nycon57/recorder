/**
 * Zoom Connector
 *
 * Integrates with Zoom via OAuth and webhooks to automatically import
 * meeting recordings, transcripts, and associated metadata.
 *
 * Features:
 * - OAuth 2.0 authentication with token refresh
 * - List and download meeting recordings
 * - Download transcripts (VTT format)
 * - Webhook support for real-time recording sync
 * - Automatic token refresh on expiry
 * - Stores imported content in database for processing
 */

import { createHash } from 'crypto';

import axios, { AxiosError } from 'axios';

import { createClient } from '@/lib/supabase/admin';

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


interface ZoomCredentials extends ConnectorCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | string;
}

interface ZoomConfig {
  orgId: string;
  connectorId?: string;
}

interface ZoomMeeting {
  uuid: string;
  id: number;
  topic: string;
  start_time: string;
  duration: number;
  recording_count: number;
  recording_files: ZoomRecordingFile[];
  recording_transcript_file?: {
    download_url: string;
    file_type: string;
    file_size: number;
  };
}

interface ZoomRecordingFile {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_size: number;
  file_extension: string;
  download_url: string;
  status: string;
  recording_type: string;
}

export class ZoomConnector implements Connector {
  readonly type = ConnectorType.ZOOM;
  readonly name = 'Zoom Meetings';
  readonly description = 'Sync Zoom meeting recordings and transcripts';

  private accessToken: string;
  private refreshToken: string;
  private expiresAt: Date;
  private orgId: string;
  private connectorId?: string;

  constructor(credentials: ZoomCredentials, config?: ZoomConfig) {
    this.accessToken = credentials.accessToken || '';
    this.refreshToken = credentials.refreshToken || '';
    this.expiresAt = new Date(credentials.expiresAt || Date.now() + 3600000);
    this.orgId = config?.orgId || '';
    this.connectorId = config?.connectorId;
  }

  /**
   * Authenticate with Zoom API
   */
  async authenticate(credentials?: ConnectorCredentials): Promise<AuthResult> {
    if (credentials) {
      this.accessToken = credentials.accessToken || '';
      this.refreshToken = credentials.refreshToken || '';
      this.expiresAt = new Date(credentials.expiresAt || Date.now() + 3600000);
    }

    try {
      // Check if token is expired
      if (this.isTokenExpired()) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          return {
            success: false,
            error: 'Failed to refresh expired token',
          };
        }
      }

      // Test API call to validate credentials
      const response = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return {
        success: true,
        userId: response.data.id,
        userName: `${response.data.first_name} ${response.data.last_name}`,
      };
    } catch (error: any) {
      // Try to refresh token if expired
      if (error.response?.status === 401) {
        const refreshed = await this.refreshAccessToken();

        if (refreshed) {
          return this.authenticate(); // Retry
        }
      }

      return {
        success: false,
        error: this.extractErrorMessage(error),
      };
    }
  }

  /**
   * Test if connection is working
   */
  async testConnection(): Promise<TestResult> {
    const authResult = await this.authenticate();

    return {
      success: authResult.success,
      message: authResult.success
        ? `Connected as ${authResult.userName}`
        : authResult.error,
      metadata: authResult.success
        ? {
            userId: authResult.userId,
            userName: authResult.userName,
          }
        : undefined,
    };
  }

  /**
   * Sync recordings from Zoom
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    const results: SyncResult = {
      success: true,
      filesProcessed: 0,
      filesUpdated: 0,
      filesFailed: 0,
      filesDeleted: 0,
      errors: [],
    };

    try {
      // Ensure token is valid
      await this.ensureValidToken();

      // Get user ID
      const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      const userId = userResponse.data.id;

      // Calculate date range
      const fromDate = options?.since
        ? this.formatDate(options.since)
        : this.formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // Last 30 days

      const toDate = this.formatDate(new Date());

      console.log(`[Zoom Sync] Fetching recordings from ${fromDate} to ${toDate}`);

      // List recordings (paginated)
      const meetings = await this.listRecordings(userId, fromDate, toDate, options?.limit);

      console.log(`[Zoom Sync] Found ${meetings.length} meetings with recordings`);

      // Process each meeting
      for (const meeting of meetings) {
        try {
          await this.processMeeting(meeting);
          results.filesProcessed++;
        } catch (error: any) {
          console.error(`[Zoom Sync] Failed to process meeting ${meeting.uuid}:`, error);
          results.filesFailed++;
          results.errors.push({
            fileId: meeting.uuid,
            fileName: meeting.topic,
            error: this.extractErrorMessage(error),
            retryable: true,
          });
        }
      }

      results.success = results.filesFailed === 0;
    } catch (error: any) {
      console.error('[Zoom Sync] Sync failed:', error);
      results.success = false;
      results.errors.push({
        fileId: 'sync',
        fileName: 'Zoom Sync',
        error: this.extractErrorMessage(error),
        retryable: true,
      });
    }

    return results;
  }

  /**
   * List available files (recordings)
   */
  async listFiles(options?: ListOptions): Promise<ConnectorFile[]> {
    await this.ensureValidToken();

    // Get user ID
    const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    const userId = userResponse.data.id;

    // Default to last 30 days
    const fromDate = this.formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const toDate = this.formatDate(new Date());

    const meetings = await this.listRecordings(userId, fromDate, toDate, options?.limit);

    const files: ConnectorFile[] = [];

    for (const meeting of meetings) {
      for (const file of meeting.recording_files) {
        if (file.status !== 'completed') continue;

        files.push({
          id: file.id,
          name: `${meeting.topic} - ${file.recording_type}`,
          type: file.file_type,
          mimeType: this.getMimeType(file.file_type),
          size: file.file_size,
          modifiedAt: new Date(file.recording_end),
          createdAt: new Date(file.recording_start),
          url: file.download_url,
          path: meeting.topic,
          parentId: meeting.uuid,
          metadata: {
            meetingId: meeting.id,
            meetingUuid: meeting.uuid,
            topic: meeting.topic,
            startTime: meeting.start_time,
            duration: meeting.duration,
            recordingType: file.recording_type,
          },
        });
      }
    }

    return files;
  }

  /**
   * Download specific file
   */
  async downloadFile(fileId: string): Promise<FileContent> {
    await this.ensureValidToken();

    // Note: fileId should be the download URL for Zoom recordings
    const response = await axios.get(fileId, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'application/octet-stream';

    return {
      id: fileId,
      title: 'Zoom Recording',
      content: buffer,
      mimeType: contentType,
      size: buffer.length,
      metadata: {},
    };
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    console.log('[Zoom Webhook] Received event:', event.type);

    switch (event.type) {
      case 'recording.completed':
        await this.handleRecordingCompleted(event.payload);
        break;

      case 'recording.transcript_completed':
        await this.handleTranscriptCompleted(event.payload);
        break;

      case 'meeting.ended':
        await this.handleMeetingEnded(event.payload);
        break;

      default:
        console.log(`[Zoom Webhook] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Refresh expired credentials
   */
  async refreshCredentials(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    this.refreshToken = credentials.refreshToken || this.refreshToken;
    const refreshed = await this.refreshAccessToken();

    if (!refreshed) {
      throw new Error('Failed to refresh credentials');
    }

    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.expiresAt,
    };
  }

  // ===========================
  // Private Helper Methods
  // ===========================

  /**
   * List recordings with pagination
   */
  private async listRecordings(
    userId: string,
    fromDate: string,
    toDate: string,
    limit?: number
  ): Promise<ZoomMeeting[]> {
    const meetings: ZoomMeeting[] = [];
    let nextPageToken: string | undefined;
    const pageSize = Math.min(limit || 300, 300); // Zoom max is 300

    do {
      const response = await axios.get(`https://api.zoom.us/v2/users/${userId}/recordings`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params: {
          from: fromDate,
          to: toDate,
          page_size: pageSize,
          next_page_token: nextPageToken,
        },
      });

      if (response.data.meetings) {
        meetings.push(...response.data.meetings);
      }

      nextPageToken = response.data.next_page_token;

      // Stop if we've reached the limit
      if (limit && meetings.length >= limit) {
        break;
      }
    } while (nextPageToken);

    return limit ? meetings.slice(0, limit) : meetings;
  }

  /**
   * Process a single meeting
   */
  private async processMeeting(meeting: ZoomMeeting): Promise<void> {
    const { uuid, topic, start_time, duration, recording_files } = meeting;

    console.log(`[Zoom] Processing meeting: ${topic}`);

    // Process each recording file (video, audio, chat)
    for (const file of recording_files) {
      if (file.status !== 'completed') {
        console.log(`[Zoom] Skipping incomplete recording: ${file.recording_type}`);
        continue;
      }

      try {
        // Download file
        const fileData = await this.downloadRecordingFile(file);

        // Store in database
        await this.storeImportedDocument({
          externalId: `zoom-${uuid}-${file.id}`,
          title: `${topic} - ${file.recording_type}`,
          content: fileData,
          fileType: this.getMimeType(file.file_type),
          fileSize: file.file_size,
          sourceMetadata: {
            meetingUuid: uuid,
            meetingId: meeting.id,
            topic,
            startTime: start_time,
            duration,
            recordingType: file.recording_type,
            recordingStart: file.recording_start,
            recordingEnd: file.recording_end,
          },
        });

        console.log(`[Zoom] Stored recording: ${file.recording_type}`);
      } catch (error) {
        console.error(`[Zoom] Failed to download recording file ${file.id}:`, error);
        throw error;
      }
    }

    // Download transcript if available
    if (meeting.recording_transcript_file) {
      try {
        const transcript = await this.downloadTranscript(
          meeting.recording_transcript_file.download_url
        );

        await this.storeImportedDocument({
          externalId: `zoom-${uuid}-transcript`,
          title: `${topic} - Transcript`,
          content: transcript,
          fileType: 'text/vtt',
          fileSize: meeting.recording_transcript_file.file_size,
          sourceMetadata: {
            meetingUuid: uuid,
            meetingId: meeting.id,
            topic,
            startTime: start_time,
          },
        });

        console.log(`[Zoom] Stored transcript`);
      } catch (error) {
        console.error(`[Zoom] Failed to download transcript:`, error);
        // Don't throw - transcript is optional
      }
    }
  }

  /**
   * Download recording file as buffer
   */
  private async downloadRecordingFile(file: ZoomRecordingFile): Promise<Buffer> {
    const response = await axios.get(file.download_url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return Buffer.from(response.data);
  }

  /**
   * Download transcript as text
   */
  private async downloadTranscript(url: string): Promise<string> {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    try {
      console.log('[Zoom] Refreshing access token...');

      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('[Zoom] Missing ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET');
        return false;
      }

      const response = await axios.post(
        'https://zoom.us/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token || this.refreshToken;
      this.expiresAt = new Date(Date.now() + response.data.expires_in * 1000);

      console.log('[Zoom] Token refreshed successfully');

      // Update credentials in database
      await this.updateCredentials();

      return true;
    } catch (error) {
      console.error('[Zoom] Failed to refresh token:', error);
      return false;
    }
  }

  /**
   * Store imported document in database
   */
  private async storeImportedDocument(doc: {
    externalId: string;
    title: string;
    content: string | Buffer;
    fileType: string;
    fileSize: number;
    sourceMetadata: any;
  }): Promise<void> {
    const supabase = createClient();

    // Convert buffer to base64 if needed
    const content =
      doc.content instanceof Buffer ? doc.content.toString('base64') : doc.content;

    // Generate content hash for deduplication
    const contentHash = createHash('sha256').update(content).digest('hex');

    // Check if document already exists
    const { data: existing } = await supabase
      .from('imported_documents')
      .select('id, content_hash')
      .eq('connector_id', this.connectorId || null)
      .eq('external_id', doc.externalId)
      .single();

    if (existing && existing.content_hash === contentHash) {
      // Document unchanged, just update sync timestamp
      await supabase
        .from('imported_documents')
        .update({
          last_synced_at: new Date().toISOString(),
          sync_count: supabase.rpc('increment', { row_id: existing.id }),
        })
        .eq('id', existing.id);

      console.log(`[Zoom] Document unchanged: ${doc.title}`);
      return;
    }

    // Insert or update document
    const { error } = await supabase.from('imported_documents').upsert(
      {
        connector_id: this.connectorId || null,
        org_id: this.orgId,
        external_id: doc.externalId,
        title: doc.title,
        content,
        content_hash: contentHash,
        file_type: doc.fileType,
        file_size: doc.fileSize,
        source_metadata: doc.sourceMetadata,
        processing_status: 'pending',
        chunks_generated: false,
        embeddings_generated: false,
        last_synced_at: new Date().toISOString(),
        sync_count: existing ? undefined : 1,
      },
      {
        onConflict: 'connector_id,external_id',
      }
    );

    if (error) {
      console.error('[Zoom] Failed to store document:', error);
      throw error;
    }

    console.log(`[Zoom] Stored document: ${doc.title}`);
  }

  /**
   * Update credentials in database
   */
  private async updateCredentials(): Promise<void> {
    if (!this.connectorId) {
      console.warn('[Zoom] No connector ID set, skipping credential update');
      return;
    }

    const supabase = createClient();

    await supabase
      .from('connector_configs')
      .update({
        credentials: {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.expiresAt.toISOString(),
        },
        credentials_updated_at: new Date().toISOString(),
      })
      .eq('id', this.connectorId);
  }

  /**
   * Handle recording completed webhook
   */
  private async handleRecordingCompleted(payload: any): Promise<void> {
    console.log('[Zoom Webhook] Processing recording.completed event');

    const meeting = payload.object;
    await this.processMeeting(meeting);
  }

  /**
   * Handle transcript completed webhook
   */
  private async handleTranscriptCompleted(payload: any): Promise<void> {
    console.log('[Zoom Webhook] Processing recording.transcript_completed event');

    const { uuid, topic, transcript_url } = payload.object;

    const transcript = await this.downloadTranscript(transcript_url);

    await this.storeImportedDocument({
      externalId: `zoom-${uuid}-transcript`,
      title: `${topic} - Transcript`,
      content: transcript,
      fileType: 'text/vtt',
      fileSize: transcript.length,
      sourceMetadata: {
        meetingUuid: uuid,
        topic,
      },
    });
  }

  /**
   * Handle meeting ended webhook
   */
  private async handleMeetingEnded(payload: any): Promise<void> {
    // Optional: Track meeting metadata for future recording
    console.log('[Zoom] Meeting ended:', payload.object.topic);
    // Could queue a delayed sync job to check for recordings
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    const now = Date.now();
    const expiresAt = new Date(this.expiresAt).getTime();
    const buffer = 5 * 60 * 1000; // 5 minute buffer

    return now >= expiresAt - buffer;
  }

  /**
   * Ensure token is valid before API call
   */
  private async ensureValidToken(): Promise<void> {
    if (this.isTokenExpired()) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh expired token');
      }
    }
  }

  /**
   * Format date for Zoom API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      MP4: 'video/mp4',
      M4A: 'audio/mp4',
      TIMELINE: 'application/json',
      TRANSCRIPT: 'text/vtt',
      CHAT: 'text/plain',
      CC: 'text/vtt',
    };

    return mimeTypes[fileType.toUpperCase()] || 'application/octet-stream';
  }

  /**
   * Extract error message from axios error
   */
  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.data) {
        const data = axiosError.response.data as any;
        return data.message || data.error || axiosError.message;
      }
      return axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
