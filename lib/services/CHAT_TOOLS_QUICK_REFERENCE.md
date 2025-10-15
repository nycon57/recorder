# Chat Tools Quick Reference

## 30-Second Setup

```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { chatTools } from '@/lib/services/chat-tools';

const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages,
  tools: chatTools,
  toolContext: { orgId, userId },
  maxSteps: 5,
});

return result.toDataStreamResponse();
```

## Available Tools

| Tool | Use When | Example Query |
|------|----------|---------------|
| `searchRecordings` | User asks about recordings | "Find meetings about pricing" |
| `getDocument` | User wants full document | "Show me document abc-123" |
| `getTranscript` | User needs exact transcript | "Get transcript with timestamps" |
| `getRecordingMetadata` | User asks about recording details | "How long is recording xyz?" |
| `listRecordings` | User wants to browse | "Show my recent recordings" |

## Tool Parameters Cheat Sheet

### searchRecordings
```typescript
{
  query: string,          // Required, max 500 chars
  limit?: number,         // 1-20, default 5
  recordingIds?: string[],// Optional filter
  minRelevance?: number   // 0-1, default 0.7
}
```

### getDocument
```typescript
{
  documentId: string,        // Required UUID
  includeMetadata?: boolean  // Default true
}
```

### getTranscript
```typescript
{
  recordingId: string,       // Required UUID
  includeTimestamps?: boolean, // Default true
  formatTimestamps?: boolean   // Default true
}
```

### getRecordingMetadata
```typescript
{
  recordingId: string,    // Required UUID
  includeStats?: boolean  // Default true
}
```

### listRecordings
```typescript
{
  limit?: number,         // 1-50, default 10
  status?: RecordingStatus,
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'duration',
  sortOrder?: 'asc' | 'desc'
}
```

## Response Format

All tools return:
```typescript
{
  success: boolean,
  data?: any,
  error?: string,
  sources?: SourceCitation[]
}
```

## Common Patterns

### Basic Streaming Chat
```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { chatTools } from '@/lib/services/chat-tools';

const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages: [{ role: 'user', content: 'Search my recordings' }],
  tools: chatTools,
  toolContext: { orgId, userId },
  maxSteps: 5,
});

return result.toDataStreamResponse();
```

### Non-Streaming
```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: google('gemini-2.5-flash'),
  messages,
  tools: chatTools,
  toolContext: { orgId, userId },
});

return successResponse({ response: result.text });
```

### With Quota Checks
```typescript
import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { RateLimiter } from '@/lib/services/quotas/rate-limiter';

// Check rate limit
const rateLimit = await RateLimiter.checkLimit('ai', orgId);
if (!rateLimit.success) return errors.rateLimitExceeded(rateLimit);

// Check quota
const quotaCheck = await QuotaManager.checkQuota(orgId, 'ai');
if (!quotaCheck.allowed) return errors.quotaExceeded(quotaCheck);

// Consume quota
await QuotaManager.consumeQuota(orgId, 'ai');

// Execute
const result = await streamText({ ... });
```

### Track Tool Usage
```typescript
const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages,
  tools: chatTools,
  toolContext: { orgId, userId },
  onFinish: async ({ toolCalls, usage }) => {
    console.log('Tools used:', toolCalls?.map(c => c.toolName));
    console.log('Tokens:', usage.totalTokens);
  },
});
```

### Collect Sources
```typescript
const sources = [];

const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages,
  tools: chatTools,
  toolContext: { orgId, userId },
  onStepFinish: async ({ toolResults }) => {
    toolResults?.forEach(result => {
      if (result.toolName === 'searchRecordings' && result.result.sources) {
        sources.push(...result.result.sources);
      }
    });
  },
});
```

## Recommended System Prompt

```typescript
const SYSTEM_PROMPT = `You are a helpful AI assistant that can search recordings,
retrieve documents, and access transcripts.

When users ask about recordings, use searchRecordings.
When they want full documents, use getDocument.
When they need complete transcripts, use getTranscript.

Always cite sources with timestamps when available.`;
```

## Security Checklist

- [x] All tools receive `{ orgId, userId }` in toolContext
- [x] Database queries filtered by `org_id`
- [x] UUIDs validated with Zod
- [x] No cross-tenant access possible
- [x] Error messages don't expose internals

## Performance Tips

1. **Enable Redis caching** for searchRecordings (~10x faster)
2. **Use streaming** (`streamText`) for better UX
3. **Set appropriate limits** (default 5 for search is good)
4. **Cache at CDN level** for static responses
5. **Monitor token usage** to optimize costs

## Debugging

### Check if Tool Was Called
```typescript
const result = await generateText({ ... });
console.log('Tool calls:', result.toolCalls);
console.log('Tool results:', result.toolResults);
```

### Test Tool Directly
```typescript
const result = await chatTools.searchRecordings.execute(
  { query: 'test', limit: 5 },
  { orgId: 'your-org', userId: 'your-user' }
);
console.log(result);
```

### Enable Logging
```typescript
const result = await streamText({
  model: google('gemini-2.5-flash'),
  messages,
  tools: chatTools,
  toolContext: { orgId, userId },
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'chat-debug',
  },
});
```

## Error Handling

All tools return errors in this format:
```typescript
{
  success: false,
  error: "User-friendly error message"
}
```

The AI will automatically handle errors and inform the user.

## Environment Variables Required

```env
# Required
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# Optional (for caching)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_token
```

## Import Statements

```typescript
// Core
import { streamText, generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { chatTools } from '@/lib/services/chat-tools';

// API utilities
import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';

// Quotas
import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { RateLimiter } from '@/lib/services/quotas/rate-limiter';

// Validation
import { z } from 'zod';
```

## File Locations

- **Tool Definitions**: `/lib/services/chat-tools.ts`
- **Validation Schemas**: `/lib/validations/chat.ts`
- **Integration Examples**: `/lib/services/chat-tools-example.ts`
- **Full Documentation**: `/lib/services/CHAT_TOOLS_README.md`
- **Implementation Summary**: `/CHAT_TOOLS_IMPLEMENTATION_SUMMARY.md`

## Quick Links

- [Full Documentation](./CHAT_TOOLS_README.md)
- [Integration Examples](./chat-tools-example.ts)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [Project Guidelines](../../CLAUDE.md)

## Support

**Issue?** Check in order:
1. Server logs (`console.log` statements)
2. Tool response (`result.toolCalls`, `result.toolResults`)
3. Database (test queries directly in Supabase)
4. Environment variables (all set correctly?)
5. Full documentation (`CHAT_TOOLS_README.md`)

---

**Last Updated**: 2025-10-13
**Version**: 1.0.0
