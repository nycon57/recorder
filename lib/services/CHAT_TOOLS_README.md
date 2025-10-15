# Chat Tools Documentation

## Overview

The chat tools system provides AI assistant capabilities using the Vercel AI SDK. The tools enable the AI to:

1. **Search recordings** using RAG-powered semantic search
2. **Retrieve documents** with full content and metadata
3. **Get transcripts** with timestamps
4. **Fetch recording metadata** including status and stats
5. **List recordings** with filtering and sorting

## File Structure

```
lib/
├── services/
│   ├── chat-tools.ts              # Tool definitions using Vercel AI SDK
│   ├── chat-rag-integration.ts    # RAG context injection
│   └── CHAT_TOOLS_README.md       # This file
└── validations/
    └── chat.ts                    # Zod schemas for tool inputs
```

## Quick Start

### 1. Basic Integration with Streaming Chat API

```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { chatTools } from '@/lib/services/chat-tools';
import { requireOrg } from '@/lib/utils/api';

export const POST = async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const { messages } = await request.json();

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages,
    tools: chatTools,
    // Pass context to tools
    toolContext: { orgId, userId },
    maxSteps: 5, // Allow multi-step tool usage
    system: `You are a helpful AI assistant that can search through recordings,
             retrieve documents, and access transcripts to answer user questions.
             When the user asks about their recordings, use the searchRecordings tool.
             When they want to see a full document, use getDocument.
             When they need a complete transcript, use getTranscript.
             Always cite sources when using information from recordings.`,
  });

  return result.toDataStreamResponse();
};
```

### 2. Non-Streaming Integration

```typescript
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { chatTools } from '@/lib/services/chat-tools';
import { requireOrg, successResponse } from '@/lib/utils/api';

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const { message, conversationId } = await parseBody(request, chatSchema);

  const { text, toolCalls, toolResults } = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content: message }],
    tools: chatTools,
    toolContext: { orgId, userId },
    maxSteps: 5,
  });

  return successResponse({
    conversationId,
    response: text,
    toolCalls,
    toolResults,
  });
});
```

## Tool Definitions

### 1. searchRecordings

**Purpose**: Semantic search across recordings and transcripts using RAG.

**Input Schema**:
```typescript
{
  query: string;              // Search query (required, max 500 chars)
  limit?: number;             // Max results (1-20, default: 5)
  recordingIds?: string[];    // Filter to specific recordings (UUIDs)
  includeTranscripts?: boolean; // Include transcript chunks (default: true)
  includeDocuments?: boolean;   // Include document chunks (default: true)
  minRelevance?: number;      // Minimum score 0-1 (default: 0.7)
}
```

**Response Format**:
```typescript
{
  success: boolean;
  data: {
    message: string;
    results: Array<{
      rank: number;
      title: string;
      excerpt: string;
      relevanceScore: number;  // 0-100
      type: 'transcript' | 'document';
      recordingId?: string;
      timestamp?: string;      // Formatted as "MM:SS"
      url: string;
      hasVisualContext: boolean;
    }>;
    searchMetadata: {
      searchMode: 'vector' | 'hierarchical' | 'agentic';
      searchTimeMs: number;
      cacheHit: boolean;
    };
  };
  sources: SourceCitation[];  // For UI display
}
```

**Example Usage**:
```typescript
// The AI will automatically call this when user asks:
// "What did we discuss about pricing?"
// "Find recordings about project Alpha"
// "Search for meetings with John"
```

**Security**: Automatically filtered by `orgId` - only returns results from user's organization.

---

### 2. getDocument

**Purpose**: Retrieve full document content by ID.

**Input Schema**:
```typescript
{
  documentId: string;         // UUID (required)
  includeMetadata?: boolean;  // Include metadata (default: true)
}
```

