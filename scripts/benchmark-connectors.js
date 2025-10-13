#!/usr/bin/env node

/**
 * Connector System Performance Benchmark
 *
 * This script measures the performance of the Phase 5 connector system
 * across various operations and provides detailed metrics.
 *
 * Usage: node scripts/benchmark-connectors.js
 */

const { createClient } = require('@supabase/supabase-js');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test data
const TEST_ORG_ID = 'test-org-' + Date.now();
const TEST_USER_ID = 'test-user-' + Date.now();

// Benchmark results
const results = {
  timestamp: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: process.memoryUsage()
  },
  benchmarks: {}
};

/**
 * Utility: Measure execution time
 */
async function measureTime(name, fn) {
  const start = performance.now();
  let result;
  let error;

  try {
    result = await fn();
  } catch (e) {
    error = e;
  }

  const duration = performance.now() - start;

  return {
    name,
    duration: Math.round(duration * 100) / 100,
    success: !error,
    error: error?.message
  };
}

/**
 * Utility: Run benchmark multiple times
 */
async function runBenchmark(name, fn, iterations = 10) {
  console.log(`\nRunning benchmark: ${name}`);
  console.log('='.repeat(50));

  const measurements = [];

  for (let i = 0; i < iterations; i++) {
    process.stdout.write(`Iteration ${i + 1}/${iterations}...`);
    const measurement = await measureTime(`${name}_${i}`, fn);
    measurements.push(measurement.duration);
    process.stdout.write(` ${measurement.duration}ms\n`);

    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Calculate statistics
  measurements.sort((a, b) => a - b);
  const stats = {
    iterations,
    min: measurements[0],
    max: measurements[measurements.length - 1],
    mean: measurements.reduce((a, b) => a + b, 0) / measurements.length,
    median: measurements[Math.floor(measurements.length / 2)],
    p95: measurements[Math.floor(measurements.length * 0.95)],
    p99: measurements[Math.floor(measurements.length * 0.99)] || measurements[measurements.length - 1]
  };

  console.log('\nStatistics:');
  console.log(`  Min: ${stats.min}ms`);
  console.log(`  Max: ${stats.max}ms`);
  console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
  console.log(`  Median: ${stats.median}ms`);
  console.log(`  P95: ${stats.p95}ms`);
  console.log(`  P99: ${stats.p99}ms`);

  results.benchmarks[name] = stats;
  return stats;
}

/**
 * Benchmark 1: Database Query Performance
 */
async function benchmarkDatabaseQueries() {
  // Test: List connectors with pagination
  await runBenchmark('list_connectors_paginated', async () => {
    const { data, error } = await supabase
      .from('connector_configs')
      .select('*')
      .limit(20)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  });

  // Test: Complex join query
  await runBenchmark('complex_join_query', async () => {
    const { data, error } = await supabase
      .from('imported_documents')
      .select(`
        *,
        connector_configs (
          id,
          name,
          connector_type
        )
      `)
      .limit(50);

    if (error) throw error;
    return data;
  });

  // Test: Aggregation query
  await runBenchmark('aggregation_query', async () => {
    const { data, error } = await supabase
      .from('imported_documents')
      .select('connector_id', { count: 'exact' })
      .eq('sync_status', 'completed');

    if (error) throw error;
    return data;
  });

  // Test: Full-text search on chunks
  await runBenchmark('fulltext_search', async () => {
    const { data, error } = await supabase
      .from('transcript_chunks')
      .select('*')
      .textSearch('chunk_text', 'performance optimization')
      .limit(10);

    if (error) throw error;
    return data;
  });
}

/**
 * Benchmark 2: Vector Search Performance
 */
async function benchmarkVectorSearch() {
  // Generate random embedding
  const generateEmbedding = () => {
    const embedding = [];
    for (let i = 0; i < 768; i++) {
      embedding.push(Math.random() * 2 - 1);
    }
    return embedding;
  };

  const testEmbedding = generateEmbedding();

  // Test: Vector similarity search
  await runBenchmark('vector_similarity_search', async () => {
    const { data, error } = await supabase.rpc('search_similar_chunks', {
      query_embedding: testEmbedding,
      similarity_threshold: 0.7,
      match_count: 10
    });

    if (error && error.message.includes('function') && error.message.includes('does not exist')) {
      // Function doesn't exist, skip
      return [];
    }
    if (error) throw error;
    return data;
  });

  // Test: Hybrid search (vector + keyword)
  await runBenchmark('hybrid_search', async () => {
    const { data, error } = await supabase.rpc('hybrid_search', {
      query_embedding: testEmbedding,
      keywords: 'connector sync performance',
      limit: 20
    });

    if (error && error.message.includes('function') && error.message.includes('does not exist')) {
      // Function doesn't exist, skip
      return [];
    }
    if (error) throw error;
    return data;
  });
}

/**
 * Benchmark 3: Batch Insert Performance
 */
async function benchmarkBatchInserts() {
  // Generate test data
  const generateTestDocuments = (count) => {
    const docs = [];
    for (let i = 0; i < count; i++) {
      docs.push({
        connector_id: 'test-connector',
        org_id: TEST_ORG_ID,
        external_id: `doc-${i}`,
        title: `Test Document ${i}`,
        content: 'Lorem ipsum '.repeat(100),
        file_type: 'text/plain',
        sync_status: 'pending',
        metadata: { index: i }
      });
    }
    return docs;
  };

  // Test: Small batch insert (10 records)
  await runBenchmark('batch_insert_small', async () => {
    const docs = generateTestDocuments(10);
    const { error } = await supabase
      .from('imported_documents')
      .insert(docs);

    if (error) throw error;

    // Cleanup
    await supabase
      .from('imported_documents')
      .delete()
      .eq('org_id', TEST_ORG_ID);
  }, 5);

  // Test: Medium batch insert (50 records)
  await runBenchmark('batch_insert_medium', async () => {
    const docs = generateTestDocuments(50);
    const { error } = await supabase
      .from('imported_documents')
      .insert(docs);

    if (error) throw error;

    // Cleanup
    await supabase
      .from('imported_documents')
      .delete()
      .eq('org_id', TEST_ORG_ID);
  }, 5);

  // Test: Large batch insert (100 records)
  await runBenchmark('batch_insert_large', async () => {
    const docs = generateTestDocuments(100);
    const { error } = await supabase
      .from('imported_documents')
      .insert(docs);

    if (error) throw error;

    // Cleanup
    await supabase
      .from('imported_documents')
      .delete()
      .eq('org_id', TEST_ORG_ID);
  }, 3);
}

/**
 * Benchmark 4: Job Queue Performance
 */
async function benchmarkJobQueue() {
  // Test: Job insertion
  await runBenchmark('job_insertion', async () => {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        type: 'sync_connector',
        payload: { connectorId: 'test', orgId: TEST_ORG_ID },
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Cleanup
    await supabase.from('jobs').delete().eq('id', data.id);
    return data;
  });

  // Test: Job polling query
  await runBenchmark('job_polling', async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('run_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;
    return data;
  });

  // Test: Batch job creation
  await runBenchmark('batch_job_creation', async () => {
    const jobs = [];
    for (let i = 0; i < 20; i++) {
      jobs.push({
        type: 'process_imported_doc',
        payload: { documentId: `doc-${i}`, orgId: TEST_ORG_ID },
        status: 'pending'
      });
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert(jobs)
      .select();

    if (error) throw error;

    // Cleanup
    const ids = data.map(j => j.id);
    await supabase.from('jobs').delete().in('id', ids);
    return data;
  }, 5);
}

/**
 * Benchmark 5: Memory Usage Analysis
 */
async function benchmarkMemoryUsage() {
  const measurements = [];

  // Test: Large document processing simulation
  console.log('\nMemory Usage Analysis');
  console.log('='.repeat(50));

  for (let size of [1, 5, 10, 20, 50]) {
    const beforeMem = process.memoryUsage();

    // Simulate document processing
    const docs = [];
    for (let i = 0; i < size; i++) {
      docs.push({
        content: 'x'.repeat(1024 * 1024), // 1MB per doc
        metadata: { size: `${size}MB`, index: i }
      });
    }

    // Force some processing
    const processed = docs.map(d => ({
      ...d,
      chunks: d.content.match(/.{1,1000}/g) || []
    }));

    const afterMem = process.memoryUsage();

    const memDiff = {
      size: `${size}MB`,
      heapUsed: Math.round((afterMem.heapUsed - beforeMem.heapUsed) / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round((afterMem.heapTotal - beforeMem.heapTotal) / 1024 / 1024 * 100) / 100,
      external: Math.round((afterMem.external - beforeMem.external) / 1024 / 1024 * 100) / 100,
      arrayBuffers: Math.round((afterMem.arrayBuffers - beforeMem.arrayBuffers) / 1024 / 1024 * 100) / 100
    };

    measurements.push(memDiff);
    console.log(`${size}MB documents:`, memDiff);

    // Cleanup
    docs.length = 0;
    processed.length = 0;

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  results.benchmarks.memory_usage = measurements;
}

/**
 * Benchmark 6: Concurrent Operations
 */
async function benchmarkConcurrency() {
  console.log('\nConcurrency Testing');
  console.log('='.repeat(50));

  // Test: Concurrent reads
  const concurrentReads = async (concurrency) => {
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        supabase
          .from('connector_configs')
          .select('*')
          .limit(10)
      );
    }

    const start = performance.now();
    await Promise.all(promises);
    const duration = performance.now() - start;

    return {
      concurrency,
      totalDuration: Math.round(duration),
      avgDuration: Math.round(duration / concurrency)
    };
  };

  const concurrencyLevels = [1, 5, 10, 20, 50];
  const concurrencyResults = [];

  for (const level of concurrencyLevels) {
    const result = await concurrentReads(level);
    concurrencyResults.push(result);
    console.log(`${level} concurrent reads: ${result.totalDuration}ms total, ${result.avgDuration}ms avg`);
  }

  results.benchmarks.concurrency = concurrencyResults;
}

/**
 * Generate Performance Report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('PERFORMANCE REPORT');
  console.log('='.repeat(60));

  // Summary statistics
  const allDurations = [];
  for (const [name, stats] of Object.entries(results.benchmarks)) {
    if (stats.mean) {
      allDurations.push(stats.mean);
    }
  }

  if (allDurations.length > 0) {
    const avgDuration = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;
    console.log(`\nOverall Average Response Time: ${avgDuration.toFixed(2)}ms`);
  }

  // Performance grades
  console.log('\nPerformance Grades:');
  for (const [name, stats] of Object.entries(results.benchmarks)) {
    if (stats.mean) {
      let grade;
      if (stats.mean < 50) grade = 'A (Excellent)';
      else if (stats.mean < 100) grade = 'B (Good)';
      else if (stats.mean < 200) grade = 'C (Fair)';
      else if (stats.mean < 500) grade = 'D (Poor)';
      else grade = 'F (Critical)';

      console.log(`  ${name}: ${grade} (${stats.mean.toFixed(2)}ms)`);
    }
  }

  // Bottlenecks identified
  console.log('\nBottlenecks Identified:');
  const bottlenecks = [];
  for (const [name, stats] of Object.entries(results.benchmarks)) {
    if (stats.mean && stats.mean > 200) {
      bottlenecks.push({ name, duration: stats.mean });
    }
  }

  if (bottlenecks.length > 0) {
    bottlenecks.sort((a, b) => b.duration - a.duration);
    bottlenecks.forEach(b => {
      console.log(`  - ${b.name}: ${b.duration.toFixed(2)}ms`);
    });
  } else {
    console.log('  No critical bottlenecks found');
  }

  // Recommendations
  console.log('\nRecommendations:');
  if (results.benchmarks.list_connectors_paginated?.mean > 100) {
    console.log('  - Add index on connector_configs(created_at DESC)');
  }
  if (results.benchmarks.complex_join_query?.mean > 200) {
    console.log('  - Consider denormalizing frequently joined data');
  }
  if (results.benchmarks.vector_similarity_search?.mean > 500) {
    console.log('  - Implement vector index (IVFFlat or HNSW)');
  }
  if (results.benchmarks.batch_insert_large?.mean > 1000) {
    console.log('  - Reduce batch size or implement parallel insertion');
  }

  // Memory analysis
  if (results.benchmarks.memory_usage) {
    console.log('\nMemory Usage Efficiency:');
    const lastMeasurement = results.benchmarks.memory_usage[results.benchmarks.memory_usage.length - 1];
    if (lastMeasurement.heapUsed > 100) {
      console.log('  WARNING: High memory usage detected');
      console.log('  Consider implementing streaming for large documents');
    } else {
      console.log('  Memory usage is within acceptable limits');
    }
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Save results to file
 */
async function saveResults() {
  const filename = `benchmark-results-${Date.now()}.json`;
  const filepath = path.join(process.cwd(), 'benchmark-results', filename);

  try {
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${filepath}`);
  } catch (error) {
    console.error('Failed to save results:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting Connector System Performance Benchmark');
  console.log('='.repeat(60));

  try {
    // Run all benchmarks
    await benchmarkDatabaseQueries();
    await benchmarkVectorSearch();
    await benchmarkBatchInserts();
    await benchmarkJobQueue();
    await benchmarkMemoryUsage();
    await benchmarkConcurrency();

    // Generate and save report
    generateReport();
    await saveResults();

    console.log('\nBenchmark completed successfully!');
  } catch (error) {
    console.error('\nBenchmark failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  measureTime,
  runBenchmark,
  benchmarkDatabaseQueries,
  benchmarkVectorSearch,
  benchmarkBatchInserts,
  benchmarkJobQueue,
  benchmarkMemoryUsage,
  benchmarkConcurrency
};