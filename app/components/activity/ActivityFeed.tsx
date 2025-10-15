'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityItem } from './ActivityItem';
import { ActivityFilter } from './ActivityFilter';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Button } from '@/app/components/ui/button';
import { RefreshCw, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityFeedItem, ActivityAction } from '@/lib/types/phase8';

interface ActivityFeedProps {
  orgId?: string;
  userId?: string;
  limit?: number;
  showFilters?: boolean;
  className?: string;
}

export function ActivityFeed({
  orgId,
  userId,
  limit = 20,
  showFilters = true,
  className,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<{
    actions?: ActivityAction[];
    users?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  }>({});

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchActivities = async (reset = false) => {
    try {
      setIsLoading(true);
      const currentOffset = reset ? 0 : offset;

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString(),
      });

      if (orgId) params.append('org_id', orgId);
      if (userId) params.append('user_id', userId);
      if (filters.actions?.length) {
        params.append('actions', filters.actions.join(','));
      }
      if (filters.users?.length) {
        params.append('users', filters.users.join(','));
      }
      if (filters.dateFrom) {
        params.append('date_from', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        params.append('date_to', filters.dateTo.toISOString());
      }

      const response = await fetch(`/api/activity?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch activities');

      const data = await response.json();

      if (reset) {
        setActivities(data.data.activities);
        setOffset(limit);
      } else {
        setActivities(prev => [...prev, ...data.data.activities]);
        setOffset(prev => prev + limit);
      }

      setHasMore(data.data.pagination.hasMore);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(true);
  }, [filters]);

  // Infinite scroll setup
  useEffect(() => {
    if (!hasMore || isLoading) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          fetchActivities();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, offset]);

  const groupActivitiesByDate = (activities: ActivityFeedItem[]) => {
    const groups: Record<string, ActivityFeedItem[]> = {};

    activities.forEach(activity => {
      const date = parseISO(activity.created_at);
      let groupKey: string;

      if (isToday(date)) {
        groupKey = 'Today';
      } else if (isYesterday(date)) {
        groupKey = 'Yesterday';
      } else if (isThisWeek(date)) {
        groupKey = 'This Week';
      } else {
        groupKey = format(date, 'MMMM d, yyyy');
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(activity);
    });

    return groups;
  };

  const handleRefresh = () => {
    fetchActivities(true);
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const groupedActivities = groupActivitiesByDate(activities);

  if (isLoading && activities.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0 && !isLoading) {
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <Activity className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
        <p className="text-muted-foreground text-sm">
          Activities will appear here as your team uses the platform
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {showFilters && (
        <div className="flex items-center justify-between">
          <ActivityFilter
            onFilterChange={handleFilterChange}
            initialFilters={filters}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      )}

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {Object.entries(groupedActivities).map(([date, activities]) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-1"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {date}
              </h3>
              <div className="space-y-1">
                {activities.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ActivityItem activity={activity} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {hasMore && (
        <div ref={loadMoreRef} className="py-4 text-center">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading more...</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchActivities()}
            >
              Load more activities
            </Button>
          )}
        </div>
      )}
    </div>
  );
}