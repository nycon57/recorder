# Hierarchical Search Implementation - Usage Guide

## Overview

The hierarchical search system implements two-tier retrieval (summary → chunks) to ensure better document diversity in search results. This is Phase 1 of the RAG enhancement project.

## Features

1. **Dual Embedding Generation**: Generates both 1536-dim and 3072-dim embeddings
2. **Two-Tier Search**: First searches summaries, then retrieves chunks from relevant documents
3. **Recency Bias**: Optional time-weighted scoring to prioritize recent content
4. **Multiple Search Modes**: Standard (flat), hierarchical (summary→chunks)
5. **Backward Compatible**: Default to standard mode for existing code

## Implementation Files

- `/lib/services/hierarchical-search.ts` - Core hierarchical search logic
- `/lib/services/vector-search-google.ts` - Updated with mode selection
- `/supabase/migrations/012_phase1_foundation_enhancements.sql` - Database functions

## Usage Examples

### 1. Standard Search (Default)

```typescript
import { vectorSearch } from '@/lib/services/vector-search-google';

// Simple search - uses flat vector search
const results = await vectorSearch('machine learning algorithms', {
  orgId: 'org-uuid',
  limit: 10,
  threshold: 0.7,
});

console.log(`Found ${results.length} results`);
```

### 2. Hierarchical Search

```typescript
import { vectorSearch } from '@/lib/services/vector-search-google';

// Hierarchical search - ensures document diversity
const results = await vectorSearch('explain neural networks', {
  orgId: 'org-uuid',
  searchMode: 'hierarchical',
  topDocuments: 5,          // Retrieve from 5 documents
  chunksPerDocument: 3,     // Get 3 chunks per document
  threshold: 0.7,
  limit: 15,                // Total results = topDocuments * chunksPerDocument
});

// Results will include chunks from multiple documents
console.log(`Found ${results.length} results from ${new Set(results.map(r => r.recordingId)).size} documents`);
```

### 3. Search with Recency Bias

```typescript
import { vectorSearch } from '@/lib/services/vector-search-google';

// Standard search with recency bias
const results = await vectorSearch('latest project updates', {
  orgId: 'org-uuid',
  recencyWeight: 0.3,       // 30% weight on recency
  recencyDecayDays: 30,     // Score decays to 0 after 30 days
  limit: 10,
});

// Recent recordings will score higher
```

### 4. Hierarchical Search + Recency (Combined)

```typescript
import { vectorSearch } from '@/lib/services/vector-search-google';

// Best of both worlds - diverse documents prioritizing recent content
const results = await vectorSearch('team meeting notes', {
  orgId: 'org-uuid',
  searchMode: 'hierarchical',
  topDocuments: 5,
  chunksPerDocument: 2,
  recencyWeight: 0.2,
  recencyDecayDays: 14,
  threshold: 0.7,
});
```

### 5. Direct Hierarchical Search (Advanced)

```typescript
import { hierarchicalSearch, generateDualEmbeddings } from '@/lib/services/hierarchical-search';

// Use hierarchical search directly
const results = await hierarchicalSearch('database optimization techniques', {
  orgId: 'org-uuid',
  topDocuments: 5,
  chunksPerDocument: 3,
  threshold: 0.7,
});

// Access additional metadata
results.forEach((result) => {
  console.log(`Chunk similarity: ${result.similarity}`);
  console.log(`Summary similarity: ${result.summarySimilarity}`);
  console.log(`Document: ${result.recordingTitle}`);
});
```

### 6. Search Within Specific Recording

```typescript
import { hierarchicalSearchRecording } from '@/lib/services/hierarchical-search';

// Search within a single recording using hierarchical approach
const results = await hierarchicalSearchRecording(
  'recording-uuid',
  'specific topic',
  'org-uuid',
  {
    chunksPerDocument: 10,
    threshold: 0.7,
  }
);
```

### 7. Generate Dual Embeddings (Utility)

```typescript
import { generateDualEmbeddings } from '@/lib/services/hierarchical-search';

// Generate embeddings for custom use
const { embedding1536, embedding3072 } = await generateDualEmbeddings(
  'This is my query text'
);

console.log(`1536-dim embedding: ${embedding1536.length} values`);
console.log(`3072-dim embedding: ${embedding3072.length} values`);
```

