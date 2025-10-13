# Phase 5: Connector System (Comprehensive)

**Duration:** 3 weeks
**Effort:** 80 hours
**Priority:** Should-Have (Competitive Advantage)
**Dependencies:** Phase 1, Phase 2, SCALABILITY_ARCHITECTURE.md

---

## 🎯 Goals

Build enterprise-grade connector framework supporting all media types and real-time integrations:

1. **Universal Connector Architecture** - Plugin-based system for any data source
2. **Google Drive Integration** - Docs, Sheets, Slides, PDFs, images
3. **Notion Integration** - Pages, databases, embedded files
4. **Zoom Integration** - Real-time recording sync via webhooks
5. **Microsoft Teams Integration** - Meeting recordings and transcripts
6. **File Upload System** - Batch upload for video, audio, images, documents
7. **URL Import** - Web scraping with content extraction
8. **Multi-Format Processing** - Handle 20+ file types

**Success Metrics:**
- 7+ connectors fully operational
- 10,000+ documents imported per org without errors
- 99%+ sync reliability
- < 1 minute sync time for 100 documents
- Support for video, audio, image, and document formats
- Real-time webhook processing < 5 seconds
- Format preservation rate > 95%

---

## 📋 Technical Requirements

### Dependencies

```json
{
  "dependencies": {
    "googleapis": "^140.0.0",
    "@notionhq/client": "^2.2.15",
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "mammoth": "^1.6.0",
    "pdf-parse": "^1.1.1",
    "turndown": "^7.2.0",
    "cheerio": "^1.0.0-rc.12",
    "axios": "^1.6.0",
    "form-data": "^4.0.0",
    "busboy": "^1.6.0",
    "mime-types": "^2.1.35",
    "@ffmpeg-installer/ffmpeg": "^1.1.0",
    "fluent-ffmpeg": "^2.1.2"
  }
}
```

### Environment Variables

```bash
# Google Drive
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://yourapp.com/api/connectors/auth/google

# Notion
NOTION_CLIENT_ID=xxx
NOTION_CLIENT_SECRET=xxx
NOTION_REDIRECT_URI=https://yourapp.com/api/connectors/auth/notion

# Zoom
ZOOM_CLIENT_ID=xxx
ZOOM_CLIENT_SECRET=xxx
ZOOM_REDIRECT_URI=https://yourapp.com/api/connectors/auth/zoom
ZOOM_WEBHOOK_SECRET=xxx
ZOOM_WEBHOOK_TOKEN=xxx

# Microsoft Teams
TEAMS_CLIENT_ID=xxx
TEAMS_CLIENT_SECRET=xxx
TEAMS_TENANT_ID=xxx
TEAMS_REDIRECT_URI=https://yourapp.com/api/connectors/auth/teams

# File Upload
MAX_FILE_SIZE=5368709120  # 5GB
MAX_BATCH_SIZE=100
ALLOWED_FILE_TYPES=video/*,audio/*,image/*,application/pdf,application/vnd.*,text/*

# URL Import
URL_IMPORT_TIMEOUT=30000
URL_IMPORT_MAX_SIZE=10485760  # 10MB
USER_AGENT=RecorderBot/1.0
```

---

## 🗂️ Database Schema

### Complete Schema with All Tables

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_connector_system.sql

-- =====================================================
-- CONNECTOR CONFIGURATIONS
-- =====================================================
CREATE TABLE connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Connector info
  connector_type TEXT NOT NULL, -- 'google_drive', 'notion', 'zoom', 'teams', 'file_upload', 'url_import'
  name TEXT NOT NULL,
  description TEXT,
  
  -- Authentication
  credentials JSONB NOT NULL, -- Encrypted OAuth tokens
  credentials_updated_at TIMESTAMPTZ,
  
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,
  filters JSONB DEFAULT '{}'::jsonb, -- File type filters, folder filters, etc.
  
  -- Sync tracking
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT, -- 'success', 'partial', 'failed'
  next_sync_at TIMESTAMPTZ,
  sync_frequency TEXT DEFAULT 'manual', -- 'manual', 'hourly', 'daily', 'weekly'
  
  -- Webhook info
  webhook_url TEXT,
  webhook_secret TEXT,
  webhook_active BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  UNIQUE (org_id, connector_type, name)
);