**Response Format**:
```typescript
{
  success: boolean;
  data: {
    documentId: string;
    content: string;          // Full markdown content
    summary: string | null;
    recordingTitle: string;
    status: 'generating' | 'generated' | 'edited' | 'error';
    metadata?: {
      recordingId: string;
      version: string;
      model: string;
      duration: string;       // Formatted (e.g., "15m 30s")
      createdAt: string;
      updatedAt: string;
    };
  };
}
```

**Example Usage**:
```typescript
// The AI will call this when user asks:
// "Show me the full document for recording X"
// "I need to see the complete summary"
// "Can you read the document with ID abc-123?"
```

**Security**: Verifies `org_id` matches user's organization.

---

### 3. getTranscript

**Purpose**: Get full transcript with word-level timestamps.

**Input Schema**:
```typescript
{
  recordingId: string;        // UUID (required)
  includeTimestamps?: boolean; // Include timestamps (default: true)
  formatTimestamps?: boolean;  // Format as MM:SS (default: true)
}
```

**Response Format**:
```typescript
{
  success: boolean;
  data: {
    recordingId: string;
    recordingTitle: string;
    transcript: string;        // Full transcript text with timestamps
    language: string;          // e.g., "en"
    confidence?: number;       // 0-100
    provider: string | null;   // e.g., "openai"
    duration?: string;
    status: RecordingStatus;
    createdAt: string;
  };
}
```

**Transcript Format** (with timestamps):
```
[0:00] Welcome to today's meeting about the Q4 roadmap.

[0:30] First, let's discuss the features we want to ship in December.

[1:15] The analytics dashboard is our top priority for this quarter.
```

**Example Usage**:
```typescript
// The AI will call this when user asks:
// "Show me the full transcript for recording X"
// "I need the exact words from that meeting"
// "Can you get the transcript with timestamps?"
```

**Security**: Verifies recording belongs to user's organization via join.

---

### 4. getRecordingMetadata

**Purpose**: Get metadata about a recording (title, duration, status, stats).

**Input Schema**:
```typescript
{
  recordingId: string;        // UUID (required)
  includeStats?: boolean;     // Include statistics (default: true)
}
```

**Response Format**:
```typescript
{
  success: boolean;
  data: {
    recordingId: string;
    title: string;
    description: string | null;
    status: RecordingStatus;
    duration?: string;         // Formatted
    thumbnailUrl: string | null;
    createdAt: string;
    lastUpdated: string;
    completedAt?: string;
    stats?: {
      durationSeconds: number;
      wordCount?: number;
      chunks?: number;
      documentStatus?: string;
      documentVersion?: string;
    };
  };
}
```

**Example Usage**:
```typescript
// The AI will call this when user asks:
// "What's the status of recording X?"
// "How long is that meeting recording?"
// "When was this recording created?"
```

**Security**: Filtered by `org_id`.

---

### 5. listRecordings

**Purpose**: List recent recordings with filtering and sorting.

**Input Schema**:
```typescript
{
  limit?: number;             // 1-50, default: 10
  status?: RecordingStatus;   // Filter by status
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'duration';
  sortOrder?: 'asc' | 'desc'; // Default: 'desc'
}
```

**Response Format**:
```typescript
{
  success: boolean;
  data: {
    recordings: Array<{
      id: string;
      title: string;
      description: string | null;
      status: RecordingStatus;
      duration?: string;
      thumbnailUrl: string | null;
      createdAt: string;
      lastUpdated: string;
    }>;
    total: number;
    limit: number;
    sortedBy: string;
  };
}
```

**Example Usage**:
```typescript
// The AI will call this when user asks:
// "Show me my recent recordings"
// "List all completed recordings"
// "What recordings do I have from today?"
```

**Security**: Filtered by `org_id`.

---

## Error Handling

All tools follow consistent error handling:

```typescript
{
  success: false,
  error: "User-friendly error message"
}
```

### Common Errors

