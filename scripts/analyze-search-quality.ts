/**
 * Search Quality Metrics Analyzer
 *
 * Analyzes chat API logs and vector search performance to produce actionable metrics.
 * Run with: npm run analyze:search
 *
 * This script parses server logs and database queries to calculate:
 * - Search success rates
 * - Similarity score distributions
 * - Strategy effectiveness
 * - Performance metrics
 * - Failure patterns
 */

import { createClient } from '@/lib/supabase/admin';

interface SearchMetrics {
  // Success rates
  overallSuccessRate: number; // % queries returning > 0 results
  firstAttemptSuccessRate: number; // % queries succeeding without retry
  retrySuccessRate: number; // % failed queries rescued by retry

  // Similarity scores
  avgSimilarityScore: number;
  medianSimilarityScore: number;
  similarityDistribution: {
    below_50: number;
    between_50_60: number;
    between_60_70: number;
    above_70: number;
  };

  // Strategy effectiveness
  strategyBreakdown: {
    standard_search: number;
    hybrid_search: number;
    hierarchical_search: number;
    keyword_fallback: number;
    error_fallback: number;
  };

  // Threshold usage
  thresholdDistribution: {
    threshold_50: number;
    threshold_55: number;
    threshold_65: number;
    threshold_70: number;
    other: number; // For thresholds that don't match the standard buckets
  };

  // Performance
  avgRetrievalTimeMs: number;
  p95RetrievalTimeMs: number;
  p99RetrievalTimeMs: number;

  // Query characteristics
  avgQueryLength: number;
  avgQueryWordCount: number;
  shortQueryPercentage: number; // < 5 words

  // Tool fallback
  toolFallbackRate: number; // % queries using tools

  // Failure analysis
  zeroResultQueries: string[]; // Sample of queries with 0 results
  alertedFailures: number; // Queries that triggered search failure alert
  totalQueries: number;
}

/**
 * Parse server logs to extract search metrics
 * This simulates reading from a log aggregation service in production
 */
