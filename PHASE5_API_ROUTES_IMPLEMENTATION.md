# Phase 5: Connector System API Routes Implementation

**Status**: ✅ Complete
**Date**: 2025-10-13
**Total Routes**: 15 API endpoints

## Overview

Comprehensive API routes implementation for the Phase 5 connector system, following Next.js 15 App Router patterns and project conventions from CLAUDE.md.

## Implementation Summary

### 1. Validation Schemas (`lib/validations/api.ts`)

Added comprehensive Zod schemas for all connector operations:

**Connector CRUD Schemas**:
- `createConnectorSchema` - Create new connector with type, credentials, settings
- `updateConnectorSchema` - Update connector properties
- `syncConnectorSchema` - Trigger manual sync with options
- `listConnectorDocumentsSchema` - Paginated document listing

**OAuth Schemas**:
- `oauthCallbackSchema` - Handle OAuth callbacks with code, state, error handling

**Webhook Schemas**:
- `zoomWebhookSchema` - Zoom webhook event validation
- `teamsWebhookSchema` - Microsoft Teams webhook validation
- `driveWebhookSchema` - Google Drive push notification validation

**File Upload Schemas**:
- `singleFileUploadSchema` - Single file upload validation
- `batchUploadSchema` - Batch upload with up to 100 files

### 2. Main Connector Routes

#### `/api/connectors/route.ts`
- **GET**: List all connectors for organization
  - Query params: `type`, `isActive`, `limit`, `offset`
  - Returns: Array of connectors with stats

- **POST**: Create new connector
  - Validates credentials and tests connection
  - Returns: Created connector with ID

#### `/api/connectors/[id]/route.ts`
- **GET**: Get connector details with statistics
  - Returns: Connector config + document counts by status

- **PUT**: Update connector configuration
  - Re-validates credentials if updated
  - Returns: Updated connector

- **DELETE**: Delete connector
  - Query param: `deleteDocuments` (optional)
  - Cascade deletes imported documents if requested

### 3. Connector Action Routes

#### `/api/connectors/[id]/sync/route.ts`
- **POST**: Trigger manual synchronization
  - Body: `fullSync`, `since`, `limit`, `fileTypes`, `paths`, `filters`
  - Validates connector is active and not already syncing
  - Returns: Sync results with counts

#### `/api/connectors/[id]/test/route.ts`
- **POST**: Test connector connection
  - No body required
  - Returns: Connection test results

#### `/api/connectors/[id]/disable/route.ts`
- **POST**: Disable connector (soft delete)
  - Keeps data but stops syncing
  - Returns: Success confirmation

#### `/api/connectors/[id]/documents/route.ts`
- **GET**: List imported documents
  - Query params: `page`, `limit`, `status`, `search`
  - Returns: Paginated documents with metadata

### 4. OAuth Authentication Routes

All OAuth routes follow the same pattern:
1. Receive authorization code and state
2. Verify state matches expected org
3. Exchange code for access tokens
4. Update existing connector or create new one
5. Redirect to application with success status

#### `/api/connectors/auth/google/route.ts`
- **GET**: Handle Google OAuth callback
- Exchanges code for Google Drive access tokens
- Supports both token refresh and new connector creation

#### `/api/connectors/auth/notion/route.ts`
- **GET**: Handle Notion OAuth callback
- Stores workspace ID and bot ID
- Names connector after workspace

#### `/api/connectors/auth/zoom/route.ts`
- **GET**: Handle Zoom OAuth callback
- Stores access and refresh tokens
- Includes scope information

#### `/api/connectors/auth/teams/route.ts`
- **GET**: Handle Microsoft Teams OAuth callback
- Uses Microsoft Graph API tokens
- Supports tenant-specific or common endpoint

### 5. Webhook Receiver Routes

#### `/api/connectors/webhooks/zoom/route.ts`
- **POST**: Receive Zoom webhook events
- Verifies HMAC signature using `x-zm-signature` header
- Handles URL validation challenge
- Supports events:
  - `recording.completed` - Queue sync job
  - `recording.trashed/deleted` - Mark documents as deleted
- Stores all events in `connector_webhook_events` table

#### `/api/connectors/webhooks/teams/route.ts`
- **POST**: Receive Microsoft Teams/Graph notifications
- **Validation GET**: Responds to Microsoft's validation token
- Handles batch notifications
- Supports change types:
  - `created/updated` - Queue sync job
  - `deleted` - Mark documents as deleted
- Maps subscription ID to connector

#### `/api/connectors/webhooks/drive/route.ts`
- **POST**: Receive Google Drive push notifications
- **GET**: Webhook verification endpoint
- Uses channel ID to identify connector
- Supports resource states:
  - `add/update/change` - Queue incremental sync
  - `trash/remove` - Check for deleted files
- Debounces sync jobs by 5 seconds

### 6. File Upload Routes

#### `/api/connectors/upload/route.ts`
- **POST**: Upload single file
- Validates file size (max 100MB)
- Generates SHA-256 hash for deduplication
- Uploads to Supabase Storage bucket `imported-files`
- Creates `imported_documents` record
- Queues `process_imported_document` job
- Auto-creates `file_upload` connector if needed

#### `/api/connectors/upload/batch/route.ts`
- **POST**: Upload multiple files (max 100, 500MB total)
- Creates `file_upload_batches` record
- Processes files in sequence
- Handles individual file failures gracefully
- Returns detailed results with success/failure counts
- Updates batch progress tracking

