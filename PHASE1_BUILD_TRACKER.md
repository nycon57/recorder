# Phase 1: Foundation Enhancements - Build Tracker

**Goal**: Improve core retrieval quality to match Ragie's baseline
**Timeline**: Week 1-2 (40 hours)
**Status**: 🚧 In Progress

---

## Overview

This phase adds three critical capabilities:
1. **Multi-Layer Indexing** - Document summaries + hierarchical search
2. **LLM Re-ranking** - Cohere-based result refinement
3. **Recency Bias** - Time-weighted scoring

---

## Progress Tracking

### ✅ Completed Tasks

- [x] **Database Migration** (012_phase1_foundation_enhancements.sql)
  - New tables: `recording_summaries`, `video_frames`, `connector_configs`, `imported_documents`, `search_analytics`, `query_cache`
  - New job types: `generate_summary`, `extract_frames`, `sync_connector`
  - New functions: `search_chunks_with_recency()`, `hierarchical_search()`
  - RLS policies for all new tables
  - Indexes for performance optimization

- [x] **Build Tracker Document** (this file)

- [x] **Document Summarization System** ✨
  - Created `lib/services/summarization.ts` - Gemini-based summarization service
  - Created `lib/workers/handlers/generate-summary.ts` - Job handler with 3072-dim embeddings
  - Updated `lib/workers/job-processor.ts` - Registered summary handler
  - Updated `lib/workers/handlers/embeddings-google.ts` - Auto-enqueue summary jobs
  - **Pipeline**: Recording → Transcribe → Document → Embeddings → **Summary (NEW)**

- [x] **LLM Re-ranking Service** 🎯
  - Created `lib/services/reranking.ts` - Cohere integration with fallback
  - Added `cohere-ai@7.19.0` to dependencies
  - Updated `app/api/search/route.ts` - Added `rerank` parameter
  - Updated `app/api/chat/route.ts` - Added `rerank` parameter
  - Updated `app/api/chat/stream/route.ts` - Added `rerank` parameter
  - Updated `lib/services/rag-google.ts` - Integrated re-ranking
  - Updated `lib/services/vector-search-google.ts` - Added `rerank` option
  - Added `COHERE_API_KEY` to `.env.local` and `.env.example`
  - **Cost tracking** and **timeout protection** (500ms)

- [x] **Hierarchical Search System** 📊
  - Created `lib/services/hierarchical-search.ts` - Two-tier retrieval
  - Dual embedding generation (1536-dim + 3072-dim)
  - Document diversity guarantee (results from 5+ recordings)
  - Updated `lib/services/vector-search-google.ts`:
    - Added `searchMode: 'standard' | 'hierarchical'`
    - Added `recencyWeight` and `recencyDecayDays` parameters
    - Integrated `search_chunks_with_recency()` database function
    - 100% backward compatible (defaults to 'standard')

- [x] **Database Types Update** 📝
  - Updated `lib/types/database.ts` with all new tables:
    - `recording_summaries`, `video_frames`, `connector_configs`
    - `imported_documents`, `search_analytics`, `query_cache`
  - Added new job types: `generate_summary`, `extract_frames`, `sync_connector`
  - Added new type unions: `ConnectorType`, `SyncStatus`, `ImportedDocumentStatus`, `SearchMode`
  - Full TypeScript type safety for all Phase 1 features

### ⏳ Pending Tasks (Testing & Validation)

#### 1. Document Summarization System
- [ ] Create `lib/services/summarization.ts`
  - Generate LLM summaries using Gemini 2.5 Flash
  - Support for both transcripts and documents
  - Configurable summary length
  - Quality validation

- [ ] Create `lib/workers/handlers/generate-summary.ts`
  - Job handler for summary generation
  - Generate 3072-dim embeddings for summaries
  - Store in `recording_summaries` table
  - Error handling and retry logic

- [ ] Update `lib/workers/job-processor.ts`
  - Register `generate_summary` job type
  - Ensure it runs after `doc_generate` completes

#### 2. LLM Re-ranking Service
- [ ] Install dependencies
  - `npm install cohere-ai`
  - Update `package.json`

- [ ] Create `lib/services/reranking.ts`
  - Cohere re-rank API integration
  - Support both `rerank-english-v3.0` and multilingual models
  - Batch processing for efficiency
  - Fallback to original ranking if API fails
  - Cost tracking

- [ ] Add re-rank option to search APIs
  - Update `/api/search/route.ts`
  - Update `/api/chat/route.ts`
  - Add `rerank: boolean` parameter

#### 3. Hierarchical Search Implementation
- [ ] Create `lib/services/hierarchical-search.ts`
  - Two-step retrieval: summaries → chunks
  - Generate both 1536-dim and 3072-dim embeddings
  - Merge and deduplicate results
  - Preserve document diversity

- [ ] Update `lib/services/vector-search-google.ts`
  - Add `searchMode: 'standard' | 'hierarchical'` option
  - Integrate hierarchical search function
  - Add recency bias parameter

#### 4. Recency Bias Scoring
- [ ] Update vector search to use `search_chunks_with_recency()` function
  - Add `recencyWeight` parameter (0-1)
  - Add `recencyDecayDays` parameter
  - Combine similarity + recency scores
  - Document usage in API

#### 5. Database Types Update
- [ ] Update `lib/types/database.ts`
  - Add types for: `recording_summaries`, `video_frames`, `connector_configs`, `imported_documents`, `search_analytics`, `query_cache`
  - Add new job types to `JobType` union
  - Export new types

