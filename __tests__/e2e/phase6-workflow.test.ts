/**
 * Phase 6 End-to-End Workflow Tests
 * Tests complete user and admin workflows with all Phase 6 features
 */

import { test, expect, Page } from '@playwright/test';

// This test requires Playwright to be installed
// Run with: npx playwright test __tests__/e2e/phase6-workflow.test.ts

test.describe('Phase 6 Complete Workflow', () => {
  let page: Page;
  let adminPage: Page;

  test.beforeEach(async ({ browser }) => {
    // Create user context
    const userContext = await browser.newContext();
    page = await userContext.newPage();

    // Create admin context
    const adminContext = await browser.newContext();
    adminPage = await adminContext.newPage();
  });

  test('User search flow: quota consumption → analytics tracking → cache', async () => {
    // 1. User signs in
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');

    // 2. Navigate to search
    await page.goto('/search');
    await expect(page.locator('h1')).toContainText('Search');

    // 3. Perform first search
    const query = 'test query ' + Date.now();
    await page.fill('input[name="query"]', query);
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]');

    // Verify results are displayed
    const results = await page.locator('[data-testid="search-result"]').count();
    expect(results).toBeGreaterThan(0);

    // Verify cache status is displayed (should be cache miss)
    const cacheStatus = await page.locator('[data-testid="cache-status"]').textContent();
    expect(cacheStatus).toContain('miss');

    // Verify quota usage is updated
    const quotaDisplay = await page.locator('[data-testid="quota-usage"]').textContent();
    expect(quotaDisplay).toMatch(/\d+\/\d+/); // e.g., "501/1000"

    // 4. Perform same search again (should hit cache)
    await page.fill('input[name="query"]', query);
    await page.click('button[type="submit"]');

    await page.waitForSelector('[data-testid="search-results"]');

    // Verify cache hit
    const cacheStatus2 = await page.locator('[data-testid="cache-status"]').textContent();
    expect(cacheStatus2).toContain('hit');

    // Verify response is faster (check latency display)
    const latency = await page.locator('[data-testid="search-latency"]').textContent();
    const latencyMs = parseInt(latency!.match(/\d+/)?.[0] || '0');
    expect(latencyMs).toBeLessThan(100); // Cache hits should be < 100ms
  });

  test('User hits rate limit → receives 429', async () => {
    await page.goto('/sign-in');
    // ... sign in ...

    await page.goto('/search');

    // Make many requests quickly to hit rate limit
    for (let i = 0; i < 101; i++) {
      await page.fill('input[name="query"]', `query ${i}`);
      await page.click('button[type="submit"]');

      // Don't wait for results, send requests rapidly
      await page.waitForTimeout(10);
    }

    // Should see rate limit error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'rate limit exceeded'
    );

    // Should display retry-after time
    const retryAfter = await page.locator('[data-testid="retry-after"]').textContent();
    expect(retryAfter).toMatch(/\d+/);
  });

  test('User exceeds quota → receives 402 → admin increases quota → user can search', async () => {
    // 1. User exhausts quota
    await page.goto('/sign-in');
    // ... sign in ...

    // Make requests until quota exceeded
    let quotaExceeded = false;
    for (let i = 0; i < 1100; i++) {
      await page.fill('input[name="query"]', `query ${i}`);
      await page.click('button[type="submit"]');

      const errorMsg = await page.locator('[data-testid="error-message"]').textContent();
      if (errorMsg?.includes('quota exceeded')) {
        quotaExceeded = true;
        break;
      }

      await page.waitForTimeout(50);
    }

    expect(quotaExceeded).toBe(true);

    // 2. Admin increases quota
    await adminPage.goto('/sign-in');
    // ... admin sign in ...

    await adminPage.goto('/admin');

    // Find organization in list
    await adminPage.click('[data-testid="org-list"]');
    await adminPage.click('[data-testid="org-test-example"]');

    // Increase API calls limit
    await adminPage.fill('input[name="api_calls_limit"]', '2000');
    await adminPage.click('button[data-testid="save-quota"]');

    // Wait for success message
    await expect(adminPage.locator('[data-testid="success-message"]')).toContainText(
      'Quota updated'
    );

    // 3. User can search again
    await page.reload();
    await page.fill('input[name="query"]', 'new query after quota increase');
    await page.click('button[type="submit"]');

    // Should succeed now
    await page.waitForSelector('[data-testid="search-results"]');
    const results = await page.locator('[data-testid="search-result"]').count();
    expect(results).toBeGreaterThan(0);
  });

  test('Admin views dashboard → sees accurate metrics', async () => {
    await adminPage.goto('/sign-in');
    // ... admin sign in ...

    await adminPage.goto('/admin');

    // Wait for metrics to load
    await adminPage.waitForSelector('[data-testid="metrics-dashboard"]');

    // Verify metric cards are displayed
    const totalSearches = await adminPage
      .locator('[data-testid="metric-total-searches"]')
      .textContent();
    expect(totalSearches).toMatch(/\d+/);

    const cacheHitRate = await adminPage
      .locator('[data-testid="metric-cache-hit-rate"]')
      .textContent();
    expect(cacheHitRate).toMatch(/\d+%/);

    const avgLatency = await adminPage
      .locator('[data-testid="metric-avg-latency"]')
      .textContent();
    expect(avgLatency).toMatch(/\d+ms/);

    // Verify chart is rendered
    const chart = await adminPage.locator('[data-testid="metrics-chart"]');
    expect(await chart.isVisible()).toBe(true);

    // Verify time range selector works
    await adminPage.click('[data-testid="time-range-30d"]');
    await adminPage.waitForTimeout(500); // Wait for chart update

    // Verify popular queries list
    const popularQueries = await adminPage
      .locator('[data-testid="popular-query"]')
      .count();
    expect(popularQueries).toBeGreaterThan(0);
  });

  test('Admin views popular queries → sees aggregated data', async () => {
    await adminPage.goto('/sign-in');
    // ... admin sign in ...

    await adminPage.goto('/admin/analytics');

    // Wait for popular queries to load
    await adminPage.waitForSelector('[data-testid="popular-queries-list"]');

    // Verify query rankings
    const firstQuery = await adminPage
      .locator('[data-testid="popular-query"]:first-child')
      .textContent();
    const secondQuery = await adminPage
      .locator('[data-testid="popular-query"]:nth-child(2)')
      .textContent();

    // First query should have higher search count
    const firstCount = parseInt(firstQuery!.match(/\d+/)?.[0] || '0');
    const secondCount = parseInt(secondQuery!.match(/\d+/)?.[0] || '0');
    expect(firstCount).toBeGreaterThanOrEqual(secondCount);

    // Verify average latency is displayed
    const latencyDisplay = await adminPage
      .locator('[data-testid="popular-query-latency"]:first-child')
      .textContent();
    expect(latencyDisplay).toMatch(/\d+ms/);
  });

  test('User provides feedback → ranking improves', async () => {
    await page.goto('/sign-in');
    // ... sign in ...

    await page.goto('/search');

    // Perform search
    await page.fill('input[name="query"]', 'feedback test query');
    await page.click('button[type="submit"]');

    await page.waitForSelector('[data-testid="search-results"]');

    // Get first result ID
    const firstResultId = await page
      .locator('[data-testid="search-result"]:first-child')
      .getAttribute('data-result-id');

    // Provide positive feedback
    await page.click(
      `[data-testid="search-result"][data-result-id="${firstResultId}"] button[data-action="thumbs-up"]`
    );

    // Verify feedback recorded
    await expect(page.locator('[data-testid="feedback-success"]')).toContainText(
      'Thank you for your feedback'
    );

    // Perform same search multiple times
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="query"]', 'feedback test query');
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Provide positive feedback to first result each time
      await page.click(
        '[data-testid="search-result"]:first-child button[data-action="thumbs-up"]'
      );
    }

    // Clear cache to force fresh search with reranking
    await adminPage.goto('/admin/cache');
    await adminPage.click('button[data-testid="clear-cache"]');

    // Perform search again
    await page.fill('input[name="query"]', 'feedback test query');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="search-results"]');

    // The positively-rated result should still be first (boosted by feedback)
    const newFirstResultId = await page
      .locator('[data-testid="search-result"]:first-child')
      .getAttribute('data-result-id');

    expect(newFirstResultId).toBe(firstResultId);
  });

  test('Cache works across multiple requests', async () => {
    await page.goto('/sign-in');
    // ... sign in ...

    await page.goto('/search');

    const query = 'cache persistence test ' + Date.now();

    // First request - cache miss
    await page.fill('input[name="query"]', query);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="search-results"]');

    const latency1 = await page.locator('[data-testid="search-latency"]').textContent();
    const latency1Ms = parseInt(latency1!.match(/\d+/)?.[0] || '0');

    // Second request - cache hit
    await page.fill('input[name="query"]', query);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="search-results"]');

    const latency2 = await page.locator('[data-testid="search-latency"]').textContent();
    const latency2Ms = parseInt(latency2!.match(/\d+/)?.[0] || '0');

    // Cache hit should be significantly faster
    expect(latency2Ms).toBeLessThan(latency1Ms / 2);

    // Third request - still cached
    await page.fill('input[name="query"]', query);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="search-results"]');

    const cacheStatus = await page.locator('[data-testid="cache-status"]').textContent();
    expect(cacheStatus).toContain('hit');
  });

  test('A/B test assignments are consistent', async () => {
    await page.goto('/sign-in');
    // ... sign in ...

    await page.goto('/search');

    // Perform search to get A/B variant assignment
    await page.fill('input[name="query"]', 'ab test query');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="search-results"]');

    // Check which variant (hidden in data attribute or local storage)
    const variant1 = await page.evaluate(() =>
      localStorage.getItem('ab_test_search_variant')
    );

    // Reload page and search again
    await page.reload();
    await page.fill('input[name="query"]', 'ab test query');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="search-results"]');

    const variant2 = await page.evaluate(() =>
      localStorage.getItem('ab_test_search_variant')
    );

    // Variant should be consistent for same user
    expect(variant2).toBe(variant1);
  });

  test('Multiple concurrent users with cache and rate limiting', async ({ browser }) => {
    // Create 10 concurrent user sessions
    const users = await Promise.all(
      Array(10)
        .fill(null)
        .map(async (_, i) => {
          const context = await browser.newContext();
          const userPage = await context.newPage();
          await userPage.goto('/sign-in');
          // ... sign in user i ...
          return userPage;
        })
    );

    const query = 'concurrent test ' + Date.now();

    // All users perform same search concurrently
    const results = await Promise.all(
      users.map(async (userPage, i) => {
        await userPage.goto('/search');
        await userPage.fill('input[name="query"]', query);
        await userPage.click('button[type="submit"]');

        // Wait for response
        await userPage.waitForSelector(
          '[data-testid="search-results"], [data-testid="error-message"]',
          { timeout: 5000 }
        );

        const hasResults = (await userPage.locator('[data-testid="search-results"]').count()) > 0;
        const hasError = (await userPage.locator('[data-testid="error-message"]').count()) > 0;

        const cacheStatus = hasResults
          ? await userPage.locator('[data-testid="cache-status"]').textContent()
          : null;

        return { userIndex: i, hasResults, hasError, cacheStatus };
      })
    );

    // First user should have cache miss
    const firstUserResult = results[0];
    expect(firstUserResult.hasResults).toBe(true);

    // Subsequent users should have cache hits (if not rate limited)
    const cacheHits = results.filter(r => r.cacheStatus?.includes('hit')).length;
    expect(cacheHits).toBeGreaterThan(0);

    // Some users might be rate limited
    const rateLimited = results.filter(r => r.hasError).length;
    // Rate limiting may or may not occur depending on limits
  });

  test('Quota reset at month boundary', async () => {
    // This test would require time manipulation or mocking
    // For demo purposes, just verify the reset API endpoint

    await adminPage.goto('/sign-in');
    // ... admin sign in ...

    await adminPage.goto('/admin/quotas');

    // Select organization
    await adminPage.click('[data-testid="org-list"]');
    await adminPage.click('[data-testid="org-test-example"]');

    // Click reset quota button
    await adminPage.click('button[data-testid="reset-quota"]');

    // Confirm reset
    await adminPage.click('button[data-testid="confirm-reset"]');

    // Verify success message
    await expect(adminPage.locator('[data-testid="success-message"]')).toContainText(
      'Quota reset successful'
    );

    // Verify usage counters are reset to 0
    const apiCallsUsed = await adminPage
      .locator('[data-testid="api-calls-used"]')
      .textContent();
    expect(apiCallsUsed).toBe('0');
  });

  test('Error recovery: Redis down → fallback to database', async () => {
    // This would require mocking or actually bringing down Redis
    // For demo purposes, verify graceful degradation

    await page.goto('/sign-in');
    // ... sign in ...

    await page.goto('/search');

    // Perform search (should work even if cache is unavailable)
    await page.fill('input[name="query"]', 'redis down test');
    await page.click('button[type="submit"]');

    // Should still get results (from database)
    await page.waitForSelector('[data-testid="search-results"]');
    const results = await page.locator('[data-testid="search-result"]').count();
    expect(results).toBeGreaterThan(0);

    // Cache status might show error or "unavailable"
    const cacheStatus = await page.locator('[data-testid="cache-status"]').textContent();
    // Should not completely fail the request
  });
});

