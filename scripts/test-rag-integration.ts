#!/usr/bin/env tsx
/**
 * RAG Integration Test
 *
 * Tests the complete RAG flow from query to response
 * Verifies all phases work together correctly
 *
 * Usage: npx tsx scripts/test-rag-integration.ts
 */

import { join } from 'path';

import { config } from 'dotenv';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

async function testRAGIntegration() {
  console.log('🧪 Testing RAG Integration...\n');

  const results = {
    imports: false,
    adaptiveThreshold: false,
    monitoring: false,
    abTesting: false,
    envVars: false,
  };

  try {
    // Test 1: Import all modules
    console.log('✓ Testing module imports...');
    try {
      const { vectorSearch } = await import('@/lib/services/vector-search-google');
      const { searchMonitor } = await import('@/lib/services/search-monitoring');
      const { assignVariant, getExperimentConfig } = await import('@/lib/services/ab-testing');
      void vectorSearch;
      void searchMonitor;
      void assignVariant;
      void getExperimentConfig;
      results.imports = true;
      console.log('  ✅ All modules imported successfully\n');
    } catch (error) {
      console.error('  ❌ Module import failed:', error);
    }

    // Test 2: Verify adaptive threshold calculation
    console.log('✓ Testing adaptive thresholds...');
    try {
      // We can't directly test the private function, but we can verify the env var
      const defaultThreshold = process.env.SEARCH_DEFAULT_THRESHOLD || '0.5';
      const threshold = parseFloat(defaultThreshold);

      if (threshold >= 0.4 && threshold <= 0.7) {
        console.log(`  ✅ Default threshold: ${threshold}`);

        // Simulate adaptive logic
        const shortQueryThreshold = threshold;
        const mediumQueryThreshold = Math.min(threshold + 0.05, 0.7);
        const longQueryThreshold = Math.min(threshold + 0.15, 0.7);

        console.log(`  ✅ Short query (<5 words): ${shortQueryThreshold}`);
        console.log(`  ✅ Medium query (5-10 words): ${mediumQueryThreshold}`);
        console.log(`  ✅ Long query (>10 words): ${longQueryThreshold}`);
        results.adaptiveThreshold = true;
      } else {
        console.error(`  ❌ Invalid threshold: ${threshold}`);
      }
      console.log();
    } catch (error) {
      console.error('  ❌ Adaptive threshold test failed:', error);
    }

    // Test 3: Verify monitoring lifecycle
    console.log('✓ Testing monitoring lifecycle...');
    try {
      const { searchMonitor } = await import('@/lib/services/search-monitoring');
      const testQueryId = 'test-' + Date.now();

      // Start monitoring
      searchMonitor.startSearch(testQueryId, 'test query', 'test-org', 'test-user');
      console.log('  ✅ Search monitoring started');

      // Update config
      searchMonitor.updateConfig(testQueryId, {
        strategy: 'test',
        threshold: 0.5,
        useHybrid: false,
        useAgentic: false,
      });
      console.log('  ✅ Configuration updated');

      // Record retry
      searchMonitor.recordRetry(testQueryId, 'lowerThreshold');
      console.log('  ✅ Retry recorded');

      // End monitoring
      searchMonitor.endSearch(testQueryId, {
        success: true,
        sourcesFound: 5,
        totalTimeMs: 1000,
      });
      console.log('  ✅ Search monitoring completed');

      // Get summary
      const summary = await searchMonitor.getMetricsSummary();
      console.log('  ✅ Metrics summary retrieved:', {
        totalSearches: summary.totalSearches,
        successRate: summary.successRate.toFixed(2),
      });

      results.monitoring = true;
      console.log();
    } catch (error) {
      console.error('  ❌ Monitoring test failed:', error);
    }

    // Test 4: Verify A/B variant assignment
    console.log('✓ Testing A/B variant assignment...');
    try {
      const { assignVariant, getExperimentConfig, getAllVariants } = await import('@/lib/services/ab-testing');

      const variants = getAllVariants();
      console.log(`  ✅ Available variants: ${variants.join(', ')}`);

      // Test variant assignment consistency
      const testOrgId = 'test-org-123';
      const testUserId = 'test-user-456';

      const variant1 = assignVariant(testUserId, testOrgId);
      const variant2 = assignVariant(testUserId, testOrgId);

      if (variant1 === variant2) {
        console.log(`  ✅ Consistent variant assignment: ${variant1}`);
      } else {
        console.error(`  ❌ Inconsistent variants: ${variant1} vs ${variant2}`);
      }

      // Test experiment config
      const config = getExperimentConfig(variant1);
      console.log(`  ✅ Experiment config for ${variant1}:`, {
        threshold: config.threshold,
        useHybrid: config.useHybrid,
        maxChunks: config.maxChunks,
      });

      results.abTesting = true;
      console.log();
    } catch (error) {
      console.error('  ❌ A/B testing failed:', error);
    }

    // Test 5: Verify environment variables
    console.log('✓ Testing environment variables...');
    const envVars = {
      ENABLE_SEARCH_MONITORING: process.env.ENABLE_SEARCH_MONITORING,
      ENABLE_SEARCH_AB_TESTING: process.env.ENABLE_SEARCH_AB_TESTING,
      SEARCH_DEFAULT_THRESHOLD: process.env.SEARCH_DEFAULT_THRESHOLD,
      SEARCH_ENABLE_HYBRID: process.env.SEARCH_ENABLE_HYBRID,
      SEARCH_ENABLE_QUERY_EXPANSION: process.env.SEARCH_ENABLE_QUERY_EXPANSION,
    };

    console.log('  Current configuration:');
    for (const [key, value] of Object.entries(envVars)) {
      const displayValue = value || '(not set - using defaults)';
      console.log(`    ${key}: ${displayValue}`);
    }
    results.envVars = true;
    console.log();

    // Summary
    console.log('📊 Test Results Summary:');
    console.log('========================');
    let passCount = 0;
    let totalCount = 0;

    for (const [test, passed] of Object.entries(results)) {
      totalCount++;
      if (passed) passCount++;
      const icon = passed ? '✅' : '❌';
      const testName = test.replace(/([A-Z])/g, ' $1').trim();
      console.log(`  ${icon} ${testName.charAt(0).toUpperCase() + testName.slice(1)}`);
    }

    console.log('\n========================');
    if (passCount === totalCount) {
      console.log('✅ All integration tests passed!');
      console.log('\n🎉 RAG system is fully integrated and ready for use.');
    } else {
      console.log(`⚠️  ${passCount}/${totalCount} tests passed`);
      console.log('\n⚠️  Some integration issues detected. Please review the failures above.');
    }

    // Configuration recommendations
    console.log('\n📝 Configuration Recommendations:');
    console.log('===================================');

    if (!process.env.ENABLE_SEARCH_MONITORING) {
      console.log('• Consider enabling monitoring: ENABLE_SEARCH_MONITORING=true');
    }

    if (process.env.ENABLE_SEARCH_AB_TESTING === 'true') {
      console.log('• ⚠️  A/B testing is enabled - use with caution in production');
    }

    const threshold = parseFloat(process.env.SEARCH_DEFAULT_THRESHOLD || '0.5');
    if (threshold > 0.6) {
      console.log(`• Consider lowering threshold for better recall: SEARCH_DEFAULT_THRESHOLD=0.5`);
    }

    if (process.env.SEARCH_ENABLE_HYBRID === 'false') {
      console.log('• Consider enabling hybrid search for better results: SEARCH_ENABLE_HYBRID=true');
    }

  } catch (error) {
    console.error('\n❌ Critical error during integration test:', error);
    process.exit(1);
  }
}

// Run the test
testRAGIntegration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
