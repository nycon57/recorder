# Progress Integration Guide for Job Handlers

This guide shows how to add progress tracking to existing job handlers.

## Quick Reference

### Handler Signature

```typescript
import { ProgressCallback } from '@/lib/workers/job-processor';
import type { Database } from '@/lib/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];

export async function myHandler(
  job: Job,
  progressCallback?: ProgressCallback  // Add this parameter
): Promise<void> {
  // Your handler implementation
}
```

### Progress Callback Usage

```typescript
// Report progress (percent is 0-100)
progressCallback?.(25, 'Status message', { optional: 'data' });
```

---

## Example Implementations

### 1. Simple Handler (No Chunking)

```typescript
export async function generateSummary(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const { recordingId } = job.payload;

  progressCallback?.(0, 'Fetching transcript...');

  const transcript = await getTranscript(recordingId);

  progressCallback?.(30, 'Generating summary with AI...', {
    transcriptLength: transcript.length
  });

  const summary = await generateWithAI(transcript);

  progressCallback?.(80, 'Saving summary...');

  await saveSummary(recordingId, summary);

  progressCallback?.(100, 'Summary generation complete', {
    summaryLength: summary.length,
    model: 'gemini-1.5-pro'
  });
}
```

### 2. Handler with Chunked Processing

```typescript
export async function transcribeRecording(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const { recordingId } = job.payload;

  // Step 1: Download (0-10%)
  progressCallback?.(0, 'Downloading audio file...');
  const audioFile = await downloadAudio(recordingId);
  progressCallback?.(10, 'Audio downloaded', {
    fileSize: audioFile.size,
    duration: audioFile.duration
  });

  // Step 2: Process chunks (10-80%)
  progressCallback?.(10, 'Starting transcription...');
  const chunks = splitIntoChunks(audioFile, 30); // 30-second chunks
  const transcripts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const transcript = await transcribeChunk(chunks[i]);
    transcripts.push(transcript);

    // Calculate progress within 10-80% range
    const baseProgress = 10;
    const rangeSize = 70;
    const chunkProgress = baseProgress + Math.floor((i / chunks.length) * rangeSize);

    progressCallback?.(chunkProgress, `Processing chunk ${i + 1}/${chunks.length}`, {
      chunkIndex: i,
      totalChunks: chunks.length,
      chunkDuration: chunks[i].duration
    });
  }

  // Step 3: Combine and save (80-100%)
  progressCallback?.(80, 'Combining transcripts...');
  const fullTranscript = combineTranscripts(transcripts);

  progressCallback?.(90, 'Saving transcription...');
  await saveTranscription(recordingId, fullTranscript);

  progressCallback?.(100, 'Transcription complete', {
    wordCount: fullTranscript.words.length,
    confidence: fullTranscript.confidence,
    totalDuration: audioFile.duration
  });
}
```

### 3. Handler with Multiple Phases

```typescript
export async function generateEmbeddings(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const { recordingId } = job.payload;

  // Phase 1: Fetch data (0-10%)
  progressCallback?.(0, 'Fetching transcript chunks...');
  const chunks = await getTranscriptChunks(recordingId);
  progressCallback?.(10, `Found ${chunks.length} chunks to process`);

  // Phase 2: Generate embeddings (10-80%)
  progressCallback?.(10, 'Generating embeddings...');
  const batchSize = 50;
  let processedCount = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await generateEmbeddingsBatch(batch);

    processedCount += batch.length;
    const progress = 10 + Math.floor((processedCount / chunks.length) * 70);

    progressCallback?.(progress, `Generated ${processedCount}/${chunks.length} embeddings`, {
      batchNumber: Math.floor(i / batchSize) + 1,
      totalBatches: Math.ceil(chunks.length / batchSize),
      processedCount,
      totalChunks: chunks.length
    });
  }

  // Phase 3: Save to database (80-100%)
  progressCallback?.(80, 'Saving embeddings to database...');
  await saveEmbeddings(recordingId, embeddings);

  progressCallback?.(90, 'Updating vector index...');
  await updateVectorIndex(recordingId);

  progressCallback?.(100, 'Embeddings generation complete', {
    totalEmbeddings: embeddings.length,
    vectorDimensions: embeddings[0].length,
    model: 'text-embedding-3-small'
  });
}
```