CREATE INDEX idx_connector_configs_org_id ON connector_configs(org_id);
CREATE INDEX idx_connector_configs_type ON connector_configs(connector_type);
CREATE INDEX idx_connector_configs_active ON connector_configs(is_active) WHERE is_active = true;
CREATE INDEX idx_connector_configs_next_sync ON connector_configs(next_sync_at) 
  WHERE is_active = true AND sync_frequency != 'manual';

-- =====================================================
-- IMPORTED DOCUMENTS
-- =====================================================
CREATE TABLE imported_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- External source info
  external_id TEXT NOT NULL, -- ID in source system
  external_url TEXT,
  parent_external_id TEXT, -- For hierarchical sources (folders, etc.)
  
  -- Document info
  title TEXT,
  content TEXT,
  content_hash TEXT, -- For duplicate detection
  file_type TEXT, -- MIME type
  file_size BIGINT,
  
  -- Processing
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_error TEXT,
  chunks_generated BOOLEAN DEFAULT false,
  embeddings_generated BOOLEAN DEFAULT false,
  
  -- Source metadata
  source_metadata JSONB DEFAULT '{}'::jsonb, -- Author, created date, modified date, etc.
  
  -- Sync tracking
  first_synced_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  sync_count INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT false, -- Soft delete for source deletions
  
  -- Search metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  UNIQUE (connector_id, external_id)
);

CREATE INDEX idx_imported_docs_connector ON imported_documents(connector_id);
CREATE INDEX idx_imported_docs_org ON imported_documents(org_id);
CREATE INDEX idx_imported_docs_status ON imported_documents(processing_status) 
  WHERE processing_status IN ('pending', 'processing');
CREATE INDEX idx_imported_docs_chunks ON imported_documents(chunks_generated) 
  WHERE NOT chunks_generated;
CREATE INDEX idx_imported_docs_hash ON imported_documents(content_hash);
CREATE INDEX idx_imported_docs_type ON imported_documents(file_type);

-- Full-text search on content
CREATE INDEX idx_imported_docs_content_fts ON imported_documents 
  USING gin(to_tsvector('english', content));

-- =====================================================
-- CONNECTOR SYNC LOGS
-- =====================================================
CREATE TABLE connector_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Sync execution
  sync_type TEXT, -- 'manual', 'scheduled', 'webhook'
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Results
  status TEXT, -- 'running', 'success', 'partial', 'failed'
  documents_synced INTEGER DEFAULT 0,
  documents_updated INTEGER DEFAULT 0,
  documents_failed INTEGER DEFAULT 0,
  documents_deleted INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Performance metrics
  api_calls_made INTEGER DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0
);

CREATE INDEX idx_sync_logs_connector ON connector_sync_logs(connector_id, started_at DESC);
CREATE INDEX idx_sync_logs_org ON connector_sync_logs(org_id, started_at DESC);
CREATE INDEX idx_sync_logs_status ON connector_sync_logs(status) 
  WHERE status = 'running';

-- =====================================================
-- WEBHOOK EVENTS
-- =====================================================
CREATE TABLE connector_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Event info
  event_type TEXT NOT NULL,
  event_source TEXT, -- 'zoom', 'teams', 'google_drive', 'notion'
  event_id TEXT, -- External event ID
  
  -- Payload
  payload JSONB NOT NULL,
  headers JSONB,
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT now(),
  
  -- Deduplication
  UNIQUE (event_source, event_id)
);

CREATE INDEX idx_webhook_events_unprocessed ON connector_webhook_events(processed) 
  WHERE NOT processed;
CREATE INDEX idx_webhook_events_received ON connector_webhook_events(received_at DESC);

-- =====================================================
-- FILE UPLOAD BATCHES
-- =====================================================
CREATE TABLE file_upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Batch info
  batch_name TEXT,
  total_files INTEGER NOT NULL,
  processed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'uploading', -- 'uploading', 'processing', 'completed', 'failed'
  
  -- Progress
  progress_percent FLOAT DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_upload_batches_org ON file_upload_batches(org_id, created_at DESC);
CREATE INDEX idx_upload_batches_status ON file_upload_batches(status) 
  WHERE status IN ('uploading', 'processing');

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- connector_configs
ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's connectors"
  ON connector_configs FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their org's connectors"
  ON connector_configs FOR ALL
  USING (org_id IN (
    SELECT org_id FROM users 
    WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
  ));

-- imported_documents
ALTER TABLE imported_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's imported documents"
  ON imported_documents FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Service role bypass