## Key Features

### Security
- All routes use `requireOrg()` for authentication
- OAuth routes verify state matches organization
- Webhook routes verify signatures:
  - Zoom: HMAC SHA-256 signature
  - Teams: Client state validation
  - Drive: Channel ID matching
- File uploads check for duplicates using content hash

### Error Handling
- Comprehensive error responses using `errors.*` helpers
- Validation errors return detailed messages
- Graceful degradation for missing connectors
- Transaction-safe database operations

### Integration with Existing Systems
- Uses `apiHandler` wrapper for consistent error handling
- Integrates with `ConnectorManager` service layer
- Creates background jobs in `jobs` table
- Follows RLS policies via `supabaseAdmin`
- Maintains audit trail in sync logs

### Performance Optimizations
- Debounces webhook-triggered syncs
- Batches webhook notifications
- Paginates document listings
- Implements incremental sync
- Parallel file processing in batches

## Database Tables Used

- `connector_configs` - Connector configuration and credentials
- `imported_documents` - Imported files and their status
- `connector_sync_logs` - Sync operation history
- `connector_webhook_events` - Raw webhook events
- `file_upload_batches` - Batch upload tracking
- `jobs` - Background processing queue

## Background Jobs Created

1. `connector_sync_file` - Sync individual file from webhook
2. `connector_incremental_sync` - Incremental sync from webhook
3. `process_imported_document` - Process uploaded file

## Environment Variables Required

```bash
# Google Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Notion
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=

# Zoom
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_WEBHOOK_SECRET_TOKEN=

# Microsoft Teams
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=

# Application
NEXT_PUBLIC_APP_URL=
```

## API Route Summary

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/connectors` | GET | List connectors | Org |
| `/api/connectors` | POST | Create connector | Org |
| `/api/connectors/[id]` | GET | Get connector | Org |
| `/api/connectors/[id]` | PUT | Update connector | Org |
| `/api/connectors/[id]` | DELETE | Delete connector | Org |
| `/api/connectors/[id]/sync` | POST | Trigger sync | Org |
| `/api/connectors/[id]/test` | POST | Test connection | Org |
| `/api/connectors/[id]/disable` | POST | Disable connector | Org |
| `/api/connectors/[id]/documents` | GET | List documents | Org |
| `/api/connectors/auth/google` | GET | Google OAuth | User |
| `/api/connectors/auth/notion` | GET | Notion OAuth | User |
| `/api/connectors/auth/zoom` | GET | Zoom OAuth | User |
| `/api/connectors/auth/teams` | GET | Teams OAuth | User |
| `/api/connectors/webhooks/zoom` | POST | Zoom webhook | Public |
| `/api/connectors/webhooks/teams` | POST/GET | Teams webhook | Public |
| `/api/connectors/webhooks/drive` | POST/GET | Drive webhook | Public |
| `/api/connectors/upload` | POST | Single upload | Org |
| `/api/connectors/upload/batch` | POST | Batch upload | Org |

**Total**: 15 unique routes (18 endpoints including HTTP methods)

## Testing Recommendations

### Unit Tests
- Zod schema validation
- Error handling paths
- OAuth state generation/verification
- Webhook signature verification

### Integration Tests
- Full OAuth flow with test credentials
- Sync operation with mock connector
- File upload and processing
- Webhook event handling

### Security Tests
- Unauthorized access attempts
- Invalid signatures
- Cross-organization access
- Token expiration handling

## Next Steps

1. **Worker Handlers**: Implement background job handlers
   - `connector_sync_file`
   - `connector_incremental_sync`
   - `process_imported_document`

2. **Frontend Components**: Build UI for connector management
   - Connector list and cards
   - OAuth connection buttons
   - Sync status indicators
   - Document browser

3. **Webhook Setup**: Implement webhook registration
   - Google Drive watch API
   - Microsoft Graph subscriptions
   - Zoom webhook configuration

4. **Rate Limiting**: Add rate limits to public endpoints
   - Webhook receivers
   - File upload routes

5. **Monitoring**: Add observability
   - Sync success/failure rates
   - Webhook processing times
   - File upload metrics

## Files Created

### Validation Schemas
- `lib/validations/api.ts` (updated)

### Main Routes
1. `app/api/connectors/route.ts`
2. `app/api/connectors/[id]/route.ts`

### Action Routes
3. `app/api/connectors/[id]/sync/route.ts`
4. `app/api/connectors/[id]/test/route.ts`
5. `app/api/connectors/[id]/disable/route.ts`
6. `app/api/connectors/[id]/documents/route.ts`

### OAuth Routes
7. `app/api/connectors/auth/google/route.ts`
8. `app/api/connectors/auth/notion/route.ts`
9. `app/api/connectors/auth/zoom/route.ts`
10. `app/api/connectors/auth/teams/route.ts`

### Webhook Routes
11. `app/api/connectors/webhooks/zoom/route.ts`
12. `app/api/connectors/webhooks/teams/route.ts`
13. `app/api/connectors/webhooks/drive/route.ts`

### Upload Routes
14. `app/api/connectors/upload/route.ts`
15. `app/api/connectors/upload/batch/route.ts`

## Conclusion

All 15 API routes have been successfully implemented following the project's established patterns. The routes provide comprehensive functionality for managing connectors, handling OAuth flows, receiving webhooks, and uploading files. Each route includes proper authentication, validation, error handling, and integration with the connector manager service.
