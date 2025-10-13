# Phase 4 Advanced Video Processing - Test Suite

Comprehensive test suite for Phase 4 frame extraction, visual indexing, OCR, and multimodal search features.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)

## Overview

This test suite validates the complete Phase 4 pipeline:

1. **Frame Extraction**: FFmpeg-based frame extraction with scene change detection
2. **Visual Indexing**: Gemini Vision API for frame description and classification
3. **OCR Processing**: Tesseract.js for text extraction from frames
4. **Multimodal Search**: Combined audio (transcript) and visual (frame) search
5. **API Routes**: REST endpoints for frame retrieval and visual search
6. **Worker Jobs**: Background processing pipeline

### Test Coverage Goals

- **Services**: >85% coverage for all business logic
- **API Routes**: >80% coverage including authentication and validation
- **Workers**: >80% coverage including error handling and retries
- **Integration**: End-to-end pipeline tests

## Test Structure

```
__tests__/
├── lib/
│   ├── services/
│   │   ├── frame-extraction.test.ts       # Frame extraction service
│   │   ├── visual-indexing.test.ts        # Gemini Vision integration
│   │   ├── ocr-service.test.ts            # Tesseract OCR
│   │   └── multimodal-search.test.ts      # Combined search
│   └── workers/
│       └── handlers/
│           └── extract-frames.test.ts      # Background job handler
├── app/
│   └── api/
│       ├── recordings/
│       │   └── [id]/
│       │       └── frames/
│       │           └── route.test.ts       # Frame retrieval API
│       └── search/
│           └── visual/
│               └── route.test.ts           # Visual search API
├── fixtures/
│   └── phase4-test-data.ts                # Shared test data
├── integration/
│   └── phase4-pipeline.test.ts            # End-to-end tests
└── PHASE4_TEST_README.md                  # This file
```

## Running Tests

### Run All Tests

```bash
yarn test
```

### Run Phase 4 Tests Only

```bash
# All Phase 4 tests
yarn test __tests__/lib/services/frame-extraction
yarn test __tests__/lib/services/visual-indexing
yarn test __tests__/lib/services/ocr-service
yarn test __tests__/lib/services/multimodal-search
yarn test __tests__/lib/workers/handlers/extract-frames
yarn test __tests__/app/api/recordings
yarn test __tests__/app/api/search/visual

# Integration tests
yarn test __tests__/integration/phase4-pipeline
```

### Run Specific Test File

```bash
yarn test __tests__/lib/services/frame-extraction.test.ts
```

### Watch Mode

```bash
yarn test:watch
```

### Coverage Report

```bash
yarn test:coverage
```

View the HTML coverage report:
```bash
open coverage/lcov-report/index.html
```

## Test Coverage

### Services

**Frame Extraction** (`lib/services/frame-extraction.ts`)
- ✅ Uniform frame extraction
- ✅ Scene change detection
- ✅ Quality optimization with Sharp
- ✅ Storage upload to Supabase
- ✅ Metadata extraction with FFprobe
- ✅ Error handling and cleanup
- ✅ Environment variable configuration

**Visual Indexing** (`lib/services/visual-indexing.ts`)
- ✅ Frame description with Gemini Vision
- ✅ Scene type classification (code, browser, terminal, UI, etc.)
- ✅ Element detection
- ✅ Batch processing with concurrency limits
- ✅ Embedding generation
- ✅ Error recovery and graceful degradation

**OCR Service** (`lib/services/ocr-service.ts`)
- ✅ Text extraction with Tesseract
- ✅ Confidence-based filtering
- ✅ Bounding box extraction
- ✅ Multi-line text handling
- ✅ Special character support
- ✅ Worker lifecycle management

**Multimodal Search** (`lib/services/multimodal-search.ts`)
- ✅ Audio + visual result combination
- ✅ Weighted scoring and re-ranking
- ✅ Cosine similarity calculations
- ✅ Result filtering and pagination
- ✅ Feature flag handling
- ✅ Performance optimization

### Workers

