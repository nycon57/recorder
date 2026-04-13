import { Blob, File } from 'buffer';
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
import { TextDecoder, TextEncoder } from 'util';
import { MessageChannel, MessagePort } from 'worker_threads';

import '@testing-library/jest-dom';
import { fetch, FormData, Headers, Request, Response } from 'undici';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = ReadableStream;
}

if (typeof globalThis.WritableStream === 'undefined') {
  globalThis.WritableStream = WritableStream;
}

if (typeof globalThis.TransformStream === 'undefined') {
  globalThis.TransformStream = TransformStream;
}

if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = Blob;
}

if (typeof globalThis.File === 'undefined') {
  globalThis.File = File;
}

if (typeof globalThis.MessageChannel === 'undefined') {
  globalThis.MessageChannel = MessageChannel;
}

if (typeof globalThis.MessagePort === 'undefined') {
  globalThis.MessagePort = MessagePort;
}

if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = fetch;
}

if (typeof globalThis.Headers === 'undefined') {
  globalThis.Headers = Headers;
}

if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = Request;
}

if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = Response;
}

if (typeof globalThis.FormData === 'undefined') {
  globalThis.FormData = FormData;
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
jest.mock('@clerk/nextjs', () => ({
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
}));
