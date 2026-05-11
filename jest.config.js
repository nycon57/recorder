/* eslint-env node */
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^components/(.*)$': '<rootDir>/src/app/components/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^contexts/(.*)$': '<rootDir>/src/app/contexts/$1',
    '^services/(.*)$': '<rootDir>/src/lib/services/$1',
    '^@google/genai$': '<rootDir>/src/test-support/mocks/google-genai.ts',
    '^cohere-ai$': '<rootDir>/__mocks__/cohere-ai.ts',
    '^@upstash/redis$': '<rootDir>/src/test-support/mocks/upstash-redis.ts',
    '^@xenova/transformers$': '<rootDir>/__mocks__/@xenova/transformers.ts',
    // better-auth is ESM-only; redirect each entry-point to the root-level mocks so
    // Jest never tries to load the real .mjs files.
    '^better-auth/plugins/access$': '<rootDir>/src/test-support/mocks/better-auth-plugins-access.ts',
    '^better-auth/plugins/admin/access$': '<rootDir>/src/test-support/mocks/better-auth-plugins-admin-access.ts',
    '^better-auth/plugins$': '<rootDir>/src/test-support/mocks/better-auth-plugins.ts',
    '^better-auth/next-js$': '<rootDir>/src/test-support/mocks/better-auth-next-js.ts',
    '^better-auth/react$': '<rootDir>/src/test-support/mocks/better-auth-react.ts',
    '^better-auth/client/plugins$': '<rootDir>/src/test-support/mocks/better-auth-client-plugins.ts',
    '^better-auth(.*)$': '<rootDir>/src/test-support/mocks/better-auth.ts',
    '^lucide-react$': '<rootDir>/src/test-support/mocks/lucide-react.cjs',
    // Strip .js extensions from local imports — needed for tsx/ESM compat in Jest CJS mode
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/app/components/admin/vendor-sources/__tests__/fixtures/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@google/genai|react-markdown|remark-gfm|rehype-sanitize|remark|rehype|unified|bail|is-plain-obj|trough|vfile|unist-util-stringify-position|mdast-util-from-markdown|mdast-util-to-hast|mdast-util-gfm|micromark|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|space-separated-tokens|comma-separated-tokens|hast-util-to-jsx-runtime|hast-util-is-element|devlop|estree-util-is-identifier-name|html-url-attributes|zwitch|hast-util-to-html|hastscript|web-namespaces|longest-streak|mdast-util-to-markdown|ccount|trim-lines|hast-util-raw|vfile-message|unist-util-position|unist-util-visit|unist-util-find-after|unist-util-generated|unist-util-remove-position|unist-util-stringify-position|unist-util-visit-parents|@types/mdast|@types/hast|mdast-util-definitions|mdast-util-mdx-expression|mdast-util-mdxjs-esm|mdast-util-mdx-jsx|mdast-util-gfm-footnote|mdast-util-gfm-strikethrough|mdast-util-gfm-table|mdast-util-gfm-task-list-item|micromark-core-commonmark|micromark-extension-gfm|micromark-extension-gfm-autolink-literal|micromark-extension-gfm-footnote|micromark-extension-gfm-strikethrough|micromark-extension-gfm-table|micromark-extension-gfm-tagfilter|micromark-extension-gfm-task-list-item|micromark-factory-destination|micromark-factory-label|micromark-factory-space|micromark-factory-title|micromark-factory-whitespace|micromark-util-character|micromark-util-chunked|micromark-util-classify-character|micromark-util-combine-extensions|micromark-util-decode-numeric-character-reference|micromark-util-decode-string|micromark-util-encode|micromark-util-events-to-acorn|micromark-util-html-tag-name|micromark-util-normalize-identifier|micromark-util-resolve-all|micromark-util-sanitize-uri|micromark-util-subtokenize|micromark-util-symbol|micromark-util-types)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/dist/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