**Extract Frames Handler** (`lib/workers/handlers/extract-frames.ts`)
- ✅ Full pipeline execution
- ✅ Video download from storage
- ✅ Frame metadata insertion
- ✅ Visual description generation
- ✅ OCR processing
- ✅ Error handling and status updates
- ✅ Cleanup and retry logic

### API Routes

**Frames API** (`app/api/recordings/[id]/frames/route.ts`)
- ✅ GET: Frame retrieval with pagination
- ✅ GET: Time range filtering
- ✅ GET: Presigned URL generation
- ✅ POST: Frame extraction job triggering
- ✅ Authentication and authorization
- ✅ RLS policy enforcement
- ✅ Query parameter validation

**Visual Search API** (`app/api/search/visual/route.ts`)
- ✅ Query validation
- ✅ Rate limiting
- ✅ Organization isolation
- ✅ Feature flag handling
- ✅ Result formatting
- ✅ Error handling
- ✅ Performance optimization

### Integration Tests

**Full Pipeline** (`__tests__/integration/phase4-pipeline.test.ts`)
- ✅ End-to-end frame extraction
- ✅ Multimodal search integration
- ✅ Error recovery and retries
- ✅ Concurrent job processing
- ✅ Performance benchmarks

## Writing New Tests

### Using Test Fixtures

Import shared test data from fixtures:

```typescript
import {
  mockRecording,
  mockExtractedFrames,
  mockVisualDescriptions,
  mockOCRResults,
  createMockFrame,
  createMockFrameBatch,
} from '../fixtures/phase4-test-data';

describe('My Test Suite', () => {
  it('should use mock data', () => {
    const frame = createMockFrame({ frame_number: 5 });
    expect(frame.frame_number).toBe(5);
  });
});
```

### Mocking External Services

#### FFmpeg and Sharp

```typescript
jest.mock('fluent-ffmpeg');
jest.mock('sharp');

// Mocks are already configured in __mocks__/
```

#### Gemini Vision API

```typescript
const mockGenerateContent = jest.fn();
jest.mock('@/lib/google/client', () => ({
  getGoogleAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: mockGenerateContent,
    })),
  })),
}));

mockGenerateContent.mockResolvedValue({
  response: {
    text: () => JSON.stringify({
      description: 'Test description',
      sceneType: 'code',
      detectedElements: [],
      confidence: 0.9,
    }),
  },
});
```

#### Tesseract OCR

```typescript
jest.mock('tesseract.js');
// Mock is already configured in __mocks__/tesseract.js.ts
```

#### Supabase

```typescript
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [], error: null }),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ error: null }),
      download: jest.fn().mockResolvedValue({ data: new Blob([]), error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed-url' },
        error: null,
      }),
    })),
  },
};

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => mockSupabase),
}));
```

### Test Patterns

#### AAA Pattern (Arrange-Act-Assert)

```typescript
it('should extract frames from video', async () => {
  // Arrange
  const videoPath = '/path/to/video.mp4';
  const recordingId = 'rec-123';
  const orgId = 'org-456';

  // Act
  const result = await extractFrames(videoPath, recordingId, orgId);

  // Assert
  expect(result.totalFrames).toBeGreaterThan(0);
  expect(result.frames[0]).toMatchObject({
    frameNumber: 1,
    timeSec: expect.any(Number),
    storagePath: expect.stringContaining(orgId),
  });
});
```

#### Error Testing

```typescript
it('should handle FFmpeg errors', async () => {
  // Arrange
  mockFFmpegInstance.run.mockImplementationOnce(function (this: any) {
    const errorCallback = this.on.mock.calls.find(
      (call: any[]) => call[0] === 'error'
    )?.[1];
    if (errorCallback) {
      errorCallback(new Error('FFmpeg failed'));
    }
  });

  // Act & Assert
  await expect(extractFrames(videoPath, recordingId, orgId))
    .rejects.toThrow('FFmpeg failed');
});
```

#### Async Testing

```typescript
it('should process frames in parallel', async () => {
  // Arrange
  const frames = createMockFrameBatch(10);

  // Act
  const promises = frames.map(frame => processFrame(frame));
  const results = await Promise.all(promises);

  // Assert
  expect(results).toHaveLength(10);
  results.forEach(result => {
    expect(result).toBeDefined();
  });
});
```