### 4. Handler with External API Calls

```typescript
export async function processWithExternalAPI(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const { recordingId } = job.payload;

  progressCallback?.(0, 'Preparing request...');

  const data = await prepareData(recordingId);

  progressCallback?.(10, 'Sending to external API...', {
    endpoint: 'https://api.example.com/process',
    dataSize: data.length
  });

  // Poll external API for completion
  const taskId = await initiateProcessing(data);
  let status = 'pending';
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes with 5-second intervals

  while (status === 'pending' && attempts < maxAttempts) {
    await sleep(5000);
    attempts++;

    const response = await checkStatus(taskId);
    status = response.status;

    // Progress from 10% to 80% based on attempts
    const progress = 10 + Math.floor((attempts / maxAttempts) * 70);

    progressCallback?.(progress, `Processing (attempt ${attempts}/${maxAttempts})...`, {
      taskId,
      status,
      elapsedSeconds: attempts * 5
    });

    if (status === 'completed') break;
    if (status === 'failed') throw new Error('External API processing failed');
  }

  if (status !== 'completed') {
    throw new Error('Processing timed out');
  }

  progressCallback?.(80, 'Retrieving results...');
  const results = await getResults(taskId);

  progressCallback?.(90, 'Saving results...');
  await saveResults(recordingId, results);

  progressCallback?.(100, 'Processing complete', {
    resultsSize: results.length,
    totalTime: attempts * 5
  });
}
```

### 5. Handler with Error Recovery

```typescript
export async function reliableHandler(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const { recordingId } = job.payload;

  try {
    progressCallback?.(0, 'Starting process...');

    // Step 1
    progressCallback?.(10, 'Step 1: Fetching data...');
    const data = await fetchData(recordingId);

    // Step 2 with retry logic
    progressCallback?.(30, 'Step 2: Processing data...');
    let result;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        result = await processData(data);
        break;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) throw error;

        progressCallback?.(40, `Retrying step 2 (${retries}/${maxRetries})...`, {
          error: error.message,
          retryAttempt: retries
        });

        await sleep(1000 * retries); // Exponential backoff
      }
    }

    // Step 3
    progressCallback?.(70, 'Step 3: Saving results...');
    await saveResults(recordingId, result);

    progressCallback?.(100, 'Process completed successfully');

  } catch (error) {
    // Progress callback can still be used even on error
    progressCallback?.(-1, `Failed: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    throw error; // Re-throw for job processor to handle
  }
}
```

---

## Best Practices

### 1. Progress Distribution

Divide 0-100% range logically across steps:

```typescript
// Bad: Jumps directly to 100%
progressCallback?.(0, 'Starting...');
// ... do all work ...
progressCallback?.(100, 'Done');

// Good: Incremental progress
progressCallback?.(0, 'Starting...');        // 0%
progressCallback?.(20, 'Step 1 done');       // 20%
progressCallback?.(50, 'Step 2 done');       // 50%
progressCallback?.(80, 'Step 3 done');       // 80%
progressCallback?.(100, 'All done');         // 100%
```

### 2. Meaningful Messages

```typescript
// Bad: Generic messages
progressCallback?.(50, 'Processing...');