## API Integration Examples

### REST API Route

```typescript
// app/api/search/route.ts
import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { vectorSearch } from '@/lib/services/vector-search-google';

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const { query, mode, recencyWeight } = await request.json();

  const results = await vectorSearch(query, {
    orgId,
    searchMode: mode || 'standard',
    recencyWeight: recencyWeight || 0,
    limit: 10,
  });

  return successResponse({ results });
});
```

### RAG Chat Integration

```typescript
// lib/services/rag-google.ts
import { vectorSearch } from '@/lib/services/vector-search-google';

async function retrieveContext(query: string, orgId: string) {
  // Use hierarchical search for RAG to ensure diverse context
  const results = await vectorSearch(query, {
    orgId,
    searchMode: 'hierarchical',
    topDocuments: 5,
    chunksPerDocument: 3,
    recencyWeight: 0.1, // Slight recency bias
    threshold: 0.7,
  });

  // Format context for LLM
  const context = results
    .map((r, i) => `[${i + 1}] ${r.recordingTitle}: ${r.chunkText}`)
    .join('\n\n');

  return { context, sources: results };
}
```

## Configuration Options

### SearchOptions Interface

```typescript
interface SearchOptions {
  // Required
  orgId: string;

  // Standard options
  limit?: number;                    // Default: 10
  threshold?: number;                // Default: 0.7 (70% similarity)
  recordingIds?: string[];           // Filter by recordings
  source?: 'transcript' | 'document'; // Filter by source
  dateFrom?: Date;                   // Filter by date range
  dateTo?: Date;

  // Mode selection
  searchMode?: 'standard' | 'hierarchical'; // Default: 'standard'

  // Recency bias (works with both modes)
  recencyWeight?: number;            // Default: 0 (0.0-1.0)
  recencyDecayDays?: number;         // Default: 30

  // Hierarchical mode options
  topDocuments?: number;             // Default: 5
  chunksPerDocument?: number;        // Default: 3
}
```

## Performance Considerations

### 1. Embedding Generation Time

- Standard mode: 1 embedding (~100ms)
- Hierarchical mode: 2 embeddings (~200ms)

**Optimization**: Cache embeddings for frequent queries using `query_cache` table.

### 2. Database Query Performance

- Standard search: Single vector similarity query
- Hierarchical search: Two-step query (summaries first, then chunks)

**Expected latency**:
- Standard: 50-200ms
- Hierarchical: 100-300ms

### 3. Result Quality vs. Speed Trade-offs

```typescript
// Fast but potentially less diverse
await vectorSearch(query, {
  orgId,
  searchMode: 'standard',
  limit: 10,
});

// Slower but more diverse results
await vectorSearch(query, {
  orgId,
  searchMode: 'hierarchical',
  topDocuments: 5,
  chunksPerDocument: 3,
});
```

### 4. Recommended Settings by Use Case

**General Search (UI)**:
```typescript
{
  searchMode: 'hierarchical',
  topDocuments: 5,
  chunksPerDocument: 2,
  recencyWeight: 0.1,
  limit: 10,
}
```

**RAG Context Retrieval**:
```typescript
{
  searchMode: 'hierarchical',
  topDocuments: 5,
  chunksPerDocument: 3,
  threshold: 0.7,
  limit: 15,
}
```

**Real-time Suggestions**:
```typescript
{
  searchMode: 'standard',  // Faster
  limit: 5,
  threshold: 0.75,         // Higher threshold
}
```

**Historical Research**:
```typescript
{
  searchMode: 'hierarchical',
  topDocuments: 10,
  chunksPerDocument: 2,
  recencyWeight: 0,        // No recency bias
  threshold: 0.6,          // Lower threshold for broader results
}
```

## Database Requirements

### Required Tables

1. `recording_summaries` - Stores 3072-dim summary embeddings
2. `transcript_chunks` - Stores 1536-dim chunk embeddings (existing)

### Required Functions

1. `hierarchical_search()` - Two-tier search function
2. `search_chunks_with_recency()` - Time-weighted search

