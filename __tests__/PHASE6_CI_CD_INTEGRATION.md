# Phase 6 CI/CD Integration Guide

## Overview

This guide explains how to integrate Phase 6 tests into your CI/CD pipeline for automated testing on every commit and pull request.

---

## GitHub Actions Workflow

### Complete Workflow Configuration

Create or update `.github/workflows/test-phase6.yml`:

```yaml
name: Phase 6 Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18'
  POSTGRES_VERSION: '15'
  REDIS_VERSION: '7'

jobs:
  # Job 1: Unit Tests (Fast, run in parallel)
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    strategy:
      matrix:
        test-group:
          - cache
          - analytics
          - quotas
          - experiments

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run unit tests for ${{ matrix.test-group }}
        run: |
          if [ "${{ matrix.test-group }}" == "cache" ]; then
            yarn test --testPathPattern=cache --coverage
          elif [ "${{ matrix.test-group }}" == "analytics" ]; then
            yarn test --testPathPattern=analytics --coverage
          elif [ "${{ matrix.test-group }}" == "quotas" ]; then
            yarn test --testPathPattern=quotas --coverage
          elif [ "${{ matrix.test-group }}" == "experiments" ]; then
            yarn test --testPathPattern=experiments --coverage
          fi

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: ${{ matrix.test-group }}
          name: coverage-${{ matrix.test-group }}

  # Job 2: Integration Tests (API routes, database)
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: recorder_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local
        run: |
          supabase init
          supabase start

      - name: Run database migrations
        run: supabase db push

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/recorder_test
          REDIS_URL: redis://localhost:6379
          SUPABASE_URL: http://localhost:54321
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_TEST }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY_TEST }}
        run: |
          yarn test --testPathPattern="app/api|integration" --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: integration
          name: coverage-integration

      - name: Stop Supabase
        if: always()
        run: supabase stop

  # Job 3: Type Checking & Linting
  quality-checks:
    name: Quality Checks
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Type check
        run: yarn type:check

      - name: Lint
        run: yarn lint

      - name: Format check
        run: yarn format:check

  # Job 4: E2E Tests (Playwright)
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [unit-tests, integration-tests, quality-checks]

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: recorder_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Setup test environment
        run: |
          supabase start
          supabase db push

      - name: Build application
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY_TEST }}
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY_TEST }}
        run: yarn build

      - name: Run E2E tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/recorder_test
          REDIS_URL: redis://localhost:6379
          PLAYWRIGHT_BASE_URL: http://localhost:3000
        run: |
          yarn start &
          sleep 10
          npx playwright test __tests__/e2e/phase6-workflow.test.ts

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  # Job 5: Coverage Report
  coverage-report:
    name: Coverage Report
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: github.event_name == 'pull_request'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download coverage artifacts
        uses: actions/download-artifact@v3

      - name: Generate combined coverage report
        run: |
          npx nyc merge coverage/ .nyc_output/coverage.json
          npx nyc report --reporter=html --reporter=text

      - name: Comment PR with coverage
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}

  # Job 6: Performance Benchmarks
  performance-benchmarks:
    name: Performance Benchmarks
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: github.ref == 'refs/heads/main'

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: recorder_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run performance benchmarks
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/recorder_test
          REDIS_URL: redis://localhost:6379
        run: |
          node scripts/benchmark-phase6-performance.js

      - name: Upload benchmark results
        uses: benchmark-action/github-action-benchmark@v1
        with:
          name: Phase 6 Performance
          tool: 'customSmallerIsBetter'
          output-file-path: phase6-performance-report.json
          github-token: ${{ secrets.GITHUB_TOKEN }}
          auto-push: true
```

---

## Vercel Deployment Configuration

### `vercel.json`

```json
{
  "buildCommand": "yarn build",
  "devCommand": "yarn dev",
  "installCommand": "yarn install",
  "framework": "nextjs",
  "buildSettings": {
    "env": {
      "SKIP_BUILD_STATIC_GENERATION": "true"
    }
  },
  "github": {
    "silent": true,
    "autoJobCancelation": true
  },
  "checks": {
    "path": "/api/health",
    "type": "ready",
    "deployment": true
  }
}
```

### Vercel Build Checks

Add to `.github/workflows/vercel-deploy.yml`:

```yaml
name: Vercel Deployment Checks

on:
  deployment_status:

jobs:
  post-deploy-tests:
    name: Post-Deploy Tests
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Wait for deployment
        run: sleep 30

      - name: Run smoke tests
        env:
          DEPLOY_URL: ${{ github.event.deployment_status.target_url }}
        run: |
          curl -f $DEPLOY_URL/api/health || exit 1
          curl -f $DEPLOY_URL/api/health | jq '.redis.status' | grep -q "healthy" || exit 1

      - name: Run critical path tests
        env:
          DEPLOY_URL: ${{ github.event.deployment_status.target_url }}
          TEST_API_KEY: ${{ secrets.TEST_API_KEY }}
        run: |
          # Test search API
          response=$(curl -X POST $DEPLOY_URL/api/search \
            -H "Authorization: Bearer $TEST_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"query": "test"}')

          echo $response | jq '.results' || exit 1

      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment health checks failed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Test Optimization Strategies

### 1. Test Parallelization

**Jest Configuration** (`jest.config.js`):

```javascript
module.exports = {
  // Run tests in parallel (up to 50% of CPU cores)
  maxWorkers: '50%',

  // Automatically clear mock calls between tests
  clearMocks: true,

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Higher thresholds for critical components
    './lib/services/quotas/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

### 2. Test Sharding (For Large Suites)

```yaml
# Split tests across multiple runners
strategy:
  matrix:
    shard: [1, 2, 3, 4]

steps:
  - name: Run tests
    run: yarn test --shard=${{ matrix.shard }}/4
```

### 3. Caching Dependencies

```yaml
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: |
      node_modules
      .yarn/cache
    key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      ${{ runner.os }}-yarn-
```

### 4. Conditional Test Execution

```yaml
- name: Get changed files
  id: changed-files
  uses: tj-actions/changed-files@v40
  with:
    files: |
      lib/services/cache/**
      lib/services/analytics/**
      lib/services/quotas/**

- name: Run Phase 6 tests if relevant files changed
  if: steps.changed-files.outputs.any_changed == 'true'
  run: yarn test --testPathPattern="phase6|cache|analytics|quotas"
```

---

## Pre-Commit Hooks

### Husky + Lint-Staged Configuration

**`.husky/pre-commit`**:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

yarn lint-staged
```

**`package.json`**:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --bail --findRelatedTests --passWithNoTests"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

---

## Local Development Testing Commands

### Quick Test Commands

```bash
# Run all Phase 6 tests
yarn test:phase6

# Run specific test suite
yarn test:cache
yarn test:analytics
yarn test:quotas

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage

# Run only changed tests
yarn test --onlyChanged

# Run tests related to specific file
yarn test --findRelatedTests lib/services/cache/multi-layer-cache.ts
```

### Performance Testing

```bash
# Run performance benchmarks
node scripts/benchmark-phase6-performance.js

# Profile specific test
node --prof node_modules/.bin/jest __tests__/lib/services/cache/multi-layer-cache.test.ts

# Analyze profile
node --prof-process isolate-*.log > processed.txt
```

---

## Continuous Monitoring

### Datadog Integration

```yaml
- name: Send metrics to Datadog
  if: always()
  run: |
    curl -X POST "https://api.datadoghq.com/api/v1/series?api_key=${{ secrets.DATADOG_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{
        "series": [
          {
            "metric": "ci.test.duration",
            "points": [['"$(date +%s)"', '"${{ job.duration }}"']],
            "type": "gauge",
            "tags": ["env:ci", "job:phase6-tests"]
          }
        ]
      }'
```

### Sentry Error Tracking

```yaml
- name: Upload source maps to Sentry
  if: github.ref == 'refs/heads/main'
  run: |
    yarn sentry:sourcemaps
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

---

## Troubleshooting Common CI Issues

### Issue 1: Flaky Tests

**Solution**: Add retries for flaky tests

```javascript
// In jest.setup.js
jest.retryTimes(2, { logErrorsBeforeRetry: true });
```

### Issue 2: Timeout in CI but not locally

**Solution**: Increase timeouts for CI environment

```javascript
// In test file
jest.setTimeout(30000); // 30 seconds

// Or set globally in jest.config.js
module.exports = {
  testTimeout: 30000,
};
```

### Issue 3: Database connection failures

**Solution**: Wait for services to be ready

```yaml
- name: Wait for services
  run: |
    timeout 60 bash -c 'until pg_isready -h localhost -p 5432; do sleep 1; done'
    timeout 60 bash -c 'until redis-cli -h localhost -p 6379 ping; do sleep 1; done'
```

### Issue 4: Out of memory errors

**Solution**: Increase Node memory limit

```yaml
- name: Run tests
  run: NODE_OPTIONS=--max_old_space_size=4096 yarn test
```

---

## Success Criteria

Before merging any Phase 6 PR, ensure:

- ✅ All unit tests pass (0 failures)
- ✅ All integration tests pass
- ✅ Code coverage >80% overall
- ✅ Critical paths >90% coverage
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ Prettier formatting applied
- ✅ E2E tests pass (if code affects UI)
- ✅ Performance benchmarks within acceptable range
- ✅ No new security vulnerabilities
- ✅ Documentation updated

---

## Contact & Support

**CI/CD Issues**: @devops-team
**Test Failures**: @qa-team
**Performance Issues**: @backend-team

**Slack Channels**:
- #ci-cd-alerts
- #test-automation
- #phase6-deployment