// Good: Specific, actionable messages
progressCallback?.(50, 'Transcribing audio chunk 5 of 10', {
  chunkIndex: 5,
  totalChunks: 10
});
```

### 3. Include Useful Data

```typescript
progressCallback?.(75, 'Saving to database', {
  recordCount: 150,
  tableName: 'transcript_chunks',
  batchSize: 50
});
```

### 4. Handle Errors Gracefully

```typescript
try {
  await riskyOperation();
} catch (error) {
  progressCallback?.(50, `Error occurred: ${error.message}`, {
    error: error.message,
    recoveryAction: 'Retrying with fallback method'
  });

  // Try fallback
  await fallbackOperation();
}
```

### 5. Always Report 0% and 100%

```typescript
export async function myHandler(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  // Always start at 0%
  progressCallback?.(0, 'Starting...');

  try {
    // ... do work ...

    // Always end at 100%
    progressCallback?.(100, 'Completed successfully');
  } catch (error) {
    // Even on error, report progress
    progressCallback?.(-1, 'Failed', { error: error.message });
    throw error;
  }
}
```

---

## Testing Progress Callbacks

### Unit Test Example

```typescript
import { expect, test, vi } from 'vitest';

test('handler reports progress correctly', async () => {
  const progressCallback = vi.fn();

  const job = {
    id: 'test-job',
    type: 'transcribe',
    payload: { recordingId: 'test-recording' },
    // ... other fields
  };

  await transcribeRecording(job, progressCallback);

  // Verify progress calls
  expect(progressCallback).toHaveBeenCalledWith(0, 'Downloading audio file...');
  expect(progressCallback).toHaveBeenCalledWith(
    expect.any(Number),
    expect.stringContaining('chunk')
  );
  expect(progressCallback).toHaveBeenCalledWith(100, 'Transcription complete');

  // Verify progress values are valid
  for (const call of progressCallback.mock.calls) {
    const [percent] = call;
    expect(percent).toBeGreaterThanOrEqual(-1); // -1 for errors
    expect(percent).toBeLessThanOrEqual(100);
  }
});
```

### Manual Testing

```typescript
// In a script or console
import { transcribeRecording } from './handlers/transcribe';

const testJob = {
  id: 'test-job',
  type: 'transcribe' as const,
  status: 'pending' as const,
  payload: { recordingId: 'your-recording-id' },
  attempts: 0,
  max_attempts: 3,
  // ... other required fields
};

const progressCallback = (percent: number, message: string, data?: any) => {
  console.log(`[${percent}%] ${message}`, data || '');
};

await transcribeRecording(testJob, progressCallback);
```

---

## Migration Checklist

When updating existing handlers:

- [ ] Add `progressCallback?: ProgressCallback` parameter
- [ ] Report 0% at start
- [ ] Report 100% at end
- [ ] Add progress updates for long-running operations
- [ ] Include meaningful messages and data
- [ ] Handle errors with progress reporting
- [ ] Test with and without callback (backward compatibility)
- [ ] Update type signatures in handler registry

---

## Performance Considerations

### Throttling

Don't call `progressCallback` too frequently:

```typescript
// Bad: Callback on every iteration
for (let i = 0; i < 10000; i++) {
  await processItem(items[i]);
  progressCallback?.(i / 10000 * 100, `Processing ${i}`);
}

// Good: Callback every N items or every percentage point
for (let i = 0; i < 10000; i++) {
  await processItem(items[i]);

  if (i % 100 === 0) { // Every 100 items
    const percent = Math.floor((i / 10000) * 100);
    progressCallback?.(percent, `Processed ${i} of 10000 items`);
  }
}
```

### Async Safety

Progress callbacks are fire-and-forget:

```typescript
// The callback doesn't block execution
progressCallback?.(50, 'Halfway done'); // Returns immediately
await continueProcessing(); // Doesn't wait for DB update or SSE send
```

### Error Handling

Callbacks are optional and should never throw:

```typescript
// No need for try-catch around progress callbacks
progressCallback?.(25, 'Progress update'); // Safe even if undefined

// Internal implementation already handles errors
```

---

## Summary

To add progress tracking to a handler:

1. Add `progressCallback?: ProgressCallback` parameter
2. Call `progressCallback?.(percent, message, data)` at key points
3. Use 0-100 scale, with 0 at start and 100 at completion
4. Provide meaningful messages and optional data
5. Test with mock callback to verify coverage

That's it! The job processor handles all database updates and SSE streaming automatically.