These are created by migration `012_phase1_foundation_enhancements.sql`.

## Testing

### Unit Test Example

```typescript
import { hierarchicalSearch, generateDualEmbeddings } from '@/lib/services/hierarchical-search';

describe('Hierarchical Search', () => {
  it('should generate dual embeddings', async () => {
    const result = await generateDualEmbeddings('test query');
    expect(result.embedding1536).toHaveLength(1536);
    expect(result.embedding3072).toHaveLength(3072);
  });

  it('should return diverse results', async () => {
    const results = await hierarchicalSearch('test query', {
      orgId: 'test-org-id',
      topDocuments: 3,
      chunksPerDocument: 2,
    });

    const uniqueDocuments = new Set(results.map(r => r.recordingId));
    expect(uniqueDocuments.size).toBeGreaterThan(1);
  });
});
```

### Integration Test Example

```typescript
import { vectorSearch } from '@/lib/services/vector-search-google';

describe('Vector Search Modes', () => {
  it('should support standard mode', async () => {
    const results = await vectorSearch('test', {
      orgId: 'test-org',
      searchMode: 'standard',
    });
    expect(results).toBeInstanceOf(Array);
  });

  it('should support hierarchical mode', async () => {
    const results = await vectorSearch('test', {
      orgId: 'test-org',
      searchMode: 'hierarchical',
      topDocuments: 3,
      chunksPerDocument: 2,
    });
    expect(results).toBeInstanceOf(Array);
  });
});
```

## Monitoring and Debugging

### Enable Logging

The implementation includes comprehensive console logging:

```
[Hierarchical Search] Query: "machine learning...", orgId: abc123, topDocuments: 5
[Hierarchical Search] Generated dual embeddings in 187ms
[Hierarchical Search] Database search completed in 124ms
[Hierarchical Search] Returning 15 results from 5 documents
[Hierarchical Search] Document distribution: { "doc1": 3, "doc2": 3, "doc3": 3, ... }
```

### Search Analytics

Log queries to `search_analytics` table:

```typescript
await supabase.from('search_analytics').insert({
  org_id: orgId,
  user_id: userId,
  query: query,
  mode: 'hierarchical',
  results_count: results.length,
  latency_ms: latencyMs,
  top_result_similarity: results[0]?.similarity || null,
});
```

## Troubleshooting

### Issue: No results returned

**Possible causes**:
1. No summaries generated yet → Run summary generation job
2. Threshold too high → Lower to 0.6 or 0.5
3. No matching recordings → Check `orgId` and date filters

**Solution**:
```typescript
// Check if summaries exist
import { getRecordingSummaries } from '@/lib/services/hierarchical-search';
const summaries = await getRecordingSummaries(orgId);
console.log(`Found ${summaries.length} summaries`);
```

### Issue: Slow performance

**Solution**: Add indexes to `recording_summaries`:
```sql
CREATE INDEX IF NOT EXISTS idx_recording_summaries_embedding
ON recording_summaries USING ivfflat (summary_embedding vector_cosine_ops);
```

### Issue: Duplicate results

The implementation includes automatic deduplication, but if you encounter duplicates:

```typescript
const uniqueResults = Array.from(
  new Map(results.map(r => [r.id, r])).values()
);
```

## Migration from Standard Search

### Before (Standard Search)

```typescript
const results = await vectorSearch(query, {
  orgId,
  limit: 10,
});
```

### After (Hierarchical Search)

```typescript
const results = await vectorSearch(query, {
  orgId,
  searchMode: 'hierarchical',  // Add this
  topDocuments: 5,              // Add this
  chunksPerDocument: 2,         // Add this
  limit: 10,
});
```

**Note**: Default mode is 'standard' for backward compatibility.

## Next Steps (Future Phases)

1. **Phase 2**: Agentic search with query decomposition
2. **Phase 3**: Multimodal search (text + visual frames)
3. **Phase 4**: Graph-based retrieval
4. **Phase 5**: Hybrid reranking with BM25

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify database migration has been applied
3. Test with lower threshold values
4. Check `recording_summaries` table has data
