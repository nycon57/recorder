# Phase 6 Test Suite - Quick Reference

## 🚀 Quick Start

```bash
# Run all Phase 6 tests
yarn test --testPathPattern="phase6|cache|analytics|quotas"

# Run with coverage
yarn test:coverage

# Run specific suite
yarn test __tests__/lib/services/cache/
```

## 📁 Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `cache/multi-layer-cache.test.ts` | 32 | Memory + Redis caching |
| `analytics/search-tracker.test.ts` | 22 | Search analytics tracking |
| `quotas/quota-manager.test.ts` | 27 | Quota management |
| `quotas/rate-limiter.test.ts` | 25 | Rate limiting |
| `app/api/search/route-phase6.test.ts` | 25 | Search API integration |
| `e2e/phase6-workflow.test.ts` | 10 | End-to-end workflows |

## 📊 Coverage Targets

| Component | Target | Expected |
|-----------|--------|----------|
| Caching | 90% | 92% ✅ |
| Analytics | 85% | 88% ✅ |
| Quotas | 90% | 92% ✅ |
| Rate Limiting | 90% | 91% ✅ |
| **Overall** | **>80%** | **~88%** ✅ |

## 📚 Documentation

1. **[Test Plan](PHASE6_TEST_PLAN.md)** - Complete list of test cases
2. **[Coverage Report](PHASE6_COVERAGE_REPORT.md)** - Expected coverage analysis
3. **[Testing Checklist](PHASE6_TESTING_CHECKLIST.md)** - Pre-deployment checklist
4. **[CI/CD Integration](PHASE6_CI_CD_INTEGRATION.md)** - Pipeline setup guide
5. **[Summary](PHASE6_TEST_SUITE_SUMMARY.md)** - Executive summary

## ✅ Pre-Deployment Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Coverage >80%
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Performance benchmarks met
- [ ] Manual testing complete
- [ ] Staging deployment successful
- [ ] Final sign-off obtained

## 🔧 Common Commands

```bash
# Run tests in watch mode
yarn test:watch

# Run tests for specific file
yarn test --findRelatedTests lib/services/cache/multi-layer-cache.ts

# Run only changed tests
yarn test --onlyChanged

# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand

# Generate HTML coverage report
yarn test:coverage && open coverage/index.html
```

## 🐛 Troubleshooting

**Tests failing locally but passing in CI?**
- Check environment variables
- Ensure Redis is running
- Verify database migrations applied

**Tests slow?**
- Run with `--maxWorkers=50%`
- Check for unnecessary async waits
- Profile with `node --prof`

**Flaky tests?**
- Add retries: `jest.retryTimes(2)`
- Increase timeouts: `jest.setTimeout(10000)`
- Mock time-dependent operations

## 📞 Support

- **Test Issues**: @qa-team
- **CI/CD Issues**: @devops-team
- **Coverage Questions**: @backend-team

**Slack**: #phase6-testing
