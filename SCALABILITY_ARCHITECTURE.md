# Enterprise Scalability Architecture

**Version:** 1.0
**Last Updated:** October 2025
**Target Scale:** 1,000+ organizations, 100M+ embeddings, 10TB+ storage

---

## 🎯 Executive Summary

This document defines the scalability architecture for handling enterprise-level workloads:

- **Per-Organization:** 10,000+ videos, 100,000+ chunks, 1M+ embeddings
- **System-Wide:** 1,000+ organizations, 100M+ total embeddings, 10TB+ storage
- **Real-Time Integrations:** Zoom, Microsoft Teams, automatic processing
- **Multi-Format Support:** Video, audio, images, photos, documents
- **Performance Targets:** Sub-second search at scale, 100 files/min ingestion

---

## 📊 Table of Contents

1. [Vector Database Architecture](#vector-database-architecture)
2. [Multi-Tenant Isolation](#multi-tenant-isolation)
3. [Storage Hierarchy](#storage-hierarchy)
4. [Content Type Processing](#content-type-processing)
5. [Scalability Limits & Solutions](#scalability-limits)
6. [Background Job Architecture](#background-job-architecture)
7. [Zoom Integration](#zoom-integration)
8. [Microsoft Teams Integration](#teams-integration)
9. [Cost Optimization](#cost-optimization)
10. [Performance Targets](#performance-targets)
11. [Migration Strategies](#migration-strategies)

---

## 1. Vector Database Architecture

### 1.1 Table Partitioning Strategy

**Problem:** Single table with 100M+ embeddings has slow query performance and expensive index maintenance.

**Solution:** Partition tables by `org_id` (for isolation) and `created_at` (for time-based queries).

```sql
-- Create partitioned transcript_chunks table
CREATE TABLE transcript_chunks (
  id UUID NOT NULL,
  org_id UUID NOT NULL,
  recording_id UUID NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_embedding vector(1536),
  chunk_index INTEGER,
  start_time FLOAT,
  end_time FLOAT,
  source_type TEXT,
  chunking_strategy TEXT,
  semantic_score FLOAT,
  structure_type TEXT,
  boundary_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, created_at, id)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE transcript_chunks_2025_01 PARTITION OF transcript_chunks
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE transcript_chunks_2025_02 PARTITION OF transcript_chunks
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Auto-create future partitions
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  -- Create partition for next month
  partition_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
  partition_name := 'transcript_chunks_' || TO_CHAR(partition_date, 'YYYY_MM');
  start_date := partition_date::TEXT;
  end_date := (partition_date + INTERVAL '1 month')::TEXT;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF transcript_chunks
     FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly partition creation
SELECT cron.schedule(
  'create-monthly-partitions',
  '0 0 1 * *', -- First day of each month
  'SELECT create_monthly_partition()'
);
```

### 1.2 Index Optimization

**IVFFlat vs HNSW:**
- **IVFFlat:** Better for bulk inserts, good for 100K-10M vectors
- **HNSW:** Better for read-heavy workloads, optimal for 10M+ vectors

```sql
-- For standard organizations (< 100K chunks)
CREATE INDEX idx_chunks_2025_01_embedding_ivfflat
  ON transcript_chunks_2025_01
  USING ivfflat (chunk_embedding vector_cosine_ops)
  WITH (lists = 100);

-- For enterprise organizations (> 100K chunks)
CREATE INDEX idx_chunks_2025_01_embedding_hnsw
  ON transcript_chunks_2025_01
  USING hnsw (chunk_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Org-specific indexes for large customers
CREATE INDEX idx_chunks_2025_01_org_enterprise_co
  ON transcript_chunks_2025_01
  USING hnsw (chunk_embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 128)
  WHERE org_id = '550e8400-e29b-41d4-a716-446655440000';
```

### 1.3 Embedding Dimension Strategy

**Trade-off:** Higher dimensions = better quality, but slower + more storage

```typescript
interface EmbeddingStrategy {
  name: string;
  dimensions: number;
  model: string;
  useCase: string;
  costPerMillion: number;
}

const EMBEDDING_STRATEGIES: EmbeddingStrategy[] = [
  {
    name: 'lightweight',
    dimensions: 384,
    model: 'all-MiniLM-L6-v2',
    useCase: 'Quick drafts, testing, non-critical content',
    costPerMillion: 0, // Self-hosted
  },
  {
    name: 'standard',
    dimensions: 1536,
    model: 'text-embedding-3-small',
    useCase: 'Production default for most content',
    costPerMillion: 0.02,
  },
  {
    name: 'high_quality',
    dimensions: 3072,
    model: 'text-embedding-3-large',
    useCase: 'Critical documents, enterprise customers',
    costPerMillion: 0.13,
  },
];

// Adaptive embedding selection
async function selectEmbeddingStrategy(
  orgTier: 'free' | 'pro' | 'enterprise',
  contentType: string
): Promise<EmbeddingStrategy> {
  if (orgTier === 'free') {
    return EMBEDDING_STRATEGIES[0]; // lightweight
  }

  if (orgTier === 'enterprise' || contentType === 'critical_document') {
    return EMBEDDING_STRATEGIES[2]; // high_quality
  }

  return EMBEDDING_STRATEGIES[1]; // standard
}
```

### 1.4 Progressive Index Building

**Problem:** Building indexes on 100M+ vectors takes hours and blocks writes.

**Solution:** Build indexes progressively in background without blocking.

```sql
-- Create table without index first (fast inserts)
CREATE TABLE transcript_chunks_2025_03 PARTITION OF transcript_chunks
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Insert data (fast, no index overhead)
INSERT INTO transcript_chunks_2025_03 (...) VALUES (...);

-- Build index in background with CONCURRENTLY
CREATE INDEX CONCURRENTLY idx_chunks_2025_03_embedding
  ON transcript_chunks_2025_03
  USING ivfflat (chunk_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Monitor index build progress
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_chunks_%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 2. Multi-Tenant Isolation

### 2.1 RLS Policies at Scale

**Challenge:** 1,000 organizations sharing same tables - ensure no data leakage.

```sql
-- Enable RLS on all tenant tables
ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_documents ENABLE ROW LEVEL SECURITY;

-- Efficient RLS policy using indexed org_id
CREATE POLICY "Org isolation for chunks"
  ON transcript_chunks
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id
      FROM users
      WHERE id = auth.uid()
      AND org_id IS NOT NULL
    )
  );

-- Service role bypass (for background jobs)
CREATE POLICY "Service role full access"
  ON transcript_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Performance: Create filtered index for RLS
CREATE INDEX idx_chunks_org_id ON transcript_chunks(org_id)
  WHERE org_id IS NOT NULL;
```

### 2.2 Org-Level Index Separation

**For Enterprise Customers:** Dedicated index partitions for best performance.

```sql
-- Create dedicated partition for large customer
CREATE TABLE transcript_chunks_enterprise_acme PARTITION OF transcript_chunks
  FOR VALUES FROM ('2025-01-01') TO ('2025-12-31')
  WHERE org_id = 'acme-corp-uuid';

-- Optimized index just for this org
CREATE INDEX idx_chunks_acme_embedding
  ON transcript_chunks_enterprise_acme
  USING hnsw (chunk_embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 128);

-- Automatic routing in search function
async function searchWithDedicatedIndex(
  query: string,
  orgId: string
): Promise<SearchResult[]> {
  const hasD dedicatedPartition = await checkDedicatedPartition(orgId);

  if (hasDedicatedPartition) {
    // Query dedicated partition (faster)
    return searchDedicatedPartition(query, orgId);
  } else {
    // Query shared partition (standard)
    return searchSharedPartition(query, orgId);
  }
}
```

### 2.3 Cross-Org Data Leakage Prevention

**Automated Testing:**

```typescript
// Test suite to verify org isolation
describe('Multi-Tenant Isolation', () => {
  it('should not return results from other orgs', async () => {
    const org1Results = await vectorSearch('test query', {
      orgId: 'org-1',
      userId: 'user-in-org-1',
    });

    // Verify all results belong to org-1
    org1Results.forEach(result => {
      expect(result.orgId).toBe('org-1');
    });
  });

  it('should enforce RLS at database level', async () => {
    // Try to query as user from different org
    const results = await supabase
      .from('transcript_chunks')
      .select('*')
      .eq('org_id', 'org-2'); // User is in org-1

    // Should return 0 results due to RLS
    expect(results.data).toHaveLength(0);
  });

  it('should prevent SQL injection in org_id filter', async () => {
    // Attempt SQL injection
    const maliciousOrgId = "' OR '1'='1";

    const results = await vectorSearch('test', {
      orgId: maliciousOrgId,
    });

    // Should return 0 results (injection blocked)
    expect(results).toHaveLength(0);
  });
});
```

---

## 3. Storage Hierarchy

### 3.1 Hot/Warm/Cold Tiers

**Strategy:** Move old data to cheaper storage while keeping recent data fast.

```typescript
enum StorageTier {
  HOT = 'hot',     // Last 30 days, SSD, instant access
  WARM = 'warm',   // 30-365 days, HDD, 1-5s access
  COLD = 'cold',   // 365+ days, S3 Glacier, minutes access
  ARCHIVE = 'archive', // Never accessed, S3 Deep Archive, hours access
}

interface TierPolicy {
  tier: StorageTier;
  ageThreshold: number; // days
  costPerGB: number;
  retrievalTime: string;
}

const TIER_POLICIES: TierPolicy[] = [
  {
    tier: StorageTier.HOT,
    ageThreshold: 0,
    costPerGB: 0.023, // Supabase/AWS SSD
    retrievalTime: '< 10ms',
  },
  {
    tier: StorageTier.WARM,
    ageThreshold: 30,
    costPerGB: 0.0125, // AWS S3 Standard
    retrievalTime: '1-5s',
  },
  {
    tier: StorageTier.COLD,
    ageThreshold: 365,
    costPerGB: 0.004, // AWS S3 Glacier
    retrievalTime: '3-5 minutes',
  },
  {
    tier: StorageTier.ARCHIVE,
    ageThreshold: 1095, // 3 years
    costPerGB: 0.00099, // AWS S3 Deep Archive
    retrievalTime: '12 hours',
  },
];
```

**Implementation:**

```sql
-- Add storage tier to recordings table
ALTER TABLE recordings
ADD COLUMN storage_tier TEXT DEFAULT 'hot',
ADD COLUMN archived_at TIMESTAMPTZ,
ADD COLUMN archive_url TEXT;

CREATE INDEX idx_recordings_tier ON recordings(storage_tier, created_at);

-- Automatic tiering function
CREATE OR REPLACE FUNCTION tier_old_recordings()
RETURNS void AS $$
BEGIN
  -- Move to WARM tier (30-365 days old)
  UPDATE recordings
  SET storage_tier = 'warm'
  WHERE storage_tier = 'hot'
    AND created_at < NOW() - INTERVAL '30 days'
    AND created_at >= NOW() - INTERVAL '365 days';

  -- Move to COLD tier (1-3 years old)
  UPDATE recordings
  SET storage_tier = 'cold'
  WHERE storage_tier = 'warm'
    AND created_at < NOW() - INTERVAL '365 days'
    AND created_at >= NOW() - INTERVAL '1095 days';

  -- Move to ARCHIVE tier (3+ years old)
  UPDATE recordings
  SET storage_tier = 'archive',
      archived_at = NOW()
  WHERE storage_tier = 'cold'
    AND created_at < NOW() - INTERVAL '1095 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule daily tiering
SELECT cron.schedule(
  'tier-old-recordings',
  '0 2 * * *', -- 2 AM daily
  'SELECT tier_old_recordings()'
);
```

### 3.2 Automatic Archival

```typescript
// Archive old recordings to S3 Glacier
async function archiveRecording(recordingId: string): Promise<void> {
  const supabase = createClient();

  // 1. Get recording metadata
  const { data: recording } = await supabase
    .from('recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (!recording) return;

  // 2. Download video from hot storage
  const videoUrl = recording.video_url;
  const videoData = await downloadFile(videoUrl);

  // 3. Upload to S3 Glacier
  const s3Client = new S3Client({});
  const archiveKey = `archives/${recording.org_id}/${recordingId}.mp4`;

  await s3Client.send(new PutObjectCommand({
    Bucket: 'recordings-archive',
    Key: archiveKey,
    Body: videoData,
    StorageClass: 'GLACIER',
  }));

  // 4. Update database
  await supabase
    .from('recordings')
    .update({
      storage_tier: 'cold',
      archive_url: `s3://recordings-archive/${archiveKey}`,
      archived_at: new Date().toISOString(),
    })
    .eq('id', recordingId);

  // 5. Delete from hot storage (after confirmation)
  await supabase.storage
    .from('videos')
    .remove([recording.storage_path_processed]);

  console.log(`[Archive] Archived recording ${recordingId} to Glacier`);
}

// Restore from archive
async function restoreRecording(recordingId: string): Promise<string> {
  // 1. Initiate Glacier restore (takes 3-5 minutes)
  const restoreRequest = await s3Client.send(new RestoreObjectCommand({
    Bucket: 'recordings-archive',
    Key: archiveKey,
    RestoreRequest: {
      Days: 7, // Keep restored for 7 days
      GlacierJobParameters: {
        Tier: 'Expedited', // 1-5 minutes (vs Standard: 3-5 hours)
      },
    },
  }));

  // 2. Poll for restoration completion
  await pollRestoreStatus(archiveKey);

  // 3. Download and re-upload to hot storage
  const restoredData = await downloadFromS3(archiveKey);
  const hotUrl = await uploadToHotStorage(restoredData, recordingId);

  // 4. Update database
  await supabase
    .from('recordings')
    .update({
      storage_tier: 'hot',
      video_url: hotUrl,
    })
    .eq('id', recordingId);

  return hotUrl;
}
```

---

## 4. Content Type Processing

### 4.1 Universal Media Pipeline

**Architecture:** Single pipeline handles all media types with type-specific processors.

```typescript
interface MediaFile {
  id: string;
  orgId: string;
  type: MediaType;
  url: string;
  size: number;
  mimeType: string;
  metadata: Record<string, any>;
}

enum MediaType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  DOCUMENT = 'document',
}

class UniversalMediaProcessor {
  async process(file: MediaFile): Promise<ProcessingResult> {
    console.log(`[Media Pipeline] Processing ${file.type}: ${file.id}`);

    // 1. Validate file
    await this.validateFile(file);

    // 2. Route to appropriate processor
    const processor = this.getProcessor(file.type);
    const result = await processor.process(file);

    // 3. Generate embeddings
    const embeddings = await this.generateEmbeddings(result);

    // 4. Store in database
    await this.storeResults(file, result, embeddings);

    // 5. Trigger downstream jobs
    await this.triggerDownstreamJobs(file, result);

    return result;
  }

  private getProcessor(type: MediaType): MediaProcessor {
    switch (type) {
      case MediaType.VIDEO:
        return new VideoProcessor();
      case MediaType.AUDIO:
        return new AudioProcessor();
      case MediaType.IMAGE:
        return new ImageProcessor();
      case MediaType.DOCUMENT:
        return new DocumentProcessor();
      default:
        throw new Error(`Unsupported media type: ${type}`);
    }
  }
}
```

### 4.2 Video Processing Pipeline

```typescript
class VideoProcessor implements MediaProcessor {
  async process(file: MediaFile): Promise<VideoProcessingResult> {
    const results: VideoProcessingResult = {
      fileId: file.id,
      duration: 0,
      frames: [],
      audioTrack: null,
      transcript: null,
      visualDescriptions: [],
    };

    // 1. Extract metadata
    const metadata = await this.extractVideoMetadata(file.url);
    results.duration = metadata.duration;

    // 2. Extract audio track
    results.audioTrack = await this.extractAudio(file.url);

    // 3. Transcribe audio
    if (results.audioTrack) {
      results.transcript = await this.transcribeAudio(results.audioTrack);
    }

    // 4. Extract key frames
    const frameRate = this.calculateOptimalFrameRate(results.duration);
    results.frames = await this.extractFrames(file.url, frameRate);

    // 5. Generate frame descriptions (Gemini Vision)
    results.visualDescriptions = await this.describeFrames(results.frames);

    // 6. Detect scenes
    results.scenes = await this.detectScenes(file.url);

    // 7. Extract on-screen text (OCR)
    results.ocrText = await this.extractOCRText(results.frames);

    return results;
  }

  private calculateOptimalFrameRate(durationSec: number): number {
    // Adaptive frame rate based on video length
    if (durationSec < 60) return 1; // 1 FPS for short videos
    if (durationSec < 600) return 0.5; // 1 frame every 2 seconds
    if (durationSec < 3600) return 0.2; // 1 frame every 5 seconds
    return 0.1; // 1 frame every 10 seconds for long videos
  }

  async extractAudio(videoUrl: string): Promise<AudioFile> {
    const outputPath = `/tmp/audio-${Date.now()}.mp3`;

    return new Promise((resolve, reject) => {
      ffmpeg(videoUrl)
        .output(outputPath)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .noVideo()
        .on('end', () => resolve({ path: outputPath }))
        .on('error', reject)
        .run();
    });
  }
}
```

### 4.3 Audio Processing Pipeline

```typescript
class AudioProcessor implements MediaProcessor {
  async process(file: MediaFile): Promise<AudioProcessingResult> {
    const results: AudioProcessingResult = {
      fileId: file.id,
      duration: 0,
      transcript: null,
      speakers: [],
      audioEmbedding: null,
    };

    // 1. Get audio metadata
    const metadata = await this.getAudioMetadata(file.url);
    results.duration = metadata.duration;

    // 2. Transcribe with Whisper or Gemini
    results.transcript = await this.transcribe(file.url, {
      language: 'auto',
      timestamps: true,
    });

    // 3. Speaker diarization (optional)
    if (this.shouldDiarize(metadata)) {
      results.speakers = await this.detectSpeakers(file.url);
    }

    // 4. Generate audio embeddings (for similarity)
    results.audioEmbedding = await this.generateAudioEmbedding(file.url);

    return results;
  }

  private async transcribe(
    audioUrl: string,
    options: TranscribeOptions
  ): Promise<Transcript> {
    // Use Gemini for audio transcription
    const genAI = createGoogleGenerativeAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Download audio file
    const audioBuffer = await downloadFile(audioUrl);
    const audioBase64 = audioBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/mp3',
          data: audioBase64,
        },
      },
      {
        text: 'Transcribe this audio with timestamps. Include speaker labels if multiple speakers detected.',
      },
    ]);

    return this.parseTranscript(result.response.text());
  }
}
```

### 4.4 Image Processing Pipeline

```typescript
class ImageProcessor implements MediaProcessor {
  async process(file: MediaFile): Promise<ImageProcessingResult> {
    const results: ImageProcessingResult = {
      fileId: file.id,
      visualDescription: '',
      ocrText: '',
      detectedObjects: [],
      imageEmbedding: null,
    };

    // 1. Generate visual description (Gemini Vision)
    results.visualDescription = await this.describeImage(file.url);

    // 2. Extract text via OCR
    results.ocrText = await this.extractOCRText(file.url);

    // 3. Detect objects/elements
    results.detectedObjects = await this.detectObjects(file.url);

    // 4. Generate image embedding
    results.imageEmbedding = await this.generateImageEmbedding(file.url);

    // 5. Check for duplicates
    results.isDuplicate = await this.checkDuplicate(
      results.imageEmbedding,
      file.orgId
    );

    return results;
  }

  private async describeImage(imageUrl: string): Promise<string> {
    const genAI = createGoogleGenerativeAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const imageBuffer = await downloadFile(imageUrl);
    const imageBase64 = imageBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      },
      {
        text: `Describe this image in detail. Include:
        - Main subjects/objects
        - Text visible in image
        - UI elements if screenshot
        - Context and setting
        - Technical details if relevant`,
      },
    ]);

    return result.response.text();
  }
}
```

### 4.5 Document Processing Pipeline

```typescript
class DocumentProcessor implements MediaProcessor {
  async process(file: MediaFile): Promise<DocumentProcessingResult> {
    const results: DocumentProcessingResult = {
      fileId: file.id,
      text: '',
      chunks: [],
      images: [],
      tables: [],
    };

    // 1. Extract text based on format
    results.text = await this.extractText(file);

    // 2. Extract embedded images
    results.images = await this.extractImages(file);

    // 3. Extract tables
    results.tables = await this.extractTables(file);

    // 4. Semantic chunking
    const chunker = new SemanticChunker();
    results.chunks = await chunker.chunk(results.text);

    // 5. Process extracted images
    for (const image of results.images) {
      await new ImageProcessor().process(image);
    }

    return results;
  }

  private async extractText(file: MediaFile): Promise<string> {
    switch (file.mimeType) {
      case 'application/pdf':
        return this.extractPDFText(file.url);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractDOCXText(file.url);

      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return this.extractPPTXText(file.url);

      case 'text/plain':
      case 'text/markdown':
        return downloadFile(file.url).then(b => b.toString('utf-8'));

      default:
        throw new Error(`Unsupported document type: ${file.mimeType}`);
    }
  }
}
```

---

## 5. Scalability Limits & Solutions

### 5.1 Per-Organization Limits

| Metric | Small Org | Medium Org | Large Org | Enterprise |
|--------|-----------|------------|-----------|------------|
| **Recordings** | < 1,000 | 1,000-10,000 | 10,000-50,000 | 50,000+ |
| **Chunks** | < 10,000 | 10,000-100,000 | 100,000-1M | 1M+ |
| **Embeddings** | < 20,000 | 20,000-200,000 | 200,000-2M | 2M+ |
| **Storage** | < 100GB | 100GB-1TB | 1TB-10TB | 10TB+ |
| **Index Type** | Shared IVFFlat | Shared IVFFlat | Partitioned IVFFlat | Dedicated HNSW |
| **Search Strategy** | Standard | Standard | Optimized | Dedicated |

**Solutions by Tier:**

```typescript
async function configureOrgInfrastructure(
  orgId: string,
  tier: 'small' | 'medium' | 'large' | 'enterprise'
): Promise<void> {
  const config: OrgConfig = {
    orgId,
    tier,
    indexStrategy: 'shared',
    storageQuota: 100 * 1024 * 1024 * 1024, // 100GB
    embeddingQuality: 'standard',
  };

  switch (tier) {
    case 'enterprise':
      // Dedicated infrastructure
      config.indexStrategy = 'dedicated';
      config.storageQuota = 10 * 1024 * 1024 * 1024 * 1024; // 10TB
      config.embeddingQuality = 'high';

      // Create dedicated partition
      await createDedicatedPartition(orgId);

      // Create dedicated HNSW index
      await createDedicatedIndex(orgId, 'hnsw');

      // Set up dedicated worker pool
      await provisionDedicatedWorkers(orgId, 10);
      break;

    case 'large':
      // Optimized shared infrastructure
      config.indexStrategy = 'partitioned';
      config.storageQuota = 1 * 1024 * 1024 * 1024 * 1024; // 1TB
      config.embeddingQuality = 'standard';

      // Use partitioned indexes
      await enablePartitionedSearch(orgId);
      break;

    default:
      // Standard shared infrastructure
      config.indexStrategy = 'shared';
  }

  await saveOrgConfig(config);
}
```

### 5.2 System-Wide Limits

**100M Embeddings Strategy:**

```sql
-- Distributed indexes across multiple servers
-- Use Citus or similar for horizontal scaling

-- Shard transcript_chunks by org_id
SELECT create_distributed_table('transcript_chunks', 'org_id');

-- Each shard handles ~10M embeddings (10 shards total)
-- Queries automatically routed to correct shard

-- Example: Query only hits 1 shard
SELECT * FROM transcript_chunks
WHERE org_id = 'specific-org'
  AND chunk_embedding <=> '[0.1, 0.2, ...]'::vector
ORDER BY chunk_embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

**1000 Organizations:**

```typescript
// Load balancing strategy
class OrgRouter {
  private shardMap: Map<string, string>; // orgId -> database shard

  async route Query(orgId: string, query: string): Promise<SearchResult[]> {
    // 1. Determine shard for this org
    const shard = this.getShardForOrg(orgId);

    // 2. Execute on correct database
    const db = this.getShardConnection(shard);

    // 3. Run query
    return db.query(query);
  }

  private getShardForOrg(orgId: string): string {
    // Consistent hashing
    const hash = this.hashOrgId(orgId);
    const shardIndex = hash % this.shardCount;
    return `shard-${shardIndex}`;
  }
}
```

---

## 6. Background Job Architecture

### 6.1 Job Priority System

```typescript
enum JobPriority {
  CRITICAL = 0,    // User-facing, real-time (e.g., search)
  HIGH = 1,        // New recording processing
  NORMAL = 2,      // Batch imports
  LOW = 3,         // Background optimization
  MAINTENANCE = 4, // Cleanup, archival
}

interface Job {
  id: string;
  type: string;
  priority: JobPriority;
  orgId: string;
  payload: any;
  attemptCount: number;
  runAfter: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Fetch jobs by priority
async function fetchNextJobs(limit: number = 10): Promise<Job[]> {
  return supabase
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('run_after', new Date().toISOString())
    .order('priority', { ascending: true }) // Lower number = higher priority
    .order('created_at', { ascending: true })
    .limit(limit);
}
```

### 6.2 Parallel Processing

```typescript
class JobProcessor {
  private readonly workerCount: number;
  private workers: Worker[] = [];

  constructor(workerCount: number = 10) {
    this.workerCount = workerCount;
  }

  async start(): Promise<void> {
    console.log(`[Job Processor] Starting ${this.workerCount} workers...`);

    // Start worker threads
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker({
        id: `worker-${i}`,
        processor: this,
      });

      this.workers.push(worker);
      worker.start();
    }
  }

  async processJobBatch(): Promise<void> {
    // Fetch jobs (more than workers to keep them busy)
    const jobs = await fetchNextJobs(this.workerCount * 2);

    if (jobs.length === 0) {
      await sleep(1000);
      return;
    }

    // Distribute jobs to workers
    await Promise.allSettled(
      jobs.map(job => this.processJob(job))
    );
  }

  private async processJob(job: Job): Promise<void> {
    try {
      // Mark as processing
      await updateJobStatus(job.id, 'processing');

      // Route to handler
      const handler = this.getHandler(job.type);
      await handler(job);

      // Mark as completed
      await updateJobStatus(job.id, 'completed');

      console.log(`[Job ${job.id}] Completed: ${job.type}`);
    } catch (error) {
      console.error(`[Job ${job.id}] Failed:`, error);
      await this.handleJobFailure(job, error);
    }
  }

  private async handleJobFailure(job: Job, error: Error): Promise<void> {
    const maxAttempts = 3;

    if (job.attemptCount >= maxAttempts) {
      // Move to dead letter queue
      await moveToDeadLetterQueue(job, error);
      await updateJobStatus(job.id, 'failed');
    } else {
      // Retry with exponential backoff
      const backoffMs = Math.pow(2, job.attemptCount) * 1000;
      const runAfter = new Date(Date.now() + backoffMs);

      await supabase
        .from('jobs')
        .update({
          status: 'pending',
          attempt_count: job.attemptCount + 1,
          run_after: runAfter.toISOString(),
          metadata: {
            ...job.metadata,
            lastError: error.message,
          },
        })
        .eq('id', job.id);
    }
  }
}
```

### 6.3 Auto-Scaling Workers

```typescript
// Monitor queue depth and scale workers accordingly
class WorkerAutoscaler {
  private minWorkers = 2;
  private maxWorkers = 50;
  private currentWorkers = 10;

  async monitor(): Promise<void> {
    setInterval(async () => {
      const queueDepth = await this.getQueueDepth();
      const avgProcessingTime = await this.getAvgProcessingTime();

      // Calculate optimal worker count
      const optimalWorkers = Math.ceil(
        queueDepth / (3600 / avgProcessingTime) // Process all in 1 hour
      );

      const targetWorkers = Math.max(
        this.minWorkers,
        Math.min(this.maxWorkers, optimalWorkers)
      );

      // Scale if needed
      if (targetWorkers > this.currentWorkers) {
        await this.scaleUp(targetWorkers - this.currentWorkers);
      } else if (targetWorkers < this.currentWorkers) {
        await this.scaleDown(this.currentWorkers - targetWorkers);
      }
    }, 60000); // Check every minute
  }

  private async getQueueDepth(): Promise<number> {
    const { count } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    return count || 0;
  }
}
```

---

## 7. Zoom Integration Architecture

### 7.1 OAuth Flow

```typescript
// Step 1: Redirect user to Zoom OAuth
app.get('/api/connectors/auth/zoom', async (req, res) => {
  const { orgId } = await requireOrg(req);

  const authUrl = `https://zoom.us/oauth/authorize?` +
    `response_type=code` +
    `&client_id=${process.env.ZOOM_CLIENT_ID}` +
    `&redirect_uri=${process.env.ZOOM_REDIRECT_URI}` +
    `&state=${orgId}`;

  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
app.get('/api/connectors/auth/zoom/callback', async (req, res) => {
  const { code, state: orgId } = req.query;

  // Exchange code for tokens
  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(
        `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: process.env.ZOOM_REDIRECT_URI!,
    }),
  });

  const tokens = await response.json();

  // Store connector config
  await supabase.from('connector_configs').insert({
    org_id: orgId,
    connector_type: 'zoom',
    name: 'Zoom Meetings',
    credentials: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    },
    settings: {
      auto_import: true,
      webhook_enabled: true,
    },
    is_active: true,
  });

  // Register webhook
  await registerZoomWebhook(orgId, tokens.access_token);

  res.redirect('/dashboard/connectors?zoom=connected');
});
```

### 7.2 Webhook Handler

```typescript
// Zoom webhook endpoint
app.post('/api/webhooks/zoom', async (req, res) => {
  // Verify webhook signature
  const isValid = verifyZoomWebhookSignature(
    req.headers['x-zm-signature'],
    req.body
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body.event;

  switch (event) {
    case 'recording.completed':
      await handleRecordingCompleted(req.body.payload);
      break;

    case 'recording.transcript_completed':
      await handleTranscriptCompleted(req.body.payload);
      break;

    case 'meeting.ended':
      await handleMeetingEnded(req.body.payload);
      break;
  }

  res.status(200).json({ received: true });
});

async function handleRecordingCompleted(payload: any): Promise<void> {
  const {
    uuid: meetingUuid,
    recording_files,
    topic: meetingTopic,
    start_time,
    duration,
    host_id,
  } = payload.object;

  console.log(`[Zoom] Recording completed: ${meetingTopic}`);

  // Find org from host
  const { data: connector } = await supabase
    .from('connector_configs')
    .select('org_id, credentials')
    .eq('connector_type', 'zoom')
    .single();

  if (!connector) return;

  // Process each recording file
  for (const file of recording_files) {
    if (file.file_type === 'MP4') {
      // Download recording
      const downloadUrl = file.download_url;
      const recordingData = await downloadZoomRecording(
        downloadUrl,
        connector.credentials.access_token
      );

      // Upload to Supabase Storage
      const storagePath = `${connector.org_id}/zoom/${meetingUuid}.mp4`;
      await supabase.storage
        .from('videos')
        .upload(storagePath, recordingData);

      // Create imported document
      await supabase.from('imported_documents').insert({
        connector_id: connector.id,
        org_id: connector.org_id,
        external_id: meetingUuid,
        title: meetingTopic,
        file_type: 'video/mp4',
        source_url: downloadUrl,
        metadata: {
          duration,
          start_time,
          host_id,
          participants: await getZoomMeetingParticipants(meetingUuid),
        },
        sync_status: 'pending',
      });

      // Queue processing job
      await supabase.from('jobs').insert({
        org_id: connector.org_id,
        type: 'process_zoom_recording',
        priority: JobPriority.HIGH,
        payload: {
          meetingUuid,
          storagePath,
          metadata: {
            topic: meetingTopic,
            duration,
          },
        },
        status: 'pending',
        attempt_count: 0,
        run_after: new Date().toISOString(),
      });
    }
  }
}
```

### 7.3 Automatic Sync

```typescript
// Periodic sync of missed recordings
async function syncZoomRecordings(connectorId: string): Promise<void> {
  const { data: connector } = await supabase
    .from('connector_configs')
    .select('*')
    .eq('id', connectorId)
    .single();

  if (!connector) return;

  // Fetch recordings from last sync
  const since = connector.last_sync_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const zoom = new ZoomClient(connector.credentials.access_token);
  const recordings = await zoom.listRecordings({
    from: since.toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  console.log(`[Zoom Sync] Found ${recordings.meetings.length} recordings`);

  for (const meeting of recordings.meetings) {
    // Check if already imported
    const { data: existing } = await supabase
      .from('imported_documents')
      .select('id')
      .eq('external_id', meeting.uuid)
      .single();

    if (existing) continue;

    // Import new recording
    await handleRecordingCompleted({ object: meeting });
  }

  // Update last sync time
  await supabase
    .from('connector_configs')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
    })
    .eq('id', connectorId);
}
```

---

## 8. Microsoft Teams Integration

### 8.1 Graph API Setup

```typescript
import { Client } from '@microsoft/microsoft-graph-client';

class TeamsConnector {
  private graphClient: Client;

  constructor(accessToken: string) {
    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  async listOnlineMeetings(userId: string): Promise<any[]> {
    const meetings = await this.graphClient
      .api(`/users/${userId}/onlineMeetings`)
      .select('id,subject,startDateTime,endDateTime,participants')
      .get();

    return meetings.value;
  }

  async getCallRecording(callId: string): Promise<Buffer> {
    const recording = await this.graphClient
      .api(`/communications/callRecords/${callId}/recordings`)
      .get();

    // Download recording content
    const recordingUrl = recording.value[0].contentUrl;
    const response = await fetch(recordingUrl);
    return Buffer.from(await response.arrayBuffer());
  }

  async getTranscript(callId: string): Promise<string> {
    const transcript = await this.graphClient
      .api(`/communications/callRecords/${callId}/transcripts`)
      .get();

    if (!transcript.value || transcript.value.length === 0) {
      return '';
    }

    // Get transcript content
    const transcriptUrl = transcript.value[0].transcriptContentUrl;
    const response = await fetch(transcriptUrl);
    return response.text();
  }
}
```

### 8.2 Webhook Subscription

```typescript
// Subscribe to Teams call recording events
async function subscribeToTeamsEvents(orgId: string, accessToken: string): Promise<void> {
  const graphClient = new Client(/* ... */);

  const subscription = await graphClient
    .api('/subscriptions')
    .post({
      changeType: 'created,updated',
      notificationUrl: `${process.env.APP_URL}/api/webhooks/teams`,
      resource: '/communications/callRecords',
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      clientState: orgId, // Verify webhook origin
    });

  // Store subscription ID
  await supabase
    .from('connector_configs')
    .update({
      settings: {
        subscriptionId: subscription.id,
        subscriptionExpiry: subscription.expirationDateTime,
      },
    })
    .eq('org_id', orgId)
    .eq('connector_type', 'teams');
}

// Renew subscription before expiry
async function renewTeamsSubscription(connectorId: string): Promise<void> {
  const { data: connector } = await supabase
    .from('connector_configs')
    .select('*')
    .eq('id', connectorId)
    .single();

  const graphClient = new Client(/* ... */);

  await graphClient
    .api(`/subscriptions/${connector.settings.subscriptionId}`)
    .patch({
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
}
```

---

## 9. Cost Optimization at Scale

### 9.1 Cost Breakdown (1000 Organizations)

```typescript
interface CostModel {
  component: string;
  unitCost: number;
  unit: string;
  expectedUsage: number;
  totalMonthlyCost: number;
}

const COST_MODEL: CostModel[] = [
  {
    component: 'Database Storage',
    unitCost: 0.125, // Per GB
    unit: 'GB',
    expectedUsage: 10000, // 10 TB total
    totalMonthlyCost: 1250,
  },
  {
    component: 'Vector Embeddings (OpenAI)',
    unitCost: 0.02, // Per million tokens
    unit: 'M tokens',
    expectedUsage: 5000, // 5B tokens
    totalMonthlyCost: 100,
  },
  {
    component: 'LLM API Calls (Gemini)',
    unitCost: 0.50, // Per million tokens
    unit: 'M tokens',
    expectedUsage: 2000, // 2B tokens
    totalMonthlyCost: 1000,
  },
  {
    component: 'Cohere Re-ranking',
    unitCost: 1.00, // Per 1000 searches
    unit: '1K searches',
    expectedUsage: 100000, // 100M searches
    totalMonthlyCost: 100000,
  },
  {
    component: 'Storage (S3)',
    unitCost: 0.023, // Per GB
    unit: 'GB',
    expectedUsage: 50000, // 50 TB
    totalMonthlyCost: 1150,
  },
  {
    component: 'Bandwidth',
    unitCost: 0.09, // Per GB
    unit: 'GB',
    expectedUsage: 10000, // 10 TB
    totalMonthlyCost: 900,
  },
  {
    component: 'Workers (Compute)',
    unitCost: 200, // Per worker/month
    unit: 'workers',
    expectedUsage: 50,
    totalMonthlyCost: 10000,
  },
];

// Total: ~$114,400/month for 1000 orgs
// Per org: ~$114/month
// Revenue target: $500/org/month → 77% gross margin
```

### 9.2 Cost Optimization Strategies

```typescript
// 1. Intelligent caching to reduce API calls
class CostOptimizedCache {
  async getCachedOrGenerate<T>(
    key: string,
    generator: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    // Check cache first
    const cached = await redis.get(key);
    if (cached) {
      console.log('[Cost] Cache hit - saved API call');
      return JSON.parse(cached);
    }

    // Generate and cache
    const result = await generator();
    await redis.setex(key, ttl, JSON.stringify(result));

    return result;
  }
}

// 2. Batch processing to get volume discounts
async function batchGenerateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  // Batch into 100-text chunks
  const batches = chunk(texts, 100);

  const allEmbeddings: number[][] = [];

  for (const batch of batches) {
    // Single API call for 100 texts
    const embeddings = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });

    allEmbeddings.push(...embeddings.data.map(e => e.embedding));
  }

  return allEmbeddings;
}

// 3. Use cheaper models for non-critical tasks
function selectModel(task: string, priority: 'high' | 'normal' | 'low'): string {
  if (priority === 'low') {
    return 'gemini-2.0-flash-exp'; // Cheaper
  }

  if (task === 'embedding') {
    return 'text-embedding-3-small'; // Standard
  }

  return 'gemini-2.0-flash-exp'; // Default
}

// 4. Implement storage tiering
async function optimizeStorageCosts(orgId: string): Promise<void> {
  // Move old recordings to cheaper storage
  const oldRecordings = await supabase
    .from('recordings')
    .select('id, created_at, storage_path')
    .eq('org_id', orgId)
    .eq('storage_tier', 'hot')
    .lt('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

  for (const recording of oldRecordings.data || []) {
    await archiveRecording(recording.id);
    console.log(`[Cost] Archived ${recording.id} to cold storage`);
  }
}
```

---

## 10. Performance Targets

### 10.1 Latency Targets

| Operation | p50 | p95 | p99 | Target |
|-----------|-----|-----|-----|--------|
| **Vector Search** | 150ms | 400ms | 800ms | < 1000ms |
| **Hybrid Search** | 200ms | 500ms | 1000ms | < 1500ms |
| **Agentic Search** | 2000ms | 4000ms | 6000ms | < 8000ms |
| **Frame Extraction** | 5s | 15s | 30s | < 60s |
| **Transcription (10min)** | 30s | 60s | 120s | < 180s |
| **Document Import** | 3s | 10s | 20s | < 30s |

### 10.2 Throughput Targets

| Operation | Target | Current | Strategy |
|-----------|--------|---------|----------|
| **Searches/sec** | 1000 | 100 | Add caching, optimize indexes |
| **File Ingestion** | 100 files/min | 20 | Parallel processing, more workers |
| **Embeddings/sec** | 10000 | 1000 | Batch API calls |
| **Concurrent Users** | 10000 | 1000 | Horizontal scaling |

### 10.3 Monitoring

```typescript
// Track performance metrics
class PerformanceMonitor {
  async trackLatency(
    operation: string,
    durationMs: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await supabase.from('performance_metrics').insert({
      operation,
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
      metadata,
    });

    // Alert if exceeds threshold
    const threshold = this.getThreshold(operation);
    if (durationMs > threshold) {
      await this.sendAlert({
        severity: 'warning',
        message: `${operation} exceeded threshold: ${durationMs}ms > ${threshold}ms`,
        metadata,
      });
    }
  }

  private getThreshold(operation: string): number {
    const thresholds: Record<string, number> = {
      'vector_search': 1000,
      'hybrid_search': 1500,
      'agentic_search': 8000,
      'frame_extraction': 60000,
      'transcription': 180000,
    };

    return thresholds[operation] || 5000;
  }
}
```

---

## 11. Migration Strategies

### 11.1 Zero-Downtime Index Rebuilds

```sql
-- Step 1: Create new index concurrently
CREATE INDEX CONCURRENTLY idx_chunks_new_hnsw
  ON transcript_chunks
  USING hnsw (chunk_embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 128);

-- Step 2: Verify new index
EXPLAIN ANALYZE
SELECT * FROM transcript_chunks
ORDER BY chunk_embedding <=> '[...]'::vector
LIMIT 10;

-- Step 3: Drop old index
DROP INDEX CONCURRENTLY idx_chunks_old_ivfflat;

-- Step 4: Rename new index
ALTER INDEX idx_chunks_new_hnsw RENAME TO idx_chunks_embedding;
```

### 11.2 Gradual Rollout

```typescript
// Feature flag system for gradual rollout
async function isFeatureEnabled(
  feature: string,
  orgId: string
): Promise<boolean> {
  // Check if org is in beta group
  const { data: org } = await supabase
    .from('organizations')
    .select('feature_flags')
    .eq('id', orgId)
    .single();

  return org?.feature_flags?.[feature] === true;
}

// Example: Gradual rollout of agentic search
async function performSearch(query: string, orgId: string): Promise<SearchResult[]> {
  const useAgenticSearch = await isFeatureEnabled('agentic_search', orgId);

  if (useAgenticSearch) {
    return agenticSearch(query, { orgId });
  } else {
    return standardSearch(query, { orgId });
  }
}

// Enable for percentage of orgs
async function enableFeatureForPercentage(
  feature: string,
  percentage: number
): Promise<void> {
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .limit(1000);

  const targetCount = Math.floor((orgs?.length || 0) * (percentage / 100));
  const selectedOrgs = orgs?.slice(0, targetCount) || [];

  for (const org of selectedOrgs) {
    await supabase
      .from('organizations')
      .update({
        feature_flags: {
          [feature]: true,
        },
      })
      .eq('id', org.id);
  }

  console.log(`[Rollout] Enabled ${feature} for ${targetCount} orgs (${percentage}%)`);
}
```

---

## 🎯 Summary

This scalability architecture enables:

1. ✅ **Thousands of organizations** with isolated data and indexes
2. ✅ **Millions of embeddings** via partitioning and sharding
3. ✅ **All media types** through universal processing pipeline
4. ✅ **Real-time integrations** (Zoom, Teams) with webhook handlers
5. ✅ **Cost optimization** through caching, tiering, and batch processing
6. ✅ **Sub-second search** with properly tuned indexes
7. ✅ **Zero-downtime migrations** for continuous improvement

**Next:** Implement phases 1-6 following this architecture foundation.