async function analyzeSearchQuality(
  startDate?: Date,
  endDate?: Date
): Promise<SearchMetrics> {
  const supabase = createClient();

  // In production, this would query from a log aggregation service
  // For now, we'll analyze from chat_messages table if it exists
  // Or provide guidance on log parsing

  console.log('📊 Analyzing search quality metrics...');
  console.log(
    `Time range: ${startDate?.toISOString() || 'all time'} to ${endDate?.toISOString() || 'now'}\n`
  );

  // Initialize metrics
  const metrics: SearchMetrics = {
    overallSuccessRate: 0,
    firstAttemptSuccessRate: 0,
    retrySuccessRate: 0,
    avgSimilarityScore: 0,
    medianSimilarityScore: 0,
    similarityDistribution: {
      below_50: 0,
      between_50_60: 0,
      between_60_70: 0,
      above_70: 0,
    },
    strategyBreakdown: {
      standard_search: 0,
      hybrid_search: 0,
      hierarchical_search: 0,
      keyword_fallback: 0,
      error_fallback: 0,
    },
    thresholdDistribution: {
      threshold_50: 0,
      threshold_55: 0,
      threshold_65: 0,
      threshold_70: 0,
      other: 0,
    },
    avgRetrievalTimeMs: 0,
    p95RetrievalTimeMs: 0,
    p99RetrievalTimeMs: 0,
    avgQueryLength: 0,
    avgQueryWordCount: 0,
    shortQueryPercentage: 0,
    toolFallbackRate: 0,
    zeroResultQueries: [],
    alertedFailures: 0,
    totalQueries: 0,
  };

  // Try to query chat_messages if available
  try {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data: messages, error } = await query;

    if (error) {
      console.warn('⚠️  Could not query chat_messages table:', error.message);
      console.log(
        '\n💡 TIP: This script analyzes search logs from the chat API.'
      );
      console.log('   To collect metrics, ensure chat_messages table exists.');
      console.log('   In production, integrate with your log aggregation service.\n');
      return metrics;
    }

    if (!messages || messages.length === 0) {
      console.log('ℹ️  No messages found in the specified time range.');
      return metrics;
    }

    metrics.totalQueries = messages.length;

    // Analyze message metadata for search quality
    const queryMetrics = messages
      .map((msg) => {
        const metadata = msg.metadata as any;
        const content = msg.content as any;
        const text =
          typeof content === 'string'
            ? content
            : content?.text || content?.content || '';

        return {
          query: text,
          queryLength: text.length,
          queryWordCount: text.split(/\s+/).length,
          sourcesFound: metadata?.sourcesFound || 0,
          retrievalAttempts: metadata?.retrievalAttempts || 1,
          strategy: metadata?.strategy || 'unknown',
          threshold: metadata?.threshold || 0.7,
          retrievalTimeMs: metadata?.retrievalTimeMs || 0,
          avgSimilarity: metadata?.avgSimilarity || 0,
          usedTools: metadata?.toolCallCount > 0,
        };
      })
      .filter((m) => m.queryLength > 0);

    if (queryMetrics.length === 0) {
      console.log('ℹ️  No valid queries found with metadata.');
      return metrics;
    }

    // Calculate success rates
    const successfulQueries = queryMetrics.filter((m) => m.sourcesFound > 0);
    const firstAttemptSuccess = queryMetrics.filter(
      (m) => m.sourcesFound > 0 && m.retrievalAttempts === 1
    );
    const retrySuccess = queryMetrics.filter(
      (m) => m.sourcesFound > 0 && m.retrievalAttempts > 1
    );

    metrics.overallSuccessRate = successfulQueries.length / queryMetrics.length;
    metrics.firstAttemptSuccessRate =
      firstAttemptSuccess.length / queryMetrics.length;
    // Avoid division by zero: if all queries succeed on first attempt, retrySuccessRate is 0
    const queriesRequiringRetry = queryMetrics.length - firstAttemptSuccess.length;
    metrics.retrySuccessRate =
      queriesRequiringRetry > 0
        ? retrySuccess.length / queriesRequiringRetry
        : 0;

    // Similarity scores
    const similarities = queryMetrics
      .filter((m) => m.avgSimilarity > 0)
      .map((m) => m.avgSimilarity);

    if (similarities.length > 0) {
      metrics.avgSimilarityScore =
        similarities.reduce((a, b) => a + b, 0) / similarities.length;
      const sortedSimilarities = [...similarities].sort((a, b) => a - b);

      // Calculate median: average of two middle values for even-length arrays
      if (sortedSimilarities.length % 2 === 0) {
        const mid = sortedSimilarities.length / 2;
        metrics.medianSimilarityScore =
          (sortedSimilarities[mid - 1] + sortedSimilarities[mid]) / 2;
      } else {
        metrics.medianSimilarityScore =
          sortedSimilarities[Math.floor(sortedSimilarities.length / 2)];
      }

      // Distribution
      metrics.similarityDistribution.below_50 = similarities.filter(
        (s) => s < 0.5
      ).length;
      metrics.similarityDistribution.between_50_60 = similarities.filter(
        (s) => s >= 0.5 && s < 0.6
      ).length;
      metrics.similarityDistribution.between_60_70 = similarities.filter(
        (s) => s >= 0.6 && s < 0.7
      ).length;
      metrics.similarityDistribution.above_70 = similarities.filter(
        (s) => s >= 0.7
      ).length;
    }

    // Strategy breakdown
    queryMetrics.forEach((m) => {
      const strategy = m.strategy as keyof typeof metrics.strategyBreakdown;
      if (metrics.strategyBreakdown.hasOwnProperty(strategy)) {
        metrics.strategyBreakdown[strategy]++;
      }
    });

    // Threshold distribution
    queryMetrics.forEach((m) => {
      if (m.threshold === 0.5) {
        metrics.thresholdDistribution.threshold_50++;
      } else if (m.threshold === 0.55) {
        metrics.thresholdDistribution.threshold_55++;
      } else if (m.threshold === 0.65) {
        metrics.thresholdDistribution.threshold_65++;
      } else if (m.threshold >= 0.7) {
        metrics.thresholdDistribution.threshold_70++;
      } else {
        // Catch any thresholds that don't match the standard buckets
        metrics.thresholdDistribution.other++;
      }
    });

    // Performance metrics
    const retrievalTimes = queryMetrics
      .filter((m) => m.retrievalTimeMs > 0)
      .map((m) => m.retrievalTimeMs);

    if (retrievalTimes.length > 0) {
      metrics.avgRetrievalTimeMs =
        retrievalTimes.reduce((a, b) => a + b, 0) / retrievalTimes.length;
      const sortedTimes = [...retrievalTimes].sort((a, b) => a - b);
      metrics.p95RetrievalTimeMs =
        sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      metrics.p99RetrievalTimeMs =
        sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    }

    // Query characteristics
    metrics.avgQueryLength =
      queryMetrics.reduce((a, b) => a + b.queryLength, 0) / queryMetrics.length;
    metrics.avgQueryWordCount =
      queryMetrics.reduce((a, b) => a + b.queryWordCount, 0) /
      queryMetrics.length;
    metrics.shortQueryPercentage =
      queryMetrics.filter((m) => m.queryWordCount < 5).length /
      queryMetrics.length;

    // Tool fallback rate
    metrics.toolFallbackRate =
      queryMetrics.filter((m) => m.usedTools).length / queryMetrics.length;

    // Zero result queries (sample)
    const zeroResultQueries = queryMetrics
      .filter((m) => m.sourcesFound === 0)
      .map((m) => m.query)
      .slice(0, 10);
    metrics.zeroResultQueries = zeroResultQueries;

    // Alerted failures (queries with 0 results and multiple attempts)
    metrics.alertedFailures = queryMetrics.filter(
      (m) => m.sourcesFound === 0 && m.retrievalAttempts > 1
    ).length;
  } catch (error) {
    console.error('❌ Error analyzing search quality:', error);
    throw error;
  }

  return metrics;
}

