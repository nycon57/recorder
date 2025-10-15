/**
 * Virtual Scrolling and Lazy Loading Hook
 *
 * Provides efficient rendering of large lists with:
 * - Virtual scrolling (only renders visible items)
 * - Infinite scroll with pagination
 * - Lazy loading of images and content
 * - Prefetching for smooth scrolling
 * - Intersection Observer for visibility tracking
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface VirtualizationOptions {
  itemHeight: number | ((index: number) => number);
  overscan?: number;
  threshold?: number;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  isLoading?: boolean;
}

interface VirtualizedItem<T> {
  index: number;
  data: T;
  isVisible: boolean;
  style: React.CSSProperties;
}

export function useVirtualization<T>(
  items: T[],
  options: VirtualizationOptions
) {
  const {
    itemHeight,
    overscan = 3,
    threshold = 0.8,
    onLoadMore,
    hasMore = false,
    isLoading = false,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  const [containerHeight, setContainerHeight] = useState(0);
  const isLoadingMoreRef = useRef(false);

  // Calculate item heights
  const getItemHeight = useCallback(
    (index: number): number => {
      return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
    },
    [itemHeight]
  );

  // Calculate total height and item positions
  const { totalHeight, itemPositions } = useMemo(() => {
    let height = 0;
    const positions: number[] = [];

    for (let i = 0; i < items.length; i++) {
      positions.push(height);
      height += getItemHeight(i);
    }

    return { totalHeight: height, itemPositions: positions };
  }, [items.length, getItemHeight]);

  // Calculate visible range based on scroll position
  const calculateVisibleRange = useCallback(
    (scrollTop: number, containerHeight: number) => {
      if (items.length === 0) {
        return { start: 0, end: 0 };
      }

      // Find first visible item
      let start = 0;
      for (let i = 0; i < itemPositions.length; i++) {
        if (itemPositions[i] + getItemHeight(i) > scrollTop) {
          start = Math.max(0, i - overscan);
          break;
        }
      }

      // Find last visible item
      let end = start;
      const maxScroll = scrollTop + containerHeight;
      for (let i = start; i < itemPositions.length; i++) {
        if (itemPositions[i] > maxScroll) {
          end = Math.min(items.length - 1, i + overscan);
          break;
        }
        end = i;
      }

      return { start, end: Math.min(end + overscan, items.length - 1) };
    },
    [items.length, itemPositions, overscan, getItemHeight]
  );

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;

    scrollPositionRef.current = scrollTop;

    // Update visible range
    const newRange = calculateVisibleRange(scrollTop, height);
    setVisibleRange(newRange);

    // Check if should load more
    if (
      onLoadMore &&
      hasMore &&
      !isLoading &&
      !isLoadingMoreRef.current
    ) {
      const scrollPercentage = (scrollTop + height) / totalHeight;

      if (scrollPercentage > threshold) {
        isLoadingMoreRef.current = true;
        onLoadMore().finally(() => {
          isLoadingMoreRef.current = false;
        });
      }
    }
  }, [
    calculateVisibleRange,
    onLoadMore,
    hasMore,
    isLoading,
    threshold,
    totalHeight,
  ]);

  // Handle container resize
  const handleResize = useCallback(() => {
    if (!containerRef.current) return;

    const height = containerRef.current.clientHeight;
    setContainerHeight(height);

    const newRange = calculateVisibleRange(scrollPositionRef.current, height);
    setVisibleRange(newRange);
  }, [calculateVisibleRange]);

  // Set up scroll and resize listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial setup
    handleResize();
    handleScroll();

    // Add event listeners
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // Set up ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [handleScroll, handleResize]);

  // Generate virtualized items
  const virtualItems: VirtualizedItem<T>[] = useMemo(() => {
    const items_: VirtualizedItem<T>[] = [];

    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      if (i >= items.length) break;

      items_.push({
        index: i,
        data: items[i],
        isVisible: true,
        style: {
          position: 'absolute',
          top: itemPositions[i],
          left: 0,
          right: 0,
          height: getItemHeight(i),
        },
      });
    }

    return items_;
  }, [visibleRange, items, itemPositions, getItemHeight]);

  return {
    containerRef,
    virtualItems,
    totalHeight,
    isLoading: isLoading || isLoadingMoreRef.current,
    scrollToIndex: (index: number, behavior: ScrollBehavior = 'smooth') => {
      if (!containerRef.current || !itemPositions[index]) return;

      containerRef.current.scrollTo({
        top: itemPositions[index],
        behavior,
      });
    },
  };
}

/**
 * Intersection Observer Hook for lazy loading images
 */
export function useLazyLoad(
  options: IntersectionObserverInit = {
    rootMargin: '50px',
    threshold: 0,
  }
) {
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver((entries) => {
      const updates = new Set(visibleElements);

      entries.forEach((entry) => {
        const id = entry.target.getAttribute('data-lazy-id');
        if (!id) return;

        if (entry.isIntersecting) {
          updates.add(id);
        }
      });

      if (updates.size !== visibleElements.size) {
        setVisibleElements(updates);
      }
    }, options);

    return () => {
      observer.current?.disconnect();
    };
  }, [options.rootMargin, options.threshold]);

  const observeElement = useCallback((element: Element | null) => {
    if (element && observer.current) {
      observer.current.observe(element);
    }
  }, []);

  const unobserveElement = useCallback((element: Element | null) => {
    if (element && observer.current) {
      observer.current.unobserve(element);
    }
  }, []);

  const isVisible = useCallback(
    (id: string) => visibleElements.has(id),
    [visibleElements]
  );

  return {
    observeElement,
    unobserveElement,
    isVisible,
    visibleElements,
  };
}

/**
 * Hook for prefetching next page of data
 */
export function usePrefetch<T>(
  fetchFn: (page: number) => Promise<T[]>,
  currentPage: number,
  enabled: boolean = true
) {
  const [prefetchedData, setPrefetchedData] = useState<Map<number, T[]>>(new Map());
  const [isPrefetching, setIsPrefetching] = useState(false);

  useEffect(() => {
    if (!enabled || isPrefetching) return;

    const nextPage = currentPage + 1;

    // Check if already prefetched
    if (prefetchedData.has(nextPage)) return;

    setIsPrefetching(true);

    // Prefetch next page
    fetchFn(nextPage)
      .then((data) => {
        setPrefetchedData((prev) => new Map(prev).set(nextPage, data));
      })
      .catch((error) => {
        console.error('Prefetch error:', error);
      })
      .finally(() => {
        setIsPrefetching(false);
      });
  }, [currentPage, enabled, fetchFn, isPrefetching, prefetchedData]);

  const getPrefetchedData = useCallback(
    (page: number): T[] | undefined => {
      return prefetchedData.get(page);
    },
    [prefetchedData]
  );

  const clearPrefetchedData = useCallback(() => {
    setPrefetchedData(new Map());
  }, []);

  return {
    getPrefetchedData,
    clearPrefetchedData,
    isPrefetching,
  };
}