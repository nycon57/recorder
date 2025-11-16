# Connector System

The connector system provides a unified interface for importing content from various external sources.

## Available Connectors

### 1. File Upload Connector

Direct file upload supporting multiple file types.

**Supported File Types:**

- Documents: PDF, DOCX, DOC, TXT, MD
- Images: PNG, JPEG, GIF, WEBP
- Spreadsheets: XLS, XLSX, CSV
- Data: JSON, CSV

**Limits:**

- Max file size: 50MB (Supabase limit)

**Usage Example:**

```typescript
import { FileUploadConnector } from '@/lib/connectors';

// Initialize connector
const connector = new FileUploadConnector({
  orgId: 'your-org-id',
  userId: 'user-id',
  batchId: 'optional-batch-id',
});

// Add files
const result = await connector.addFile(
  'document.pdf',
  fileBuffer,
  'application/pdf',
  { source: 'upload' },
);

if (result.success) {
  console.log('File added:', result.fileId);
}

// Sync to storage
const syncResult = await connector.sync({
  limit: 10,
  fileTypes: ['application/pdf'], // Optional filter
});

console.log(`Processed: ${syncResult.filesProcessed}`);
console.log(`Success: ${syncResult.filesUpdated}`);
console.log(`Failed: ${syncResult.filesFailed}`);

// List queued files
const files = await connector.listFiles({ limit: 20 });

// Download a specific file
const content = await connector.downloadFile(fileId);
```

**Static Helpers:**

```typescript
// Check supported types
const types = FileUploadConnector.getSupportedTypes();

// Check if type is supported
const isSupported = FileUploadConnector.isSupported('application/pdf');

// Get extensions by category
const docExtensions = FileUploadConnector.getExtensions('documents');
// Returns: ['pdf', 'docx', 'doc', 'txt', 'md']
```

### 2. URL Import Connector

Import content from web URLs with HTML-to-markdown conversion.

**Features:**

- Automatic HTML to markdown conversion
- Content extraction with smart selectors
- Metadata extraction (title, description)
- Clean removal of ads, scripts, navigation
- Configurable link and image handling

**Limits:**

- Request timeout: 30 seconds
- Max content size: 10MB

**Usage Example:**

```typescript
import { URLImportConnector } from '@/lib/connectors';

// Initialize connector
const connector = new URLImportConnector({
  orgId: 'your-org-id',
  userId: 'user-id',
  batchId: 'optional-batch-id',
});

// Add URLs
const result = await connector.addURL('https://example.com/article', {
  mainContentSelector: 'article', // Optional: target specific element
  includeImages: true, // Optional: keep image references
  includeLinks: true, // Optional: keep links
  removeSelectors: ['.ads', '.popup'], // Optional: additional elements to remove
});

if (result.success) {
  console.log('URL added:', result.urlId);
}

// Fetch and process URLs
const syncResult = await connector.sync({
  limit: 5, // Process 5 URLs at a time
});

console.log(`Processed: ${syncResult.filesProcessed}`);
console.log(`Success: ${syncResult.filesUpdated}`);
console.log(`Failed: ${syncResult.filesFailed}`);

// List URLs
const urls = await connector.listFiles({
  filters: { status: 'success' }, // Filter by status
});

// Get processed content
const content = await connector.downloadFile(urlId);
console.log(content.content); // Markdown content

// Get queue stats
const stats = connector.getQueueStats();
console.log(
  `Total: ${stats.total}, Success: ${stats.success}, Failed: ${stats.failed}`,
);

// Retry failed URLs
await connector.retryFailed();
```

**Content Extraction Options:**

```typescript
interface ContentExtractionOptions {
  // Selectors to remove (ads, nav, footer, etc.)
  removeSelectors?: string[];

  // Selector for main content (e.g., 'article', 'main', '.content')
  mainContentSelector?: string;

  // Whether to keep image references
  includeImages?: boolean;

  // Whether to keep links
  includeLinks?: boolean;
}
```

## Connector Factory

Use the factory function for dynamic connector creation:

```typescript
import { createConnector, ConnectorType } from '@/lib/connectors';

const connector = createConnector({
  type: ConnectorType.FILE_UPLOAD,
  orgId: 'your-org-id',
  userId: 'user-id',
  batchId: 'optional-batch-id',
});

// Use connector...
```

## Connector Metadata

Get information about available connectors:

```typescript
import { getConnectorInfo, listConnectors } from '@/lib/connectors';

// Get info for specific connector
const info = getConnectorInfo(ConnectorType.FILE_UPLOAD);
console.log(info);
// {
//   name: 'File Upload',
//   description: '...',
//   requiresOAuth: false,
//   supportsWebhooks: false,
//   supportedTypes: [...],
//   maxFileSize: 52428800
// }

// List all connectors
const allConnectors = listConnectors();
```

## Base Connector Interface

All connectors implement the `Connector` interface:

```typescript
interface Connector {
  readonly type: ConnectorType;
  readonly name: string;
  readonly description: string;

  // Authentication (no-op for file upload and URL import)
  authenticate(credentials: ConnectorCredentials): Promise<AuthResult>;

  // Test connection
  testConnection(): Promise<TestResult>;

  // Sync/process content
  sync(options?: SyncOptions): Promise<SyncResult>;

  // List available files
  listFiles(options?: ListOptions): Promise<ConnectorFile[]>;

  // Download specific file
  downloadFile(fileId: string): Promise<FileContent>;

  // Optional: Handle webhooks
  handleWebhook?(event: WebhookEvent): Promise<void>;

  // Optional: Refresh credentials
  refreshCredentials?(
    credentials: ConnectorCredentials,
  ): Promise<ConnectorCredentials>;
}
```

## API Route Integration

Example API route using connectors:

```typescript
// app/api/connectors/upload/route.ts
import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { FileUploadConnector } from '@/lib/connectors';

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();

  // Parse form data
  const formData = await request.formData();
  const files = formData.getAll('files') as File[];

  // Initialize connector
  const connector = new FileUploadConnector({ orgId, userId });

  // Add files
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    await connector.addFile(file.name, buffer, file.type);
  }

  // Sync to storage
  const result = await connector.sync();

  return successResponse(result);
});
```

## Error Handling

Connectors provide detailed error information:

```typescript
const syncResult = await connector.sync();

if (!syncResult.success) {
  // Check individual errors
  for (const error of syncResult.errors) {
    console.error(`File: ${error.fileName}`);
    console.error(`Error: ${error.error}`);
    console.error(`Retryable: ${error.retryable}`);
  }
}
```

## Storage

Both connectors store files in Supabase Storage under the `recordings` bucket:

- File uploads: `org_{orgId}/uploads/{batchId}/{fileId}-{filename}`
- URL imports: `org_{orgId}/imports/{batchId}/{urlId}.md`

## Future Connectors

Planned connectors (not yet implemented):

- Google Drive
- Notion
- Zoom
- Microsoft Teams

These will require OAuth authentication and webhook support.