- **Not found**: "Recording not found or you do not have permission to access it"
- **Access denied**: "You do not have permission to access this [resource]"
- **Invalid input**: Zod validation errors with helpful messages
- **Unexpected errors**: Logged to console, generic message returned to user

### Error Handling in Chat Flow

```typescript
const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages,
  tools: chatTools,
  toolContext: { orgId, userId },
  onError: (error) => {
    console.error('[Chat] Tool execution error:', error);
    // Error is automatically handled by Vercel AI SDK
    // AI will inform user about the error
  },
});
```

## Security Considerations

### Organization Isolation

All tools enforce organization-level data isolation:

1. **orgId passed via toolContext**: Every tool receives `orgId` from authenticated context
2. **Database queries filtered**: All Supabase queries include `.eq('org_id', orgId)`
3. **Join verification**: Relations (e.g., recording → document) verified via joins
4. **No cross-tenant access**: Impossible to access another org's data

### Input Validation

- **Zod schemas**: All inputs validated with comprehensive Zod schemas
- **UUID validation**: IDs validated as proper UUIDs
- **String limits**: Max lengths enforced (queries, descriptions, etc.)
- **Type safety**: TypeScript ensures correct types throughout

### Output Sanitization

- **No sensitive data**: Tools never return credentials, API keys, or internal IDs
- **User-friendly errors**: Error messages don't expose internal details
- **Consistent format**: All responses follow standard format

## Performance Optimization

### Caching

**RAG Search Caching** (Redis):
- Enabled by default in `searchRecordings`
- 1-hour TTL for search results
- Cache key based on query + orgId + options
- Automatic cache hits reduce search time from ~500ms to ~50ms

**Disable caching** (for real-time requirements):
```typescript
const ragContext = await injectRAGContext(query, orgId, {
  enableCache: false, // Bypass cache
});
```

### Database Optimization

1. **Indexed queries**: All org_id and recording_id queries use database indexes
2. **Selective fields**: Only fetch required fields (avoid `SELECT *`)
3. **Single queries**: Use joins instead of multiple queries
4. **Count optimization**: Use `count: 'exact', head: true` for counts only

### Token Management

Tools are designed to be token-efficient:

- **Excerpt truncation**: Search results limited to 200 chars
- **Formatted output**: Timestamps, durations formatted for readability
- **Optional metadata**: Stats and metadata only included when requested
- **Chunked transcripts**: Long transcripts broken into time-stamped chunks

## Testing

### Unit Tests

```typescript
import { chatTools } from '@/lib/services/chat-tools';
import { createClient } from '@/lib/supabase/server';

describe('Chat Tools', () => {
  it('should search recordings with RAG', async () => {
    const result = await chatTools.searchRecordings.execute(
      { query: 'test query', limit: 5 },
      { orgId: 'test-org-id', userId: 'test-user-id' }
    );

    expect(result.success).toBe(true);
    expect(result.data.results).toBeDefined();
  });

  // More tests...
});
```

### Integration Testing

Test with actual Vercel AI SDK:

```typescript
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { chatTools } from '@/lib/services/chat-tools';

const result = await generateText({
  model: google('gemini-2.5-flash'),
  messages: [
    { role: 'user', content: 'Search for recordings about pricing' }
  ],
  tools: chatTools,
  toolContext: { orgId: 'test-org', userId: 'test-user' },
});

console.log(result.text);
console.log(result.toolCalls);
```

## Advanced Usage

### Multi-Step Reasoning

Allow AI to chain multiple tool calls:

```typescript
const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages,
  tools: chatTools,
  toolContext: { orgId, userId },
  maxSteps: 10, // Allow up to 10 tool invocations
  system: `You can use multiple tools to answer complex questions.
           For example:
           1. Search for relevant recordings
           2. Get the full transcript if needed
           3. Fetch document details for more context
           Always explain your reasoning.`,
});
```

