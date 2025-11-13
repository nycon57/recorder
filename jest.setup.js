// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Add OpenAI shims for Node environment (required for tests)
import 'openai/shims/node';

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
