/* eslint-env jest */

// Learn more: https://github.com/testing-library/jest-dom
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
import { TextDecoder, TextEncoder } from 'util';
import { MessageChannel, MessagePort } from 'worker_threads';

import '@testing-library/jest-dom';

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
global.ReadableStream = global.ReadableStream || ReadableStream;
global.TransformStream = global.TransformStream || TransformStream;
global.WritableStream = global.WritableStream || WritableStream;
global.setImmediate = global.setImmediate || ((callback, ...args) => setTimeout(callback, 0, ...args));
global.clearImmediate = global.clearImmediate || ((handle) => clearTimeout(handle));
global.MessageChannel = global.MessageChannel || MessageChannel;
global.MessagePort = global.MessagePort || MessagePort;

const { fetch, Headers, Request, Response } = require('undici');

global.fetch = global.fetch || fetch;
global.Headers = global.Headers || Headers;
global.Request = global.Request || Request;
global.Response = global.Response || Response;

// Add OpenAI shims when the package is available in the current install.
try {
  require('openai/shims/node');
} catch {
  // Some lightweight worktrees omit optional OpenAI shims; tests that do not
  // exercise the SDK should still be able to run.
}

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GOOGLE_AI_API_KEY = 'test-google-ai-key';
process.env.COHERE_API_KEY = 'test-cohere-key';
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Clerk
jest.mock(
  '@clerk/nextjs',
  () => ({
    auth: () => ({
      userId: 'test-user-id',
      orgId: 'test-org-id',
    }),
    useAuth: () => ({
      userId: 'test-user-id',
      orgId: 'test-org-id',
      isLoaded: true,
      isSignedIn: true,
    }),
    ClerkProvider: ({ children }) => children,
  }),
  { virtual: true }
);