#### 6. Testing & Validation
- [ ] Unit tests for summarization service
- [ ] Unit tests for re-ranking service
- [ ] Integration test: full pipeline (recording → summary → search)
- [ ] Performance benchmarks
  - Measure query latency with/without re-ranking
  - Measure hierarchical vs standard search
  - Measure recency bias impact

---

## Agent Assignments

### Agent 1: Summarization System
**Files**:
- `lib/services/summarization.ts`
- `lib/workers/handlers/generate-summary.ts`
- Update: `lib/workers/job-processor.ts`

**Tasks**:
1. Implement summarization service with Gemini
2. Create job handler for background processing
3. Generate 3072-dim embeddings
4. Integrate with job processor

---

### Agent 2: Re-ranking Service
**Files**:
- `lib/services/reranking.ts`
- Update: `app/api/search/route.ts`
- Update: `app/api/chat/route.ts`
- Update: `package.json`

**Tasks**:
1. Install and configure Cohere
2. Implement re-ranking service
3. Add API parameter support
4. Add cost tracking

---

### Agent 3: Hierarchical Search
**Files**:
- `lib/services/hierarchical-search.ts`
- Update: `lib/services/vector-search-google.ts`

**Tasks**:
1. Implement two-tier search logic
2. Handle dual embedding dimensions
3. Integrate with existing vector search
4. Add recency bias support

---

### Agent 4: Database Types
**Files**:
- Update: `lib/types/database.ts`

**Tasks**:
1. Add all new table types
2. Add new job types
3. Ensure type safety across codebase

---

## Technical Decisions

### Summary Embeddings
- **Model**: OpenAI `text-embedding-3-large` or Google `gemini-embedding-001`
- **Dimensions**: 3072 (higher for better summary representation)
- **Why**: Summaries capture document-level semantics, need richer representation

### Chunk Embeddings
- **Model**: Google `gemini-embedding-001`
- **Dimensions**: 1536 (existing)
- **Why**: Already implemented, good balance of quality/cost

### Re-ranking
- **Primary**: Cohere `rerank-english-v3.0`
- **Fallback**: Cross-encoder via HuggingFace (if needed)
- **Why**: Cohere provides best quality-to-cost ratio

### Recency Bias
- **Default Weight**: 0.2 (20% boost for recent content)
- **Decay Period**: 30 days
- **Why**: Balances relevance with freshness

---

## Success Metrics

### Retrieval Quality
- [ ] 20% improvement in relevance (measured by user feedback)
- [ ] <500ms p95 latency for standard search
- [ ] <1000ms p95 latency for hierarchical search
- [ ] 90%+ document diversity (top 10 results from ≥5 recordings)

### Re-ranking Impact
- [ ] 15%+ improvement in top-3 result quality
- [ ] Minimal latency impact (<200ms added)

### System Health
- [ ] Zero downtime during migration
- [ ] All jobs complete successfully
- [ ] No regression in existing features

---

## Dependencies

### External APIs
- [x] Google Gemini AI (already configured)
- [ ] Cohere Re-rank API (needs API key)
- [x] Supabase pgvector (already configured)

### NPM Packages
- [ ] `cohere-ai` (for re-ranking)

---

## Migration Plan

### Step 1: Database Migration
```bash
# Apply migration to Supabase
psql $SUPABASE_DB_URL < supabase/migrations/012_phase1_foundation_enhancements.sql
```

### Step 2: Deploy Code
1. Deploy summarization service
2. Deploy re-ranking service
3. Deploy hierarchical search
4. Update API routes

### Step 3: Backfill Existing Data
```bash
# Generate summaries for existing recordings
yarn worker:once
```

### Step 4: Monitor & Validate
1. Check job queue processing
2. Monitor query latency
3. Collect user feedback
4. Adjust parameters as needed

---

## Cost Impact

### Additional Monthly Costs
| Component | Cost |
|-----------|------|
| Summary generation (Gemini) | ~$10 |
| Summary embeddings (3072-dim) | ~$5 |
| Cohere re-ranking | ~$30 |
| **Total** | **~$45/mo** |

**Total Phase 1 Cost**: $55 (baseline) + $45 = **$100/mo**

Still 5x cheaper than Ragie ($500+/mo)

---

## Known Issues & Risks

### Risk 1: Summary Quality
- **Issue**: LLM-generated summaries may miss key details
- **Mitigation**:
  - Use high-temperature (0.3) for factual accuracy
  - Include transcript + document in prompt
  - Validate summary length and content

### Risk 2: Re-ranking Latency
- **Issue**: External API call adds 100-300ms
- **Mitigation**:
  - Make re-ranking opt-in
  - Cache re-rank results
  - Set timeout (500ms)

### Risk 3: Embedding Dimension Mismatch
- **Issue**: Need both 1536 and 3072 dim embeddings
- **Mitigation**:
  - Clearly document which table uses which dimension
  - Add validation in code
  - Test thoroughly

---

## Next Steps

After Phase 1 completion:
1. **Phase 2**: Semantic Chunking (Week 3)
2. **Phase 3**: Agentic Retrieval (Week 4-5)
3. **Phase 4**: Advanced Video Processing (Week 6-7)
4. **Phase 5**: Connector System (Week 8-10)
5. **Phase 6**: Analytics & Polish (Week 11-12)

---

## Notes

- All agents should commit their work incrementally
- Each component should be testable independently
- Maintain backward compatibility with existing APIs
- Document all new parameters and options
- Update CLAUDE.md with new patterns when complete

---

**Last Updated**: 2025-01-11
**Next Review**: After all Phase 1 tasks complete