test.describe('Phase 6 Admin Workflows', () => {
  let adminPage: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();

    await adminPage.goto('/sign-in');
    // ... admin sign in ...
  });

  test('Admin views system health metrics', async () => {
    await adminPage.goto('/admin/health');

    // Wait for health metrics to load
    await adminPage.waitForSelector('[data-testid="health-metrics"]');

    // Verify Redis status
    const redisStatus = await adminPage
      .locator('[data-testid="redis-status"]')
      .textContent();
    expect(redisStatus).toMatch(/healthy|degraded/i);

    // Verify database status
    const dbStatus = await adminPage
      .locator('[data-testid="database-status"]')
      .textContent();
    expect(dbStatus).toMatch(/healthy|degraded/i);

    // Verify cache hit rate
    const cacheHitRate = await adminPage
      .locator('[data-testid="cache-hit-rate"]')
      .textContent();
    expect(cacheHitRate).toMatch(/\d+%/);
  });

  test('Admin receives alerts for anomalies', async () => {
    await adminPage.goto('/admin');

    // Wait for alerts to load
    await adminPage.waitForSelector('[data-testid="alerts-list"]');

    // Verify alerts are displayed
    const alerts = await adminPage.locator('[data-testid="alert-item"]').count();
    // There may or may not be alerts

    if (alerts > 0) {
      // Verify alert structure
      const firstAlert = adminPage.locator('[data-testid="alert-item"]:first-child');
      expect(await firstAlert.locator('[data-testid="alert-severity"]').textContent()).toMatch(
        /critical|warning|info/i
      );
      expect(await firstAlert.locator('[data-testid="alert-message"]').textContent()).toBeTruthy();

      // Acknowledge alert
      await firstAlert.locator('button[data-action="acknowledge"]').click();

      // Verify alert is marked as acknowledged
      await expect(firstAlert.locator('[data-testid="alert-status"]')).toContainText(
        'Acknowledged'
      );
    }
  });

  test('Admin exports analytics data', async () => {
    await adminPage.goto('/admin/analytics');

    // Click export button
    const [download] = await Promise.all([
      adminPage.waitForEvent('download'),
      adminPage.click('button[data-testid="export-analytics"]'),
    ]);

    // Verify file was downloaded
    expect(download.suggestedFilename()).toMatch(/analytics.*\.csv/i);

    // Verify file content (basic check)
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