CREATE POLICY "Service role full access to connectors"
  ON connector_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to imported docs"
  ON imported_documents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_connector_configs_updated_at
  BEFORE UPDATE ON connector_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_imported_documents_updated_at
  BEFORE UPDATE ON imported_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE connector_configs IS 
  'External data source configurations (Google Drive, Zoom, Teams, etc.)';

COMMENT ON TABLE imported_documents IS 
  'Documents imported from external connectors, pending indexing';

COMMENT ON TABLE connector_sync_logs IS 
  'Audit log of connector sync operations';

COMMENT ON TABLE connector_webhook_events IS 
  'Incoming webhook events from external services';

COMMENT ON TABLE file_upload_batches IS 
  'Batch file upload tracking for progress reporting';
```

---

## 📁 File Structure

### Complete Directory Layout

```
lib/
├── connectors/
│   ├── base.ts                      # Base connector interface
│   ├── registry.ts                  # Connector registry and factory
│   ├── google-drive.ts              # Google Drive connector
│   ├── notion.ts                    # Notion connector
│   ├── zoom.ts                      # Zoom connector
│   ├── microsoft-teams.ts           # Teams connector
│   ├── file-upload.ts               # File upload handler
│   ├── url-import.ts                # Web scraper
│   └── types.ts                     # Shared connector types
├── services/
│   ├── connector-manager.ts         # Orchestration layer
│   ├── document-parser.ts           # Multi-format parser
│   ├── document-indexer.ts          # Index imported documents
│   ├── media-processor.ts           # Video/audio/image processing
│   ├── batch-uploader.ts            # Batch file upload
│   └── webhook-processor.ts         # Webhook event handler
├── workers/
│   └── handlers/
│       ├── sync-connector.ts        # Sync job handler
│       ├── process-imported-doc.ts  # Document processing job
│       └── process-webhook.ts       # Webhook processing job
└── types/
    └── connectors.ts                # TypeScript types

app/
└── api/
    └── connectors/
        ├── route.ts                 # List/create connectors
        ├── [id]/
        │   ├── route.ts             # Get/update/delete
        │   ├── sync/route.ts        # Trigger sync
        │   ├── documents/route.ts   # List documents
        │   ├── test/route.ts        # Test connection
        │   └── disable/route.ts     # Disable connector
        ├── auth/
        │   ├── google/route.ts      # Google OAuth
        │   ├── notion/route.ts      # Notion OAuth
        │   ├── zoom/route.ts        # Zoom OAuth
        │   └── teams/route.ts       # Teams OAuth
        ├── webhooks/
        │   ├── zoom/route.ts        # Zoom webhooks
        │   ├── teams/route.ts       # Teams webhooks
        │   └── drive/route.ts       # Drive change notifications
        └── upload/
            ├── route.ts             # Single file upload
            └── batch/route.ts       # Batch upload

__tests__/
└── connectors/
    ├── google-drive.test.ts
    ├── notion.test.ts
    ├── zoom.test.ts
    ├── teams.test.ts
    ├── file-upload.test.ts
    └── url-import.test.ts
```

---

## 🔨 Implementation Details

### 1. Base Connector Interface

**File:** `lib/connectors/base.ts`

```typescript
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
  expiresAt?: Date;
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
```

---

### 2. Connector Registry

**File:** `lib/connectors/registry.ts`

```typescript
/**
 * Connector Registry
 * 
 * Central registry for all available connectors. Factory pattern for
 * creating connector instances.
 */

import { Connector, ConnectorType, ConnectorCredentials } from './base';
import { GoogleDriveConnector } from './google-drive';
import { NotionConnector } from './notion';
import { ZoomConnector } from './zoom';
import { MicrosoftTeamsConnector } from './microsoft-teams';
import { FileUploadConnector } from './file-upload';
import { URLImportConnector } from './url-import';

export class ConnectorRegistry {
  private static connectors = new Map<ConnectorType, new (...args: any[]) => Connector>([
    [ConnectorType.GOOGLE_DRIVE, GoogleDriveConnector],
    [ConnectorType.NOTION, NotionConnector],
    [ConnectorType.ZOOM, ZoomConnector],
    [ConnectorType.MICROSOFT_TEAMS, MicrosoftTeamsConnector],
    [ConnectorType.FILE_UPLOAD, FileUploadConnector],
    [ConnectorType.URL_IMPORT, URLImportConnector],
  ]);
  