**Example conversation**:
```
User: "What did we discuss about pricing in yesterday's meeting?"

AI (Step 1): [Calls searchRecordings with query="pricing yesterday"]
AI (Step 2): [Calls getTranscript for most relevant recording]
AI (Response): "In yesterday's meeting about pricing, you discussed..."
```

### Custom System Prompts

```typescript
const systemPrompt = `You are an AI assistant for a knowledge management platform.

Your capabilities:
- Search through recordings and transcripts (use searchRecordings)
- Retrieve full documents (use getDocument)
- Get complete transcripts (use getTranscript)
- Check recording metadata (use getRecordingMetadata)
- Browse recordings (use listRecordings)

Guidelines:
1. Always cite sources with timestamps when available
2. If information is unclear, get the full transcript
3. Summarize search results before presenting them
4. Suggest related recordings if available
5. Be conversational and helpful

When you use tools, explain what you're searching for.`;

const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages,
  tools: chatTools,
  toolContext: { orgId, userId },
  system: systemPrompt,
});
```

### Rate Limiting Integration

```typescript
import { RateLimiter } from '@/lib/services/quotas/rate-limiter';
import { QuotaManager } from '@/lib/services/quotas/quota-manager';

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();

  // Check rate limit
  const rateLimit = await RateLimiter.checkLimit('ai', orgId);
  if (!rateLimit.success) {
    return errors.rateLimitExceeded(rateLimit);
  }

  // Check quota
  const quotaCheck = await QuotaManager.checkQuota(orgId, 'ai');
  if (!quotaCheck.allowed) {
    return errors.quotaExceeded(quotaCheck);
  }

  // Consume quota
  await QuotaManager.consumeQuota(orgId, 'ai');

  // Execute AI request
  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages,
    tools: chatTools,
    toolContext: { orgId, userId },
  });

  return result.toDataStreamResponse();
});
```

## Troubleshooting

### Tool Not Being Called

**Problem**: AI doesn't use tools even when appropriate.

**Solutions**:
1. **Improve system prompt**: Be explicit about when to use each tool
2. **Increase maxSteps**: Default is 5, increase if needed
3. **Check tool descriptions**: Make sure descriptions are clear
4. **Use examples**: Provide few-shot examples in system prompt

### Slow Response Times

**Problem**: Chat responses are slow.

**Solutions**:
1. **Enable caching**: Ensure Redis cache is configured
2. **Reduce limit**: Lower `limit` parameter in searchRecordings
3. **Optimize queries**: Review database query performance
4. **Stream responses**: Use `streamText` instead of `generateText`

### Permission Errors

**Problem**: Tools return permission errors.

**Solutions**:
1. **Verify orgId**: Ensure `toolContext.orgId` is correct
2. **Check RLS policies**: Verify Supabase RLS policies are correct
3. **Test with Supabase directly**: Query tables directly to confirm access
4. **Check logs**: Look for detailed error messages in server logs

## Migration Guide

### From Legacy Chat API

If migrating from a custom chat implementation:

**Before** (custom implementation):
```typescript
// Old: Custom search function
const results = await customSearch(query, orgId);
const response = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: `Context: ${JSON.stringify(results)}` },
    { role: 'user', content: query }
  ]
});
```

**After** (Vercel AI SDK with tools):
```typescript
// New: Automatic tool usage
const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages: [{ role: 'user', content: query }],
  tools: chatTools,
  toolContext: { orgId, userId },
});
```

**Benefits**:
- AI decides when to search automatically
- Multi-step reasoning supported
- Better error handling
- Streaming support built-in
- Source citations automatic

## Additional Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Google AI Models](https://ai.google.dev/gemini-api/docs/models/gemini)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Project CLAUDE.md](../../CLAUDE.md) - Project-specific guidelines

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Review Supabase logs for database errors
3. Test tools directly using unit tests
4. Verify environment variables are configured
5. Consult this documentation for examples

---

**Version**: 1.0.0
**Last Updated**: 2025-10-13
**Author**: Claude Code
