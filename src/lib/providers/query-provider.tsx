'use client';

/**
 * React Query Provider with Optimized Caching Configuration
 *
 * Performance optimizations:
 * - staleTime: 5 minutes for user data (reduces unnecessary refetches)
 * - gcTime: 10 minutes (formerly cacheTime, keeps unused data in cache)
 * - refetchOnWindowFocus: false for static data (reduces server load)
 * - retry: Smart retry logic with exponential backoff
 *
 * Query Key Patterns:
 * - ['organizations', 'stats'] - Organization statistics
 * - ['organizations', 'audit-logs'] - Audit logs with filters
 * - ['users', userId] - User profile data
 * - ['departments'] - Department list
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { type ReactNode, useRef } from 'react';

/**
 * Create query client with performance-optimized defaults
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes
        // This prevents unnecessary refetches when switching between pages
        staleTime: 5 * 60 * 1000, // 5 minutes

        // Keep unused data in cache for 10 minutes
        // This improves UX when navigating back to previously viewed pages
        gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)

        // Don't refetch on window focus for most queries
        // Individual queries can override this for real-time data
        refetchOnWindowFocus: false,

        // Retry failed requests with exponential backoff
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx client errors (except 429 rate limit)
          if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
            return false;
          }
          // Retry up to 3 times for server errors or network issues
          return failureCount < 3;
        },

        // Exponential backoff for retries: 1s, 2s, 4s
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch stale data on mount (but respects staleTime)
        refetchOnMount: true,

        // Don't refetch on reconnect unless data is stale
        refetchOnReconnect: 'always',
      },
      mutations: {
        // Retry mutations only once for network errors
        retry: (failureCount, error: any) => {
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          return failureCount < 1;
        },
        retryDelay: 1000,
      },
    },
  });
}

// Removed singleton pattern for React 19 compatibility
// Each component instance will manage its own client via useRef

/**
 * Query Provider Component
 *
 * Usage:
 * Wrap your app (or specific routes) with this provider:
 *
 * ```tsx
 * <QueryProvider>
 *   <YourApp />
 * </QueryProvider>
 * ```
 *
 * Then use React Query hooks in your components:
 *
 * ```tsx
 * const { data, isLoading } = useQuery({
 *   queryKey: ['organizations', 'stats'],
 *   queryFn: async () => {
 *     const res = await fetch('/api/organizations/stats');
 *     return res.json();
 *   },
 * });
 * ```
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  // Use useRef to create a stable client instance across renders (React 19 compatible)
  // This ensures the client is created once per component mount
  const queryClientRef = useRef<QueryClient | null>(null);

  if (!queryClientRef.current) {
    queryClientRef.current = makeQueryClient();
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      {children}
      {/* ReactQueryDevtools temporarily disabled for React 19 compatibility */}
      {/* {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )} */}
    </QueryClientProvider>
  );
}

/**
 * Pre-configured Query Keys
 * Use these for consistent cache keys across the app
 */
export const queryKeys = {
  // Organization queries
  organizations: {
    all: ['organizations'] as const,
    stats: (includeQuotas = true, includeUsage = true) =>
      ['organizations', 'stats', { includeQuotas, includeUsage }] as const,
    auditLogs: (filters?: Record<string, any>) =>
      ['organizations', 'audit-logs', filters] as const,
    members: ['organizations', 'members'] as const,
    departments: ['organizations', 'departments'] as const,
    settings: ['organizations', 'settings'] as const,
  },

  // User queries
  users: {
    all: ['users'] as const,
    detail: (userId: string) => ['users', userId] as const,
    profile: ['users', 'profile'] as const,
    sessions: (userId: string) => ['users', userId, 'sessions'] as const,
  },

  // Recording queries
  recordings: {
    all: ['recordings'] as const,
    list: (filters?: Record<string, any>) => ['recordings', 'list', filters] as const,
    detail: (recordingId: string) => ['recordings', recordingId] as const,
    stats: (recordingId: string) => ['recordings', recordingId, 'stats'] as const,
  },

  // Search queries
  search: {
    all: ['search'] as const,
    semantic: (query: string, filters?: Record<string, any>) =>
      ['search', 'semantic', query, filters] as const,
  },

  // Chat queries
  chat: {
    all: ['chat'] as const,
    conversations: ['chat', 'conversations'] as const,
    messages: (conversationId: string) => ['chat', conversationId, 'messages'] as const,
  },
} as const;

/**
 * Helper function to invalidate related queries
 *
 * Example usage after creating a recording:
 * ```tsx
 * const queryClient = useQueryClient();
 * await queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
 * ```
 */
export function invalidateOrganizationData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });
}

export function invalidateRecordingData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
}

export function invalidateUserData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}