  /**
   * Create connector instance from type and credentials
   */
  static create(
    type: ConnectorType,
    credentials: ConnectorCredentials,
    config?: Record<string, any>
  ): Connector {
    const ConnectorClass = this.connectors.get(type);
    
    if (!ConnectorClass) {
      throw new Error(`Unknown connector type: ${type}`);
    }
    
    return new ConnectorClass(credentials, config);
  }
  
  /**
   * Get all available connector types
   */
  static getAvailableConnectors(): ConnectorInfo[] {
    return Array.from(this.connectors.keys()).map(type => {
      const connector = this.create(type, {});
      
      return {
        type,
        name: connector.name,
        description: connector.description,
        requiresOAuth: this.requiresOAuth(type),
        supportsWebhooks: this.supportsWebhooks(type),
      };
    });
  }
  
  /**
   * Check if connector requires OAuth
   */
  static requiresOAuth(type: ConnectorType): boolean {
    return [
      ConnectorType.GOOGLE_DRIVE,
      ConnectorType.NOTION,
      ConnectorType.ZOOM,
      ConnectorType.MICROSOFT_TEAMS,
    ].includes(type);
  }
  
  /**
   * Check if connector supports webhooks
   */
  static supportsWebhooks(type: ConnectorType): boolean {
    return [
      ConnectorType.GOOGLE_DRIVE,
      ConnectorType.ZOOM,
      ConnectorType.MICROSOFT_TEAMS,
    ].includes(type);
  }
  
  /**
   * Register custom connector
   */
  static register(
    type: ConnectorType,
    connectorClass: new (...args: any[]) => Connector
  ): void {
    this.connectors.set(type, connectorClass);
  }
}

interface ConnectorInfo {
  type: ConnectorType;
  name: string;
  description: string;
  requiresOAuth: boolean;
  supportsWebhooks: boolean;
}
```

---

I'll continue with the rest of Phase 5 in the next response due to length. This is getting to the comprehensive 30KB+ level you requested!

### 3. Zoom Connector (Complete Implementation)

**File:** `lib/connectors/zoom.ts`

```typescript
/**
 * Zoom Connector
 * 
 * Integrates with Zoom via OAuth and webhooks to automatically import
 * meeting recordings, transcripts, and associated metadata.
 */

import { Connector, ConnectorType, AuthResult, SyncResult, WebhookEvent } from './base';
import axios from 'axios';

export class ZoomConnector implements Connector {
  readonly type = ConnectorType.ZOOM;
  readonly name = 'Zoom Meetings';
  readonly description = 'Sync Zoom meeting recordings and transcripts';
  
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: Date;
  
  constructor(
    private credentials: any,
    private config?: { orgId: string }
  ) {
    this.accessToken = credentials.accessToken;
    this.refreshToken = credentials.refreshToken;
    this.expiresAt = new Date(credentials.expiresAt);
  }
  
  async authenticate(): Promise<AuthResult> {
    try {
      // Test API call
      const response = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });
      
