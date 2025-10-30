import { useEffect, useState, useCallback, useRef } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseFetchWithAbortOptions {
  enabled?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for data fetching with automatic abort controller cleanup.
 * Prevents race conditions and memory leaks in data fetching effects.
 *
 * Based on React best practices: "You Might Not Need an Effect"
 * - Adds cleanup function to cancel in-flight requests
 * - Prevents stale data from overwriting fresh data
 * - Handles component unmount gracefully
 *
 * @example
 * const { data, loading, error, refetch } = useFetchWithAbort<User>(
 *   '/api/profile',
 *   { enabled: true }
 * );
 */
export function useFetchWithAbort<T = any>(
  url: string | null,
  options: UseFetchWithAbortOptions = {}
): FetchState<T> & { refetch: () => void } {
  const { enabled = true, onSuccess, onError } = options;

  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs whenever callbacks change
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url, {
        signal: abortController.signal,
      });

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          const bodyPreview = process.env.NODE_ENV === 'development'
            ? text.substring(0, 200)
            : '[REDACTED]';
          throw new Error(
            `Failed to parse JSON response. Status: ${response.status}, ` +
            `Content-Type: ${contentType}, Body: ${bodyPreview}`
          );
        }
      } else {
        throw new Error(
          `Expected JSON response but received ${contentType || 'unknown content-type'}. ` +
          `Status: ${response.status}`
        );
      }

      // Double-check abort status after async operation
      if (abortController.signal.aborted) {
        return;
      }

      setState({ data, loading: false, error: null });
      onSuccessRef.current?.(data);
    } catch (error) {
      // Ignore abort errors (expected when cleaning up)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      setState({ data: null, loading: false, error: errorObj });
      onErrorRef.current?.(errorObj);
    }
  }, [url, enabled]);

  useEffect(() => {
    fetchData();

    // Cleanup: abort request if component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

/**
 * Hook for interval-based fetching with abort controller support.
 * Useful for admin dashboards that need regular updates.
 *
 * Automatically handles:
 * - Aborting previous requests before starting new ones
 * - Cleanup on unmount
 * - Preventing memory leaks
 * - Race conditions from overlapping intervals
 *
 * @example
 * const { data, loading, error } = useFetchWithInterval<Metrics>(
 *   '/api/admin/metrics',
 *   30000 // refresh every 30 seconds
 * );
 */
export function useFetchWithInterval<T = any>(
  url: string | null,
  intervalMs: number,
  options: UseFetchWithAbortOptions = {}
): FetchState<T> & { refetch: () => void } {
  const { enabled = true, onSuccess, onError } = options;

  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs whenever callbacks change
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Only show loading on first fetch, not on refreshes
    setState(prev => ({ ...prev, loading: prev.data === null, error: null }));

    try {
      const response = await fetch(url, {
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return;

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          const bodyPreview = process.env.NODE_ENV === 'development'
            ? text.substring(0, 200)
            : '[REDACTED]';
          throw new Error(
            `Failed to parse JSON response. Status: ${response.status}, ` +
            `Content-Type: ${contentType}, Body: ${bodyPreview}`
          );
        }
      } else {
        throw new Error(
          `Expected JSON response but received ${contentType || 'unknown content-type'}. ` +
          `Status: ${response.status}`
        );
      }

      if (abortController.signal.aborted) return;

      setState({ data, loading: false, error: null });
      onSuccessRef.current?.(data);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      setState({ data: null, loading: false, error: errorObj });
      onErrorRef.current?.(errorObj);
    }
  }, [url, enabled]);

  useEffect(() => {
    fetchData(); // Initial fetch

    const interval = setInterval(fetchData, intervalMs);

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, intervalMs]);

  return {
    ...state,
    refetch: fetchData,
  };
}