### Performance Testing

```typescript
describe('performance', () => {
  it('should complete extraction in reasonable time', async () => {
    const startTime = Date.now();

    await extractFrames(videoPath, recordingId, orgId, {
      maxFrames: 300,
    });

    const duration = Date.now() - startTime;

    // With mocks, should be fast
    expect(duration).toBeLessThan(2000);
  });
});
```

## Troubleshooting

### Common Issues

#### 1. Mock Not Working

**Problem**: Mock is not being applied, real implementation is called.

**Solution**: Ensure mock is defined before the import:

```typescript
// ❌ Wrong order
import { myFunction } from '@/lib/my-module';
jest.mock('@/lib/my-module');

// ✅ Correct order
jest.mock('@/lib/my-module');
import { myFunction } from '@/lib/my-module';
```

#### 2. Async Timeout

**Problem**: Test times out waiting for promise.

**Solution**: Ensure async functions are awaited:

```typescript
// ❌ Missing await
it('should work', async () => {
  myAsyncFunction(); // Promise not awaited
});

// ✅ Properly awaited
it('should work', async () => {
  await myAsyncFunction();
});
```

#### 3. Mock State Leaking Between Tests

**Problem**: Mocks from one test affect another.

**Solution**: Clear mocks in `beforeEach`:

```typescript
beforeEach(() => {
  jest.clearAllMocks(); // Clears call history
  // OR
  jest.resetAllMocks(); // Resets implementation
});
```

#### 4. Environment Variables Not Set

**Problem**: Tests fail because env vars are missing.

**Solution**: Set in `jest.setup.js` or per test:

```typescript
// In jest.setup.js (global)
process.env.GOOGLE_AI_API_KEY = 'test-key';

// In test file (scoped)
beforeEach(() => {
  process.env.ENABLE_OCR = 'true';
});

afterEach(() => {
  delete process.env.ENABLE_OCR;
});
```

#### 5. Type Errors with Mocks

**Problem**: TypeScript complains about mock types.

**Solution**: Use proper typing:

```typescript
import { extractFrames } from '@/lib/services/frame-extraction';

jest.mock('@/lib/services/frame-extraction');

const mockExtractFrames = extractFrames as jest.MockedFunction<typeof extractFrames>;

mockExtractFrames.mockResolvedValue({ /* ... */ });
```

### Debugging Tests

#### Enable Verbose Output

```bash
yarn test --verbose
```

#### Run Single Test

```bash
yarn test -t "should extract frames"
```

#### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

#### Check Coverage for Specific File

```bash
yarn test:coverage --collectCoverageFrom="lib/services/frame-extraction.ts"
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Push to main branch
- Pre-deployment checks

### GitHub Actions

```yaml
- name: Run Phase 4 Tests
  run: |
    yarn test __tests__/lib/services/frame-extraction
    yarn test __tests__/lib/services/visual-indexing
    yarn test __tests__/lib/services/ocr-service
    yarn test __tests__/lib/services/multimodal-search
    yarn test __tests__/lib/workers/handlers/extract-frames
    yarn test __tests__/app/api/recordings
    yarn test __tests__/app/api/search/visual
    yarn test __tests__/integration/phase4-pipeline
```

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Use Descriptive Test Names**: `should extract frames at uniform intervals` is better than `test1`
3. **Keep Tests Independent**: Each test should run in isolation
4. **Mock External Dependencies**: Don't make real API calls or file system operations
5. **Test Edge Cases**: Empty inputs, errors, boundary conditions
6. **Maintain Test Data**: Keep fixtures up to date with schema changes
7. **Run Tests Before Committing**: Ensure all tests pass locally
8. **Write Tests for Bug Fixes**: Add regression tests when fixing bugs

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://testingjavascript.com/)
- [Project Test Guidelines](/TESTING.md)

## Support

For questions or issues with tests:
1. Check this README
2. Review existing test examples
3. Ask in team chat
4. Open an issue with `test` label