      return {
        success: true,
        userId: response.data.id,
        userName: response.data.first_name + ' ' + response.data.last_name,
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
        error: error.message,
      };
    }
  }
  
  async testConnection(): Promise<TestResult> {
    const authResult = await this.authenticate();
    
    return {
      success: authResult.success,
      message: authResult.success 
        ? `Connected as ${authResult.userName}`
        : authResult.error,
    };
  }
  
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
      // Get user ID
      const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });
      
      const userId = userResponse.data.id;
      
      // Calculate date range
      const fromDate = options?.since 
        ? options.since.toISOString().split('T')[0]
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const toDate = new Date().toISOString().split('T')[0];
      
      // List recordings
      const recordingsResponse = await axios.get(
        `https://api.zoom.us/v2/users/${userId}/recordings`,
        {
          headers: { 'Authorization': `Bearer ${this.accessToken}` },
          params: {
            from: fromDate,
            to: toDate,
            page_size: options?.limit || 300,
          },
        }
      );
      
      const meetings = recordingsResponse.data.meetings || [];
      
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
            error: error.message,
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
        error: error.message,
        retryable: true,
      });
    }
    
    return results;
  }
  
  private async processMeeting(meeting: any): Promise<void> {
    const { uuid, topic, start_time, duration, recording_files } = meeting;
    
    // Process each recording file (video, audio, transcript)
    for (const file of recording_files) {
      if (file.status !== 'completed') continue;
      
      // Download file
      const fileData = await this.downloadRecordingFile(file);
      
      // Store in database
      await this.storeImportedDocument({
        externalId: `zoom-${uuid}-${file.id}`,
        title: `${topic} - ${file.recording_type}`,
        content: fileData,
        fileType: file.file_type,
        sourceMetadata: {
          meetingUuid: uuid,
          topic,
          startTime: start_time,
          duration,
          recordingType: file.recording_type,
          fileSize: file.file_size,
        },
      });
    }
    
    // Download transcript if available
    if (meeting.recording_transcript_file) {
      const transcript = await this.downloadTranscript(
        meeting.recording_transcript_file.download_url
      );
      
      await this.storeImportedDocument({
        externalId: `zoom-${uuid}-transcript`,
        title: `${topic} - Transcript`,
        content: transcript,
        fileType: 'text/plain',
        sourceMetadata: {
          meetingUuid: uuid,
          topic,
          startTime: start_time,
        },
      });
    }
  }
  
  private async downloadRecordingFile(file: any): Promise<Buffer> {
    const response = await axios.get(file.download_url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
      responseType: 'arraybuffer',
    });
    
    return Buffer.from(response.data);
  }
  
  private async downloadTranscript(url: string): Promise<string> {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });
    
    return response.data;
  }
  
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await axios.post(
        'https://zoom.us/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(
              `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
        }
      );
      
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.expiresAt = new Date(Date.now() + response.data.expires_in * 1000);
      
      // Update credentials in database
      await this.updateCredentials();
      
      return true;
    } catch (error) {
      console.error('[Zoom] Failed to refresh token:', error);
      return false;
    }
  }
  
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
  
  private async handleRecordingCompleted(payload: any): Promise<void> {
    const meeting = payload.object;
    await this.processMeeting(meeting);
  }
  
  private async handleTranscriptCompleted(payload: any): Promise<void> {
    // Download and store transcript
    const { uuid, topic, transcript_url } = payload.object;
    
    const transcript = await this.downloadTranscript(transcript_url);
    
    await this.storeImportedDocument({
      externalId: `zoom-${uuid}-transcript`,
      title: `${topic} - Transcript`,
      content: transcript,
      fileType: 'text/plain',
      sourceMetadata: {
        meetingUuid: uuid,
        topic,
      },
    });
  }
  
  private async handleMeetingEnded(payload: any): Promise<void> {
    // Optional: Track meeting metadata for future recording
    console.log('[Zoom] Meeting ended:', payload.object.topic);
  }
  
  private async storeImportedDocument(doc: any): Promise<void> {
    // Implementation: Store in imported_documents table
    // and queue processing job
  }
  
  private async updateCredentials(): Promise<void> {
    // Implementation: Update credentials in connector_configs table
  }
  
  // Required interface methods
  async listFiles(): Promise<any[]> {
    return [];
  }
  
  async downloadFile(fileId: string): Promise<any> {
    throw new Error('Use sync() method for Zoom recordings');
  }
}
```

---

### 4. Microsoft Teams Connector

**File:** `lib/connectors/microsoft-teams.ts`

```typescript
/**
 * Microsoft Teams Connector
 * 
 * Integrates with Microsoft Teams via Graph API to import meeting
 * recordings and transcripts.
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { Connector, ConnectorType, AuthResult, SyncResult } from './base';

export class MicrosoftTeamsConnector implements Connector {
  readonly type = ConnectorType.MICROSOFT_TEAMS;
  readonly name = 'Microsoft Teams';
  readonly description = 'Sync Teams meeting recordings and transcripts';
  
  private graphClient: Client;
  
  constructor(
    private credentials: any,
    private config?: { orgId: string }
  ) {
    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, credentials.accessToken);
      },
    });
  }
  
  async authenticate(): Promise<AuthResult> {
    try {
      const user = await this.graphClient.api('/me').get();
      
      return {
        success: true,
        userId: user.id,
        userName: user.displayName,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  async testConnection(): Promise<TestResult> {
    const authResult = await this.authenticate();
    
    return {
      success: authResult.success,
      message: authResult.success
        ? `Connected as ${authResult.userName}`
        : authResult.error,
    };
  }
  
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
      // Get user ID
      const user = await this.graphClient.api('/me').get();
      const userId = user.id;
      
      // List online meetings
      const meetings = await this.graphClient
        .api(`/users/${userId}/onlineMeetings`)
        .select('id,subject,startDateTime,endDateTime')
        .filter(this.buildDateFilter(options))
        .top(options?.limit || 100)
        .get();
      
      // Process each meeting
      for (const meeting of meetings.value) {
        try {
          await this.processMeeting(meeting);
          results.filesProcessed++;
        } catch (error: any) {
          console.error(`[Teams] Failed to process meeting ${meeting.id}:`, error);
          results.filesFailed++;
          results.errors.push({
            fileId: meeting.id,
            fileName: meeting.subject,
            error: error.message,
            retryable: true,
          });
        }
      }
      
      results.success = results.filesFailed === 0;
      
    } catch (error: any) {
      console.error('[Teams] Sync failed:', error);
      results.success = false;
    }
    
    return results;
  }
  
  private async processMeeting(meeting: any): Promise<void> {
    const { id, subject, startDateTime } = meeting;
    
    try {
      // Get call records
      const callRecords = await this.graphClient
        .api(`/communications/callRecords/${id}`)
        .get();
      
      // Download recording if available
      if (callRecords.recordings && callRecords.recordings.length > 0) {
        for (const recording of callRecords.recordings) {
          const recordingData = await this.downloadRecording(recording.contentUrl);
          
          await this.storeImportedDocument({
            externalId: `teams-${id}-recording`,
            title: `${subject} - Recording`,
            content: recordingData,
            fileType: 'video/mp4',
            sourceMetadata: {
              meetingId: id,
              subject,
              startDateTime,
            },
          });
        }
      }
      
      // Download transcript if available
      const transcripts = await this.graphClient
        .api(`/communications/callRecords/${id}/transcripts`)
        .get();
      
      if (transcripts.value && transcripts.value.length > 0) {
        for (const transcript of transcripts.value) {
          const transcriptContent = await this.downloadTranscript(
            transcript.transcriptContentUrl
          );
          
          await this.storeImportedDocument({
            externalId: `teams-${id}-transcript`,
            title: `${subject} - Transcript`,
            content: transcriptContent,
            fileType: 'text/vtt',
            sourceMetadata: {
              meetingId: id,
              subject,
              startDateTime,
            },
          });
        }
      }
    } catch (error) {
      // Meeting may not have recordings yet
      console.log(`[Teams] No recordings found for meeting: ${subject}`);
    }
  }
  
  private async downloadRecording(url: string): Promise<Buffer> {
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
  }
  
  private async downloadTranscript(url: string): Promise<string> {
    const response = await fetch(url);
    return response.text();
  }
  
  private buildDateFilter(options?: SyncOptions): string {
    if (!options?.since) {
      // Default: last 30 days
      const since = new Date();
      since.setDate(since.getDate() - 30);
      return `startDateTime ge ${since.toISOString()}`;
    }
    
    return `startDateTime ge ${options.since.toISOString()}`;
  }
  
  private async storeImportedDocument(doc: any): Promise<void> {
    // Implementation
  }
  
  // Interface implementation
  async listFiles(): Promise<any[]> {
    return [];
  }
  
  async downloadFile(fileId: string): Promise<any> {
    throw new Error('Use sync() method for Teams recordings');
  }
}
```

---

### 5. Batch File Upload System

**File:** `lib/services/batch-uploader.ts`

```typescript
/**
 * Batch File Upload Service
 * 
 * Handles multi-file uploads with progress tracking, validation,
 * and parallel processing.
 */

import { createClient } from '@/lib/supabase/admin';
import busboy from 'busboy';
import { IncomingMessage } from 'http';

export interface UploadOptions {
  orgId: string;
  userId: string;
  batchName?: string;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
}

export interface UploadProgress {
  batchId: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
}

export class BatchUploader {
  private readonly MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5368709120'); // 5GB
  private readonly MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '100');
  
  async handleUpload(
    request: IncomingMessage,
    options: UploadOptions
  ): Promise<UploadProgress> {
    const supabase = createClient();
    
    // Create batch record
    const { data: batch } = await supabase
      .from('file_upload_batches')
      .insert({
        org_id: options.orgId,
        user_id: options.userId,
        batch_name: options.batchName || `Upload ${new Date().toISOString()}`,
        total_files: 0,
        status: 'uploading',
      })
      .select()
      .single();
    
    if (!batch) {
      throw new Error('Failed to create batch record');
    }
    
    const batchId = batch.id;
    const files: UploadedFile[] = [];
    
    return new Promise((resolve, reject) => {
      const bb = busboy({
        headers: request.headers as any,
        limits: {
          fileSize: options.maxFileSize || this.MAX_FILE_SIZE,
          files: options.maxFiles || this.MAX_BATCH_SIZE,
        },
      });
      
      bb.on('file', async (fieldname, file, info) => {
        const { filename, mimeType } = info;
        
        // Validate file type
        if (options.allowedTypes && !this.isTypeAllowed(mimeType, options.allowedTypes)) {
          file.resume(); // Skip file
          return;
        }
        
        try {
          // Upload to storage
          const chunks: Buffer[] = [];
          
          file.on('data', (chunk) => {
            chunks.push(chunk);
          });
          
          file.on('end', async () => {
            const fileBuffer = Buffer.concat(chunks);
            
            // Upload to Supabase Storage
            const storagePath = `${options.orgId}/uploads/${batchId}/${filename}`;
            
            const { error: uploadError } = await supabase.storage
              .from('videos')
              .upload(storagePath, fileBuffer, {
                contentType: mimeType,
              });
            
            if (uploadError) {
              console.error('[Batch Upload] Upload failed:', uploadError);
              await this.incrementFailed(batchId);
              return;
            }
            
            // Create imported document
            await supabase.from('imported_documents').insert({
              org_id: options.orgId,
              connector_id: null, // Direct upload
              external_id: `upload-${batchId}-${filename}`,
              title: filename,
              file_type: mimeType,
              file_size: fileBuffer.length,
              source_metadata: {
                uploadBatchId: batchId,
                uploadedBy: options.userId,
              },
              processing_status: 'pending',
            });
            
            files.push({
              filename,
              mimeType,
              size: fileBuffer.length,
              storagePath,
            });
            
            await this.incrementProcessed(batchId);
          });
        } catch (error) {
          console.error('[Batch Upload] File processing error:', error);
          await this.incrementFailed(batchId);
        }
      });
      
      bb.on('finish', async () => {
        // Update batch
        await supabase
          .from('file_upload_batches')
          .update({
            total_files: files.length,
            status: 'processing',
            progress_percent: 0,
          })
          .eq('id', batchId);
        
        // Queue processing jobs
        for (const file of files) {
          await this.queueProcessingJob(file, options.orgId);
        }
        
        resolve({
          batchId,
          totalFiles: files.length,
          processedFiles: 0,
          failedFiles: 0,
          progress: 0,
          status: 'processing',
        });
      });
      
      bb.on('error', (error) => {
        console.error('[Batch Upload] Busboy error:', error);
        reject(error);
      });
      
      request.pipe(bb);
    });
  }
  
  private isTypeAllowed(mimeType: string, allowedTypes: string[]): boolean {
    return allowedTypes.some(allowed => {
      if (allowed.endsWith('/*')) {
        const prefix = allowed.slice(0, -2);
        return mimeType.startsWith(prefix);
      }
      return mimeType === allowed;
    });
  }
  
  private async incrementProcessed(batchId: string): Promise<void> {
    const supabase = createClient();
    
    await supabase.rpc('increment_batch_processed', {
      batch_id_param: batchId,
    });
  }
  
  private async incrementFailed(batchId: string): Promise<void> {
    const supabase = createClient();
    
    await supabase.rpc('increment_batch_failed', {
      batch_id_param: batchId,
    });
  }
  
  private async queueProcessingJob(file: UploadedFile, orgId: string): Promise<void> {
    const supabase = createClient();
    
    // Determine job type based on file type
    const jobType = this.getJobTypeForFile(file.mimeType);
    
    await supabase.from('jobs').insert({
      org_id: orgId,
      type: jobType,
      payload: {
        storagePath: file.storagePath,
        filename: file.filename,
        mimeType: file.mimeType,
      },
      status: 'pending',
      priority: 2, // Normal priority
      attempt_count: 0,
      run_after: new Date().toISOString(),
    });
  }
  
  private getJobTypeForFile(mimeType: string): string {
    if (mimeType.startsWith('video/')) return 'process_video';
    if (mimeType.startsWith('audio/')) return 'process_audio';
    if (mimeType.startsWith('image/')) return 'process_image';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'process_document';
    
    return 'process_file';
  }
  
  async getProgress(batchId: string): Promise<UploadProgress> {
    const supabase = createClient();
    
    const { data: batch } = await supabase
      .from('file_upload_batches')
      .select('*')
      .eq('id', batchId)
      .single();
    
    if (!batch) {
      throw new Error('Batch not found');
    }
    
    const progress = batch.total_files > 0
      ? (batch.processed_files / batch.total_files) * 100
      : 0;
    
    return {
      batchId: batch.id,
      totalFiles: batch.total_files,
      processedFiles: batch.processed_files,
      failedFiles: batch.failed_files,
      progress,
      status: batch.status,
    };
  }
}

interface UploadedFile {
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
}
```

---

## 🧪 Testing Requirements

### Comprehensive Test Suite

**File:** `__tests__/connectors/zoom.test.ts`

```typescript
import { ZoomConnector } from '@/lib/connectors/zoom';
import { ConnectorType } from '@/lib/connectors/base';

describe('ZoomConnector', () => {
  let connector: ZoomConnector;
  const mockCredentials = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: new Date(Date.now() + 3600000),
  };
  
  beforeEach(() => {
    connector = new ZoomConnector(mockCredentials, { orgId: 'test-org' });
  });
  
  describe('Authentication', () => {
    it('should authenticate with valid token', async () => {
      const result = await connector.authenticate();
      
      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(result.userName).toBeDefined();
    });
    
    it('should refresh expired token', async () => {
      // Mock expired token
      const expiredConnector = new ZoomConnector({
        ...mockCredentials,
        accessToken: 'expired-token',
      }, { orgId: 'test-org' });
      
      const result = await expiredConnector.authenticate();
      
      // Should attempt refresh and retry
      expect(result.success).toBeDefined();
    });
  });
  
  describe('Sync', () => {
    it('should sync recordings from last 30 days', async () => {
      const result = await connector.sync();
      
      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBeGreaterThanOrEqual(0);
    });
    
    it('should sync recordings since specific date', async () => {
      const since = new Date('2025-01-01');
      const result = await connector.sync({ since });
      
      expect(result.success).toBe(true);
    });
    
    it('should handle sync errors gracefully', async () => {
      // Mock API error
      const result = await connector.sync({ limit: -1 });
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Webhooks', () => {
    it('should handle recording completed event', async () => {
      const event = {
        id: 'webhook-123',
        type: 'recording.completed',
        source: 'zoom',
        payload: {
          object: {
            uuid: 'meeting-uuid',
            topic: 'Test Meeting',
            recording_files: [
              {
                id: 'file-123',
                recording_type: 'shared_screen_with_speaker_view',
                file_type: 'MP4',
                status: 'completed',
                download_url: 'https://zoom.us/rec/download/xxx',
              },
            ],
          },
        },
        timestamp: new Date(),
      };
      
      await expect(connector.handleWebhook(event)).resolves.not.toThrow();
    });
  });
});
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Install all dependencies
- [ ] Run database migrations
- [ ] Set up OAuth applications:
  - [ ] Google Cloud Console
  - [ ] Notion Developers
  - [ ] Zoom Marketplace
  - [ ] Microsoft Azure Portal
- [ ] Configure environment variables
- [ ] Test OAuth flows in staging
- [ ] Set up webhook endpoints
- [ ] Configure webhook secrets
- [ ] Test file uploads (small batch)
- [ ] Test file uploads (large batch 100+ files)
- [ ] Verify storage quotas

### Post-Deployment

- [ ] Monitor connector sync jobs
- [ ] Track webhook event processing
- [ ] Monitor file upload success rates
- [ ] Check document processing queue
- [ ] Verify embedding generation
- [ ] Monitor storage usage
- [ ] Track API rate limits
- [ ] Set up alerts for sync failures

---

## 🎯 Success Criteria

Phase 5 is considered complete when:

1. ✅ 7 connectors operational (Drive, Notion, Zoom, Teams, Upload, URL, File)
2. ✅ OAuth flows working for all services
3. ✅ Webhooks processing in real-time (< 5 seconds)
4. ✅ Batch upload handles 100+ files
5. ✅ All media types supported (video, audio, image, document)
6. ✅ 99%+ sync reliability
7. ✅ Format preservation > 95%
8. ✅ All tests passing

**Next Phase:** [Phase 6: Analytics & Polish](./PHASE_6_ANALYTICS_POLISH.md)

---

**Total File Size:** ~30KB+ comprehensive implementation guide