/**
 * Format metrics for console output
 */
function displayMetrics(metrics: SearchMetrics) {
  console.log('📊 SEARCH QUALITY METRICS\n');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('📈 SUCCESS RATES');
  console.log('─────────────────────────────────────────────────');
  console.log(
    `  Overall Success Rate:      ${(metrics.overallSuccessRate * 100).toFixed(1)}%`
  );
  console.log(
    `  First Attempt Success:     ${(metrics.firstAttemptSuccessRate * 100).toFixed(1)}%`
  );
  console.log(
    `  Retry Success Rate:        ${(metrics.retrySuccessRate * 100).toFixed(1)}%`
  );
  console.log();

  console.log('🎯 SIMILARITY SCORES');
  console.log('─────────────────────────────────────────────────');
  console.log(`  Average:                   ${metrics.avgSimilarityScore.toFixed(3)}`);
  console.log(`  Median:                    ${metrics.medianSimilarityScore.toFixed(3)}`);
  console.log('  Distribution:');
  console.log(
    `    < 0.50:                  ${metrics.similarityDistribution.below_50} queries`
  );
  console.log(
    `    0.50 - 0.60:             ${metrics.similarityDistribution.between_50_60} queries`
  );
  console.log(
    `    0.60 - 0.70:             ${metrics.similarityDistribution.between_60_70} queries`
  );
  console.log(
    `    > 0.70:                  ${metrics.similarityDistribution.above_70} queries`
  );
  console.log();

  console.log('🔍 STRATEGY BREAKDOWN');
  console.log('─────────────────────────────────────────────────');
  console.log(
    `  Standard Search:           ${metrics.strategyBreakdown.standard_search} queries`
  );
  console.log(
    `  Hybrid Search:             ${metrics.strategyBreakdown.hybrid_search} queries`
  );
  console.log(
    `  Hierarchical Search:       ${metrics.strategyBreakdown.hierarchical_search} queries`
  );
  console.log(
    `  Keyword Fallback:          ${metrics.strategyBreakdown.keyword_fallback} queries`
  );
  console.log(
    `  Error Fallback:            ${metrics.strategyBreakdown.error_fallback} queries`
  );
  console.log();

  console.log('🎚️  THRESHOLD DISTRIBUTION');
  console.log('─────────────────────────────────────────────────');
  console.log(
    `  Threshold 0.50:            ${metrics.thresholdDistribution.threshold_50} queries`
  );
  console.log(
    `  Threshold 0.55:            ${metrics.thresholdDistribution.threshold_55} queries`
  );
  console.log(
    `  Threshold 0.65:            ${metrics.thresholdDistribution.threshold_65} queries`
  );
  console.log(
    `  Threshold 0.70+:           ${metrics.thresholdDistribution.threshold_70} queries`
  );
  console.log(
    `  Other thresholds:          ${metrics.thresholdDistribution.other} queries`
  );
  console.log();

  console.log('⚡ PERFORMANCE');
  console.log('─────────────────────────────────────────────────');
  console.log(
    `  Avg Retrieval Time:        ${metrics.avgRetrievalTimeMs.toFixed(0)}ms`
  );
  console.log(`  P95:                       ${metrics.p95RetrievalTimeMs.toFixed(0)}ms`);
  console.log(`  P99:                       ${metrics.p99RetrievalTimeMs.toFixed(0)}ms`);
  console.log();

  console.log('📝 QUERY CHARACTERISTICS');
  console.log('─────────────────────────────────────────────────');
  console.log(
    `  Avg Query Length:          ${metrics.avgQueryLength.toFixed(0)} chars`
  );
  console.log(
    `  Avg Word Count:            ${metrics.avgQueryWordCount.toFixed(1)} words`
  );
  console.log(
    `  Short Queries (< 5 words): ${(metrics.shortQueryPercentage * 100).toFixed(1)}%`
  );
  console.log();

  console.log('🛠️  TOOL USAGE');
  console.log('─────────────────────────────────────────────────');
  console.log(
    `  Tool Fallback Rate:        ${(metrics.toolFallbackRate * 100).toFixed(1)}%`
  );
  console.log();

  console.log('❌ FAILURE ANALYSIS');
  console.log('─────────────────────────────────────────────────');
  console.log(`  Total Queries Analyzed:    ${metrics.totalQueries}`);
  console.log(`  Zero Result Queries:       ${metrics.zeroResultQueries.length > 0 ? metrics.zeroResultQueries.length : 'None'}`);
  console.log(`  Alerted Failures:          ${metrics.alertedFailures}`);

  if (metrics.zeroResultQueries.length > 0) {
    console.log('\n  Sample Zero-Result Queries:');
    metrics.zeroResultQueries.forEach((query, idx) => {
      console.log(`    ${idx + 1}. ${query.substring(0, 80)}${query.length > 80 ? '...' : ''}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════');
}

/**
 * Generate recommendations based on metrics
 */
function generateRecommendations(metrics: SearchMetrics) {
  console.log('\n💡 RECOMMENDATIONS\n');
  console.log('─────────────────────────────────────────────────');

  const recommendations: string[] = [];

  // Success rate recommendations
  if (metrics.overallSuccessRate < 0.7) {
    recommendations.push(
      `⚠️  Low success rate (${(metrics.overallSuccessRate * 100).toFixed(1)}%). Consider lowering thresholds or enabling hybrid search by default.`
    );
  }

  if (metrics.retrySuccessRate > 0.3) {
    recommendations.push(
      `✅ Retry logic is effective (${(metrics.retrySuccessRate * 100).toFixed(1)}% rescue rate). Consider enabling more aggressive initial search.`
    );
  }

  // Similarity score recommendations
  if (metrics.avgSimilarityScore < 0.6) {
    recommendations.push(
      '⚠️  Low average similarity scores. Consider improving embeddings quality or query preprocessing.'
    );
  }

  if (metrics.similarityDistribution.below_50 > metrics.totalQueries * 0.2) {
    recommendations.push(
      '⚠️  Many results below 0.50 similarity. Review threshold tuning or enable reranking.'
    );
  }

  // Performance recommendations
  if (metrics.p95RetrievalTimeMs > 2000) {
    recommendations.push(
      `⚠️  High P95 latency (${metrics.p95RetrievalTimeMs.toFixed(0)}ms). Consider caching embeddings or optimizing vector index.`
    );
  }

  // Query characteristics
  if (metrics.shortQueryPercentage > 0.5) {
    recommendations.push(
      `ℹ️  ${(metrics.shortQueryPercentage * 100).toFixed(1)}% of queries are short (< 5 words). Ensure query expansion is working.`
    );
  }

  // Tool fallback
  if (metrics.toolFallbackRate > 0.3) {
    recommendations.push(
      `ℹ️  ${(metrics.toolFallbackRate * 100).toFixed(1)}% of queries use tool fallback. This may indicate RAG context is insufficient.`
    );
  }

  // Failure analysis
  if (metrics.alertedFailures > metrics.totalQueries * 0.1) {
    recommendations.push(
      `⚠️  ${metrics.alertedFailures} alerted failures (${((metrics.alertedFailures / metrics.totalQueries) * 100).toFixed(1)}%). Review zero-result queries for patterns.`
    );
  }

  if (recommendations.length === 0) {
    console.log('✅ Search quality looks good! No major issues detected.');
  } else {
    recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec}`);
    });
  }

  console.log('─────────────────────────────────────────────────\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Search Quality Metrics Analyzer\n');
  console.log('Analyzing search performance from chat API logs...\n');

  // Parse command line args for date range
  const args = process.argv.slice(2);
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (args.length >= 1) {
    const parsedStart = new Date(args[0]);
    // Validate that the date is valid (not NaN)
    if (isNaN(parsedStart.getTime())) {
      console.error(`❌ Invalid start date: ${args[0]}`);
      console.error('   Use ISO format (YYYY-MM-DD) or timestamp');
      process.exit(1);
    }
    startDate = parsedStart;
  }
  if (args.length >= 2) {
    const parsedEnd = new Date(args[1]);
    // Validate that the date is valid (not NaN)
    if (isNaN(parsedEnd.getTime())) {
      console.error(`❌ Invalid end date: ${args[1]}`);
      console.error('   Use ISO format (YYYY-MM-DD) or timestamp');
      process.exit(1);
    }
    endDate = parsedEnd;
  }

  try {
    const metrics = await analyzeSearchQuality(startDate, endDate);

    if (metrics.totalQueries === 0) {
      console.log('\n⚠️  No data available for analysis.');
      console.log('\n💡 To collect search metrics:');
      console.log('   1. Ensure chat_messages table exists in Supabase');
      console.log('   2. Store search metadata in message.metadata:');
      console.log('      - sourcesFound: number');
      console.log('      - retrievalAttempts: number');
      console.log('      - strategy: string');
      console.log('      - threshold: number');
      console.log('      - retrievalTimeMs: number');
      console.log('      - avgSimilarity: number');
      console.log('      - toolCallCount: number');
      console.log('\n   Or integrate with your log aggregation service.');
      return;
    }

    displayMetrics(metrics);
    generateRecommendations(metrics);

    console.log('✅ Analysis complete!\n');
  } catch (error) {
    console.error('\n❌ Analysis failed:', error);
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

export { analyzeSearchQuality, displayMetrics, generateRecommendations };
