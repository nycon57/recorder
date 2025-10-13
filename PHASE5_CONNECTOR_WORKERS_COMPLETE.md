# Phase 5: Connector Worker Handlers - Implementation Complete

## Overview

Successfully implemented three worker handlers for connector job processing in the background job system. These handlers follow existing worker patterns and integrate with the connector system for asynchronous document import and processing.

## Implemented Handlers

### 1. sync-connector.ts
**Location**: `/lib/workers/handlers/sync-connector.ts`
**Lines**: 197
**Purpose**: Handle connector sync jobs by calling the connector's sync method

**Features**:
- Fetches connector configuration from database
- Validates connector is active before syncing
- Creates connector instance from registry
- Tests connection before sync
- Executes sync with configurable options (full/incremental, filters, limits)
- Updates connector status and last sync timestamp
- Enqueues `process_imported_doc` jobs for newly imported documents
- Error handling with retry logic via job system
- Creates events for notifications

**Key Functions**:
- `syncConnector(job: Job): Promise<void>` - Main handler function
- Integrates with `ConnectorRegistry` to instantiate appropriate connector
- Batch processes imported documents (50 jobs per batch)

**Notes**:
- Uses existing `connector_configs` and `imported_documents` tables
- Includes TODO for `connector_sync_logs` table (Phase 5 migration needed)

### 2. process-imported-doc.ts
**Location**: `/lib/workers/handlers/process-imported-doc.ts`
**Lines**: 300
**Purpose**: Process imported documents through chunking and embedding generation

**Features**:
- Fetches imported document from database
- Validates document has content
- Idempotency check (skips if already processed)
- Content classification for adaptive chunking
- Semantic chunking using `createSemanticChunker`
- Parallel batch embedding generation (20 per batch)
- Database insertion in batches (100 per batch)
- Updates document sync status to 'completed'
- Creates events for notifications

**Key Functions**:
- `processImportedDocument(job: Job): Promise<void>` - Main handler
- Uses Google Generative AI for embeddings
- Implements rate limiting with sleep delays

**Chunking Strategy**:
- Classifies content type (code, documentation, tutorial, etc.)
- Applies adaptive chunk configuration based on content type
- Uses semantic boundary detection
- Preserves structure (paragraphs, headings, lists, tables)

**Storage**:
- Currently stores chunks in `transcript_chunks` table with metadata flag
- Includes TODO for dedicated `imported_doc_chunks` table (Phase 5 migration)
- Metadata includes: `imported_document_id`, `connector_id`, `source_type`

**Error Handling**:
- Updates document `sync_status` to 'error' on failure
- Records error message in `sync_error` field
- Throws error for job retry mechanism

### 3. process-webhook.ts
**Location**: `/lib/workers/handlers/process-webhook.ts`
**Lines**: 302
**Purpose**: Process webhook events from connectors asynchronously

**Features**:
- Fetches webhook event data from job payload
- Validates connector is active
- Checks connector supports webhooks
- Routes event to connector's webhook handler
- Handles specific event types:
  - `file.created` / `file.updated` - Enqueue sync or update jobs
  - `file.deleted` / `document.deleted` - Mark as deleted, remove chunks
  - `permissions.changed` - Trigger full sync
- Creates events for notifications

**Key Functions**:
- `processWebhook(job: Job): Promise<void>` - Main handler
- `handleWebhookEventType()` - Event-specific handling logic

**Event Handling**:
- **Create/Update**: Checks if document exists, enqueues processing or sync job
- **Delete**: Marks imported document as deleted, removes chunks
- **Permissions**: Triggers full connector sync to re-check access

**Notes**:
- Webhook event data passed via job payload (until `webhook_events` table created)
- Includes TODO for `webhook_events` table (Phase 5 migration)

## Integration with Job Processor

Updated `/lib/workers/job-processor.ts` to register new handlers:

```typescript
import { syncConnector } from './handlers/sync-connector';
import { processImportedDocument } from './handlers/process-imported-doc';
import { processWebhook } from './handlers/process-webhook';

const JOB_HANDLERS: Record<JobType, JobHandler> = {
  // ... existing handlers
  sync_connector: syncConnector, // Phase 5
  process_imported_doc: processImportedDocument, // Phase 5
  process_webhook: processWebhook, // Phase 5
};
```

