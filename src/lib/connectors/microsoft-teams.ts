/**
 * Microsoft Teams Connector
 *
 * Integrates with Microsoft Teams via Microsoft Graph API to import
 * meeting recordings, transcripts, and chat messages.
 *
 * Features:
 * - OAuth 2.0 authentication with Microsoft Azure AD
 * - List and download meeting recordings
 * - Download transcripts (VTT format)
 * - Access chat messages and meeting metadata
 * - Automatic token refresh on expiry
 * - Webhook support for real-time updates
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

// Microsoft Graph API endpoints
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_API_BETA = 'https://graph.microsoft.com/beta';

interface TeamsCredentials extends ConnectorCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | string;
  tenantId?: string;
}

interface TeamsConfig {
  orgId: string;
  connectorId?: string;
}

interface TeamsMeeting {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  onlineMeeting?: {
    joinUrl: string;
    recordings?: TeamsRecording[];
    transcripts?: TeamsTranscript[];
  };
  participants?: {
    organizer?: {
      identity: {
        user?: {
          displayName: string;
          id: string;
        };
      };
    };
    attendees?: any[];
  };
}

interface TeamsRecording {
  id: string;
  meetingId: string;
  meetingOrganizerId: string;
  createdDateTime: string;
  recordingContentUrl: string;
  recordingDuration?: number;
}

interface TeamsTranscript {
  id: string;
  meetingId: string;
  createdDateTime: string;
  content?: string;
  contentUrl?: string;
}

export class MicrosoftTeamsConnector implements Connector {
  readonly type = ConnectorType.MICROSOFT_TEAMS;
  readonly name = 'Microsoft Teams';
  readonly description = 'Sync Microsoft Teams meeting recordings and transcripts';

  private accessToken: string;
  private refreshToken: string;
  private expiresAt: Date;
  private tenantId?: string;
  private orgId: string;
  private connectorId?: string;

  constructor(credentials: TeamsCredentials, config?: TeamsConfig) {
    this.accessToken = credentials.accessToken || '';
    this.refreshToken = credentials.refreshToken || '';
    this.expiresAt = new Date(credentials.expiresAt || Date.now() + 3600000);
    this.tenantId = credentials.tenantId;
    this.orgId = config?.orgId || '';
    this.connectorId = config?.connectorId;
  }

  /**
   * Authenticate with Microsoft Graph API
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
      const response = await axios.get(`${GRAPH_API_BASE}/me`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return {
        success: true,
        userId: response.data.id,
        userName: response.data.displayName || response.data.userPrincipalName,
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

    if (!authResult.success) {
      return {
        success: false,
        message: authResult.error,
      };
    }

    try {
      // Test if we can access online meetings
      await axios.get(`${GRAPH_API_BASE}/me/onlineMeetings`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params: { $top: 1 },
      });

      return {
        success: true,
        message: `Connected as ${authResult.userName}`,
        metadata: {
          userId: authResult.userId,
          userName: authResult.userName,
        },
      };
    } catch (error) {
      return {
        success: true, // Auth worked, but might not have meeting permissions
        message: `Connected as ${authResult.userName} (limited permissions)`,
        metadata: {
          userId: authResult.userId,
          userName: authResult.userName,
          warning: 'May not have access to all meeting features',
        },
      };
    }
  }

  /**
   * Sync recordings from Microsoft Teams
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

      // Calculate date range
      const fromDate = options?.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      const toDate = new Date();

      console.log(`[Teams Sync] Fetching recordings from ${fromDate.toISOString()} to ${toDate.toISOString()}`);

      // List meetings with recordings
      const meetings = await this.listMeetingsWithRecordings(fromDate, toDate, options?.limit);

      console.log(`[Teams Sync] Found ${meetings.length} meetings with recordings`);

      // Process each meeting
      for (const meeting of meetings) {
        try {
          await this.processMeeting(meeting);
          results.filesProcessed++;
        } catch (error: any) {
          console.error(`[Teams Sync] Failed to process meeting ${meeting.id}:`, error);
          results.filesFailed++;
          results.errors.push({
            fileId: meeting.id,
            fileName: meeting.subject,
            error: this.extractErrorMessage(error),
            retryable: true,
          });
        }
      }

      results.success = results.filesFailed === 0;
    } catch (error: any) {
      console.error('[Teams Sync] Sync failed:', error);
      results.success = false;
      results.errors.push({
        fileId: 'sync',
        fileName: 'Teams Sync',
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

    // Default to last 30 days
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = new Date();

    const meetings = await this.listMeetingsWithRecordings(fromDate, toDate, options?.limit);

    const files: ConnectorFile[] = [];

    for (const meeting of meetings) {
      if (!meeting.onlineMeeting?.recordings) continue;

      for (const recording of meeting.onlineMeeting.recordings) {
        files.push({
          id: recording.id,
          name: `${meeting.subject} - Recording`,
          type: 'video',
          mimeType: 'video/mp4',
          size: 0, // Size not provided by API
          modifiedAt: new Date(recording.createdDateTime),
          createdAt: new Date(recording.createdDateTime),
          url: recording.recordingContentUrl,
          path: meeting.subject,
          parentId: meeting.id,
          metadata: {
            meetingId: meeting.id,
            subject: meeting.subject,
            startDateTime: meeting.startDateTime,
            endDateTime: meeting.endDateTime,
            duration: recording.recordingDuration,
            organizerId: recording.meetingOrganizerId,
          },
        });
      }

      // Add transcripts
      if (meeting.onlineMeeting?.transcripts) {
        for (const transcript of meeting.onlineMeeting.transcripts) {
          files.push({
            id: transcript.id,
            name: `${meeting.subject} - Transcript`,
            type: 'transcript',
            mimeType: 'text/vtt',
            size: 0,
            modifiedAt: new Date(transcript.createdDateTime),
            createdAt: new Date(transcript.createdDateTime),
            url: transcript.contentUrl,
            path: meeting.subject,
            parentId: meeting.id,
            metadata: {
              meetingId: meeting.id,
              subject: meeting.subject,
              startDateTime: meeting.startDateTime,
              endDateTime: meeting.endDateTime,
            },
          });
        }
      }
    }

    return files;
  }

  /**
   * Download specific file
   */
  async downloadFile(fileId: string): Promise<FileContent> {
    await this.ensureValidToken();

    // Note: fileId should be the download URL for Teams recordings
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
      title: 'Teams Recording',
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
    console.log('[Teams Webhook] Received event:', event.type);

    switch (event.type) {
      case 'callRecording':
        await this.handleRecordingCreated(event.payload);
        break;

      case 'callTranscript':
        await this.handleTranscriptCreated(event.payload);
        break;

      default:
        console.log(`[Teams Webhook] Unhandled event type: ${event.type}`);
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
      tenantId: this.tenantId,
    };
  }

  // ===========================
  // Private Helper Methods
  // ===========================

  /**
   * List meetings with recordings
   */
  private async listMeetingsWithRecordings(
    fromDate: Date,
    toDate: Date,
    limit?: number
  ): Promise<TeamsMeeting[]> {
    const meetings: TeamsMeeting[] = [];

    try {
      // Get user's calendar events
      const response = await axios.get(`${GRAPH_API_BASE}/me/calendar/events`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params: {
          $filter: `start/dateTime ge '${fromDate.toISOString()}' and start/dateTime le '${toDate.toISOString()}' and isOnlineMeeting eq true`,
          $select: 'id,subject,start,end,isOnlineMeeting,onlineMeeting',
          $top: limit || 100,
          $orderby: 'start/dateTime desc',
        },
      });

      const events = response.data.value || [];

      // Filter events that have recordings
      for (const event of events) {
        if (event.onlineMeeting?.joinUrl) {
          try {
            // Try to get recordings for this meeting
            const recordings = await this.getMeetingRecordings(event.id);
            const transcripts = await this.getMeetingTranscripts(event.id);

            if (recordings.length > 0 || transcripts.length > 0) {
              meetings.push({
                id: event.id,
                subject: event.subject,
                startDateTime: event.start.dateTime,
                endDateTime: event.end.dateTime,
                onlineMeeting: {
                  joinUrl: event.onlineMeeting.joinUrl,
                  recordings,
                  transcripts,
                },
              });
            }
          } catch (error) {
            console.error(`[Teams] Failed to get recordings for meeting ${event.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Teams] Failed to list meetings:', error);
      throw error;
    }

    return meetings;
  }

  /**
   * Get recordings for a meeting
   */
  private async getMeetingRecordings(meetingId: string): Promise<TeamsRecording[]> {
    try {
      // Note: This endpoint requires specific permissions and may not be available in all tenants
      const response = await axios.get(
        `${GRAPH_API_BETA}/me/onlineMeetings/${meetingId}/recordings`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      return response.data.value || [];
    } catch (error) {
      // Recording API may not be available
      console.debug(`[Teams] Could not fetch recordings for meeting ${meetingId}`);
      return [];
    }
  }

  /**
   * Get transcripts for a meeting
   */
  private async getMeetingTranscripts(meetingId: string): Promise<TeamsTranscript[]> {
    try {
      const response = await axios.get(
        `${GRAPH_API_BETA}/me/onlineMeetings/${meetingId}/transcripts`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      return response.data.value || [];
    } catch (error) {
      console.debug(`[Teams] Could not fetch transcripts for meeting ${meetingId}`);
      return [];
    }
  }

  /**
   * Process a single meeting
   */
  private async processMeeting(meeting: TeamsMeeting): Promise<void> {
    console.log(`[Teams] Processing meeting: ${meeting.subject}`);

    // Process recordings
    if (meeting.onlineMeeting?.recordings) {
      for (const recording of meeting.onlineMeeting.recordings) {
        try {
          // Download recording
          const fileData = await this.downloadRecording(recording.recordingContentUrl);

          // Store in database
          await this.storeImportedDocument({
            externalId: `teams-${meeting.id}-${recording.id}`,
            title: `${meeting.subject} - Recording`,
            content: fileData,
            fileType: 'video/mp4',
            fileSize: fileData.length,
            sourceMetadata: {
              meetingId: meeting.id,
              subject: meeting.subject,
              startDateTime: meeting.startDateTime,
              endDateTime: meeting.endDateTime,
              recordingId: recording.id,
              createdDateTime: recording.createdDateTime,
              duration: recording.recordingDuration,
            },
          });

          console.log(`[Teams] Stored recording`);
        } catch (error) {
          console.error(`[Teams] Failed to download recording ${recording.id}:`, error);
          throw error;
        }
      }
    }

    // Process transcripts
    if (meeting.onlineMeeting?.transcripts) {
      for (const transcript of meeting.onlineMeeting.transcripts) {
        try {
          // Download transcript
          const transcriptData = transcript.contentUrl
            ? await this.downloadTranscript(transcript.contentUrl)
            : transcript.content || '';

          await this.storeImportedDocument({
            externalId: `teams-${meeting.id}-transcript`,
            title: `${meeting.subject} - Transcript`,
            content: transcriptData,
            fileType: 'text/vtt',
            fileSize: transcriptData.length,
            sourceMetadata: {
              meetingId: meeting.id,
              subject: meeting.subject,
              startDateTime: meeting.startDateTime,
              endDateTime: meeting.endDateTime,
              transcriptId: transcript.id,
              createdDateTime: transcript.createdDateTime,
            },
          });

          console.log(`[Teams] Stored transcript`);
        } catch (error) {
          console.error(`[Teams] Failed to download transcript:`, error);
          // Don't throw - transcript is optional
        }
      }
    }
  }

  /**
   * Download recording as buffer
   */
  private async downloadRecording(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
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
      console.log('[Teams] Refreshing access token...');

      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const tenantId = this.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';

      if (!clientId || !clientSecret) {
        console.error('[Teams] Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET');
        return false;
      }

      const response = await axios.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          scope: 'https://graph.microsoft.com/.default offline_access',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token || this.refreshToken;
      this.expiresAt = new Date(Date.now() + response.data.expires_in * 1000);

      console.log('[Teams] Token refreshed successfully');

      // Update credentials in database
      await this.updateCredentials();

      return true;
    } catch (error) {
      console.error('[Teams] Failed to refresh token:', error);
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

      console.log(`[Teams] Document unchanged: ${doc.title}`);
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
      console.error('[Teams] Failed to store document:', error);
      throw error;
    }

    console.log(`[Teams] Stored document: ${doc.title}`);
  }

  /**
   * Update credentials in database
   */
  private async updateCredentials(): Promise<void> {
    if (!this.connectorId) {
      console.warn('[Teams] No connector ID set, skipping credential update');
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
          tenantId: this.tenantId,
        },
        credentials_updated_at: new Date().toISOString(),
      })
      .eq('id', this.connectorId);
  }

  /**
   * Handle recording created webhook
   */
  private async handleRecordingCreated(payload: any): Promise<void> {
    console.log('[Teams Webhook] Processing callRecording event');

    const { meetingId, recordingUrl } = payload;

    if (!meetingId || !recordingUrl) {
      console.error('[Teams Webhook] Missing required fields in payload');
      return;
    }

    // Fetch meeting details and process
    try {
      const meeting = await this.getMeetingById(meetingId);
      if (meeting) {
        await this.processMeeting(meeting);
      }
    } catch (error) {
      console.error('[Teams Webhook] Failed to process recording:', error);
    }
  }

  /**
   * Handle transcript created webhook
   */
  private async handleTranscriptCreated(payload: any): Promise<void> {
    console.log('[Teams Webhook] Processing callTranscript event');

    const { meetingId, transcriptUrl } = payload;

    if (!meetingId || !transcriptUrl) {
      console.error('[Teams Webhook] Missing required fields in payload');
      return;
    }

    try {
      const transcript = await this.downloadTranscript(transcriptUrl);

      await this.storeImportedDocument({
        externalId: `teams-${meetingId}-transcript`,
        title: `Meeting Transcript`,
        content: transcript,
        fileType: 'text/vtt',
        fileSize: transcript.length,
        sourceMetadata: {
          meetingId,
          transcriptUrl,
        },
      });
    } catch (error) {
      console.error('[Teams Webhook] Failed to process transcript:', error);
    }
  }

  /**
   * Get meeting by ID
   */
  private async getMeetingById(meetingId: string): Promise<TeamsMeeting | null> {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/me/calendar/events/${meetingId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params: {
          $select: 'id,subject,start,end,isOnlineMeeting,onlineMeeting',
        },
      });

      const event = response.data;

      if (!event.onlineMeeting?.joinUrl) {
        return null;
      }

      const recordings = await this.getMeetingRecordings(event.id);
      const transcripts = await this.getMeetingTranscripts(event.id);

      return {
        id: event.id,
        subject: event.subject,
        startDateTime: event.start.dateTime,
        endDateTime: event.end.dateTime,
        onlineMeeting: {
          joinUrl: event.onlineMeeting.joinUrl,
          recordings,
          transcripts,
        },
      };
    } catch (error) {
      console.error(`[Teams] Failed to get meeting ${meetingId}:`, error);
      return null;
    }
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
   * Extract error message from axios error
   */
  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.data) {
        const data = axiosError.response.data as any;
        return data.error?.message || data.message || data.error || axiosError.message;
      }
      return axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
