/**
 * Test Search Monitoring Integration
 *
 * Demonstrates how to integrate search monitoring and A/B testing
 * into the chat API or vector search service.
 *
 * Run with: tsx scripts/test-search-monitoring.ts
 */

import { searchMonitor } from '@/lib/services/search-monitoring';
import {
  assignVariant,
  getExperimentConfig,
  logExperimentResult,
  getAllVariants,
  getVariantDistribution,
  calculateSampleSize,
} from '@/lib/services/ab-testing';
import { nanoid } from 'nanoid';

/**
 * Simulate a search request with monitoring
 */
async function simulateSearch(
  query: string,
  orgId: string,
  userId: string
): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`🔍 Simulating search: "${query}"`);
  console.log('='.repeat(60));

  // 1. Generate unique query ID
  const queryId = nanoid();

  // 2. Start monitoring
  console.log('\n📊 Step 1: Start monitoring');
  searchMonitor.startSearch(queryId, query, orgId, userId);

  // 3. Assign A/B test variant (optional)
  console.log('\n🧪 Step 2: Assign A/B variant');
  const variant = assignVariant(userId, orgId);
  const config = getExperimentConfig(variant);

  console.log(`  Assigned variant: ${variant}`);
  console.log(`  Config:`, {
    threshold: config.threshold,
    useHybrid: config.useHybrid,
    useAgentic: config.useAgentic,
    maxChunks: config.maxChunks,
  });

  // 4. Update monitoring config
  searchMonitor.updateConfig(queryId, {
    strategy: variant,
    threshold: config.threshold,
    useHybrid: config.useHybrid,
    useAgentic: config.useAgentic,
  });

  // 5. Simulate search execution
  console.log('\n🔎 Step 3: Execute search (simulated)');
  const embeddingStart = Date.now();
  await sleep(50 + Math.random() * 100); // Simulate embedding generation
  const embeddingTime = Date.now() - embeddingStart;

  const searchStart = Date.now();
  await sleep(200 + Math.random() * 500); // Simulate vector search
  const searchTime = Date.now() - searchStart;

  // Simulate results (random for demo)
  const sourcesFound = Math.random() > 0.2 ? Math.floor(Math.random() * 10) + 1 : 0;
  const avgSimilarity = sourcesFound > 0 ? 0.5 + Math.random() * 0.4 : 0;
  const minSimilarity = sourcesFound > 0 ? avgSimilarity - 0.1 : 0;
  const maxSimilarity = sourcesFound > 0 ? avgSimilarity + 0.1 : 0;

  console.log(`  Embedding time: ${embeddingTime}ms`);
  console.log(`  Search time: ${searchTime}ms`);
  console.log(`  Sources found: ${sourcesFound}`);
  console.log(`  Avg similarity: ${avgSimilarity.toFixed(3)}`);

  // 6. Handle retries if needed
  let retrievalAttempts = 1;
  if (sourcesFound === 0) {
    console.log('\n🔄 Step 4: No results, attempting retry');
    searchMonitor.recordRetry(queryId, 'lowerThreshold');
    retrievalAttempts++;

    // Simulate retry
    await sleep(150 + Math.random() * 300);

    // Sometimes retry succeeds
    if (Math.random() > 0.5) {
      console.log('  ✅ Retry succeeded!');
    } else {
      console.log('  ❌ Retry failed, trying hybrid search');
      searchMonitor.recordRetry(queryId, 'hybrid');
      retrievalAttempts++;
      await sleep(200 + Math.random() * 400);
    }
  }

  // 7. End monitoring
  console.log('\n✅ Step 5: End monitoring');
  searchMonitor.endSearch(queryId, {
    sourcesFound,
    avgSimilarity,
    minSimilarity,
    maxSimilarity,
    embeddingTimeMs: embeddingTime,
    searchTimeMs: searchTime,
    retrievalAttempts,
    retriedWithLowerThreshold: retrievalAttempts > 1,
    retriedWithHybrid: retrievalAttempts > 2,
    retriedWithKeyword: false,
    usedToolFallback: false,
    searchFailureAlerted: sourcesFound === 0 && retrievalAttempts > 1,
  });

  // 8. Log A/B test result (optional)
  console.log('\n📈 Step 6: Log A/B test result');
  await logExperimentResult(variant, query, orgId, userId, {
    sourcesFound,
    retrievalAttempts,
    avgSimilarity,
    timeMs: embeddingTime + searchTime,
  });

  console.log('\n✅ Search simulation complete!\n');
}

/**
 * Run multiple simulations to build up metrics
 */
async function runSimulations(): Promise<void> {
  console.log('\n🚀 Search Monitoring Integration Test\n');
  console.log('This script demonstrates how to integrate monitoring into search.\n');

  // Show A/B testing setup
  console.log('📊 A/B Testing Configuration:\n');
  console.log('Available variants:', getAllVariants().join(', '));
  console.log('Variant distribution:', getVariantDistribution());

  // Calculate sample size
  const sampleSize = calculateSampleSize(0.70, 0.10);
  console.log(`\nFor 10% improvement at 95% confidence: ${sampleSize} samples per variant\n`);

  // Test queries
  const queries = [
    'authentication flow',
    'how do I deploy?',
    'database',
    'what are the best practices for error handling?',
    'API',
  ];

  const testOrgId = 'test-org-123';
  const testUserId = 'test-user-456';

  // Run simulations
  for (const query of queries) {
    await simulateSearch(query, testOrgId, testUserId);
    await sleep(500); // Small delay between searches
  }

  // Show summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 METRICS SUMMARY');
  console.log('='.repeat(60) + '\n');

  const summary = searchMonitor.getMetricsSummary();
  console.log('Total Searches:', summary.totalSearches);
  console.log('Success Rate:', `${(summary.successRate * 100).toFixed(1)}%`);
  console.log('Avg Similarity:', summary.avgSimilarity.toFixed(3));
  console.log('Avg Time:', `${summary.avgTimeMs.toFixed(0)}ms`);
  console.log('Retry Rate:', `${(summary.retryRate * 100).toFixed(1)}%`);

  console.log('\n' + '='.repeat(60));
  console.log('📋 RECENT METRICS (Last 5 searches)');
  console.log('='.repeat(60) + '\n');

  const recent = searchMonitor.getRecentMetrics(5);
  recent.forEach((metric, idx) => {
    console.log(`${idx + 1}. Query: "${metric.query.substring(0, 40)}..."`);
    console.log(`   Strategy: ${metric.strategy}`);
    console.log(`   Success: ${metric.success ? '✅' : '❌'}`);
    console.log(`   Sources: ${metric.sourcesFound}`);
    console.log(`   Similarity: ${metric.avgSimilarity.toFixed(3)}`);
    console.log(`   Time: ${metric.totalTimeMs}ms`);
    console.log(`   Retries: ${metric.retrievalAttempts}\n`);
  });

  console.log('✅ Test complete!\n');
  console.log('💡 Next steps:');
  console.log('   1. Integrate this pattern into /app/api/chat/route.ts');
  console.log('   2. Enable production metrics collection');
  console.log('   3. Run: npm run analyze:search to analyze results');
  console.log('   4. Set up dashboards and alerts\n');
}

/**
 * Helper to sleep for ms milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main() {
  try {
    await runSimulations();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