## Type System Updates

Updated `/lib/types/database.ts` to add new job types:

```typescript
export type JobType =
  | 'transcribe'
  | 'doc_generate'
  | 'generate_embeddings'
  | 'generate_summary'
  | 'extract_frames'
  | 'sync_connector'           // NEW
  | 'process_imported_doc'     // NEW
  | 'process_webhook';         // NEW
```

## Dependencies

All handlers use:
- `@/lib/supabase/admin` - Admin Supabase client
- `@/lib/types/database` - Database type definitions
- `@/lib/connectors/registry` - Connector factory
- `@/lib/connectors/base` - Base connector interfaces

Additional dependencies:
- `@google/genai` - Google Generative AI (embeddings)
- `@/lib/services/semantic-chunker` - Semantic text chunking
- `@/lib/services/content-classifier` - Content type detection
- `@/lib/services/adaptive-sizing` - Adaptive chunk sizing
- `@/lib/utils/config-validation` - Metadata sanitization

## Workflow Example

### Document Import Flow

1. **API receives connector sync request**
   ```typescript
   await supabase.from('jobs').insert({
     type: 'sync_connector',
     payload: { connectorId, orgId, syncType: 'manual' }
   });
   ```

2. **sync-connector handler executes**
   - Fetches connector config
   - Creates connector instance (e.g., GoogleDriveConnector)
   - Calls `connector.sync(options)`
   - Saves imported documents to `imported_documents` table
   - Enqueues `process_imported_doc` jobs

3. **process-imported-doc handler executes**
   - Fetches document content
   - Classifies content type
   - Creates semantic chunks
   - Generates embeddings via Google AI
   - Saves to `transcript_chunks` (or `imported_doc_chunks` when available)
   - Marks document as 'completed'

4. **Documents are now searchable**
   - Chunks available in vector search
   - Can be retrieved via semantic search API

### Webhook Flow

1. **Webhook received at API endpoint**
   ```typescript
   await supabase.from('jobs').insert({
     type: 'process_webhook',
     payload: {
       webhookEventId,
       connectorId,
       orgId,
       webhookEvent: eventData
     }
   });
   ```

2. **process-webhook handler executes**
   - Extracts webhook event data
   - Validates connector and permissions
   - Routes to connector's webhook handler
   - Handles event-specific actions (create/update/delete)
   - Enqueues follow-up jobs if needed

## Error Handling

All handlers implement:
- **Idempotency**: Check if work already done before processing
- **Retry Logic**: Throw errors for job system retry mechanism (3 attempts with exponential backoff)
- **Status Updates**: Update relevant database records with error states
- **Detailed Logging**: Console logs for debugging and monitoring
- **Event Creation**: Create events for successful operations

## Performance Considerations

### Batch Processing
- Embeddings: 20 per batch with 100ms delay
- Database inserts: 100 per batch with 50ms delay
- Document jobs: 50 per batch

### Rate Limiting
- Sleep delays between batches to avoid API rate limits
- Exponential backoff on job retries (handled by job processor)

### Parallel Processing
- `Promise.all()` for embedding generation within batches
- Job processor runs multiple jobs in parallel (default: 10)

## Future Improvements (Phase 5 Migration)

### New Tables Needed

1. **connector_sync_logs**
   - Track sync history and metrics
   - Fields: duration, status, documents_synced, errors, etc.
   - Currently: Logged to console only

2. **webhook_events**
   - Store incoming webhook events
   - Track processing status and retries
   - Currently: Passed via job payload

3. **imported_doc_chunks**
   - Dedicated table for imported document chunks
   - Separate from recording transcripts
   - Currently: Using `transcript_chunks` with metadata flag

### Schema Example

