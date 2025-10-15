#!/usr/bin/env tsx

/**
 * Test script for LLM streaming functionality
 * Tests the streaming helpers and handlers
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { streamDocumentGeneration } from '@/lib/services/llm-streaming-helper';
import { streamingManager } from '@/lib/services/streaming-processor';

// Mock recording ID
const TEST_RECORDING_ID = 'test-recording-123';

async function testDocumentStreaming() {
  console.log('🧪 Testing Document Generation Streaming...\n');

  // Initialize Google AI
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('❌ Missing GOOGLE_AI_API_KEY environment variable');
    process.exit(1);
  }

  const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = googleAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  // Test prompt
  const prompt = `Convert this transcript into a well-structured document:

Hello everyone, today we're going to learn how to use the new recording feature.
First, click on the record button in the top right corner.
Then select your screen or window to record.
The recording will start automatically.
When you're done, click the stop button.
Your recording will be processed and saved.`;

  // Set up mock SSE connection
  const mockController = {
    enqueue: (data: any) => {
      const text = new TextDecoder().decode(data);
      console.log('📨 SSE Event:', text);
    },
    close: () => {
      console.log('🔌 SSE Connection closed');
    },
  } as any;

  // Register mock connection
  streamingManager.register(TEST_RECORDING_ID, mockController);

  try {
    console.log('📤 Starting streaming generation...\n');
    const startTime = Date.now();

    const result = await streamDocumentGeneration(model, prompt, {
      recordingId: TEST_RECORDING_ID,
      chunkBufferSize: 100,
      chunkDelayMs: 50,
      punctuationChunking: true,
      progressUpdateInterval: 3,
    });

    const duration = Date.now() - startTime;

    console.log('\n✅ Streaming completed successfully!');
    console.log('📊 Results:');
    console.log(`  - Full text length: ${result.fullText.length} characters`);
    console.log(`  - Chunk count: ${result.chunkCount}`);
    console.log(`  - Total time: ${result.totalTime}ms`);
    console.log(`  - Streamed to client: ${result.streamedToClient}`);
    console.log(`  - Duration: ${duration}ms`);
    console.log('\n📝 Generated content preview:');
    console.log(result.fullText.substring(0, 200) + '...');

  } catch (error) {
    console.error('❌ Error during streaming:', error);
  } finally {
    // Clean up
    streamingManager.disconnect(TEST_RECORDING_ID);
  }
}

async function testEmbeddingProgress() {
  console.log('\n🧪 Testing Embedding Progress Updates...\n');

  // Set up mock SSE connection
  const mockController = {
    enqueue: (data: any) => {
      const text = new TextDecoder().decode(data);
      const lines = text.split('\n').filter(line => line.startsWith('data: '));
      for (const line of lines) {
        try {
          const event = JSON.parse(line.substring(6));
          if (event.type === 'progress') {
            console.log(`📊 Progress: ${event.progress}% - ${event.message}`);
          }
        } catch {}
      }
    },
    close: () => {},
  } as any;

  streamingManager.register(TEST_RECORDING_ID, mockController);

  // Simulate embedding progress
  for (let i = 1; i <= 10; i++) {
    streamingManager.sendProgress(
      TEST_RECORDING_ID,
      'embeddings',
      i * 10,
      `Processing chunk ${i} of 10`
    );
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  streamingManager.sendComplete(TEST_RECORDING_ID, 'Embedding generation complete');
  streamingManager.disconnect(TEST_RECORDING_ID);

  console.log('\n✅ Embedding progress test completed!');
}

async function main() {
  console.log('🚀 LLM Streaming Test Suite\n');
  console.log('=' .repeat(50));

  // Test document streaming
  await testDocumentStreaming();

  // Test embedding progress
  await testEmbeddingProgress();

  console.log('\n' + '=' .repeat(50));
  console.log('✅ All tests completed!');
  process.exit(0);
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});