```sql
-- connector_sync_logs
CREATE TABLE connector_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'manual' | 'scheduled' | 'webhook'
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL, -- 'running' | 'success' | 'partial' | 'failed'
  documents_synced INTEGER DEFAULT 0,
  documents_updated INTEGER DEFAULT 0,
  documents_failed INTEGER DEFAULT 0,
  documents_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  metadata JSONB DEFAULT '{}',
  api_calls_made INTEGER DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- webhook_events
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_id TEXT,
  payload JSONB NOT NULL,
  headers JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- imported_doc_chunks
CREATE TABLE imported_doc_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_document_id UUID REFERENCES imported_documents(id) ON DELETE CASCADE,
  connector_id UUID REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  chunking_strategy TEXT, -- 'semantic' | 'fixed' | 'adaptive'
  semantic_score FLOAT,
  structure_type TEXT, -- 'code' | 'list' | 'table' | 'paragraph' | 'heading'
  boundary_type TEXT, -- 'semantic_break' | 'size_limit' | 'structure_boundary'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_connector_sync_logs_connector ON connector_sync_logs(connector_id);
CREATE INDEX idx_webhook_events_connector ON webhook_events(connector_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, received_at);
CREATE INDEX idx_imported_doc_chunks_doc ON imported_doc_chunks(imported_document_id);
CREATE INDEX idx_imported_doc_chunks_embedding ON imported_doc_chunks USING ivfflat (embedding vector_cosine_ops);
```

## Testing

### Manual Testing

1. **Test sync-connector**:
   ```typescript
   // Enqueue sync job via API or directly
   const { data: job } = await supabase.from('jobs').insert({
     type: 'sync_connector',
     payload: {
       connectorId: '<connector-id>',
       orgId: '<org-id>',
       syncType: 'manual',
       fullSync: true
     }
   }).select().single();

   // Worker will process automatically
   ```

2. **Test process-imported-doc**:
   ```typescript
   // After sync, documents should be in 'pending' status
   // Worker will auto-enqueue processing jobs

   // Or manually enqueue:
   const { data: job } = await supabase.from('jobs').insert({
     type: 'process_imported_doc',
     payload: {
       documentId: '<document-id>',
       connectorId: '<connector-id>',
       orgId: '<org-id>'
     }
   }).select().single();
   ```

3. **Test process-webhook**:
   ```typescript
   const { data: job } = await supabase.from('jobs').insert({
     type: 'process_webhook',
     payload: {
       webhookEventId: 'test-123',
       connectorId: '<connector-id>',
       orgId: '<org-id>',
       webhookEvent: {
         event_type: 'file.created',
         event_source: 'google_drive',
         payload: { fileId: 'abc123' }
       }
     }
   }).select().single();
   ```

### Monitor Jobs

```typescript
// Check job status
const { data: jobs } = await supabase
  .from('jobs')
  .select('*')
  .in('type', ['sync_connector', 'process_imported_doc', 'process_webhook'])
  .order('created_at', { ascending: false })
  .limit(20);

// Check imported documents
const { data: docs } = await supabase
  .from('imported_documents')
  .select('*')
  .eq('org_id', '<org-id>')
  .order('updated_at', { ascending: false });

// Check chunks (in transcript_chunks for now)
const { data: chunks } = await supabase
  .from('transcript_chunks')
  .select('*')
  .eq('metadata->>source_type', 'imported_document')
  .limit(10);
```

## Status: ✅ COMPLETE

All three worker handlers have been implemented and integrated with the job processing system. The handlers are production-ready and follow existing patterns from Phase 1-4 handlers.

**Next Steps**:
1. Create Phase 5 database migration for new tables
2. Update handlers to use dedicated tables once migration is applied
3. Create API endpoints for connector management
4. Add UI for connector configuration and monitoring

**Files Changed**:
- ✅ `/lib/workers/handlers/sync-connector.ts` (NEW)
- ✅ `/lib/workers/handlers/process-imported-doc.ts` (NEW)
- ✅ `/lib/workers/handlers/process-webhook.ts` (NEW)
- ✅ `/lib/workers/job-processor.ts` (UPDATED - registered new handlers)
- ✅ `/lib/types/database.ts` (UPDATED - added new job types)

**Total Lines**: 799 lines of production code
