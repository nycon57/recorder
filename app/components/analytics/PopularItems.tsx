'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Button } from '@/app/components/ui/button';
import {
  Eye,
  Share2,
  Star,
  Search,
  FileVideo,
  FileAudio,
  FileText,
  File,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { PopularItem } from '@/lib/types/phase8';

interface PopularItemsProps {
  orgId?: string;
  className?: string;
}

type MetricType = 'views' | 'shares' | 'favorites' | 'searches';
type TimeframeType = '7d' | '30d' | '90d' | 'all';

const METRIC_ICONS = {
  views: Eye,
  shares: Share2,
  favorites: Star,
  searches: Search,
};

const CONTENT_TYPE_ICONS = {
  recording: FileVideo,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  text: File,
};

const METRIC_LABELS: Record<MetricType, string> = {
  views: 'Most Viewed',
  shares: 'Most Shared',
  favorites: 'Most Favorited',
  searches: 'Most Searched',
};

const TIMEFRAME_LABELS: Record<TimeframeType, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
};

export function PopularItems({ orgId, className }: PopularItemsProps) {
  const router = useRouter();
  const [items, setItems] = useState<PopularItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metric, setMetric] = useState<MetricType>('views');
  const [timeframe, setTimeframe] = useState<TimeframeType>('30d');

  useEffect(() => {
    fetchPopularItems();
  }, [orgId, metric, timeframe]);

  const fetchPopularItems = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (orgId) params.append('org_id', orgId);
      params.append('metric', metric);
      params.append('timeframe', timeframe);

      const response = await fetch(`/api/analytics/popular?${params.toString()}`);

      if (!response.ok) throw new Error('Failed to fetch popular items');

      const result = await response.json();
      setItems(result.data.items || []);
    } catch (error) {
      console.error('Error fetching popular items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const MetricIcon = METRIC_ICONS[metric];

  const handleItemClick = (recordingId: string) => {
    router.push(`/recordings/${recordingId}`);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{METRIC_LABELS[metric]}</CardTitle>
            <CardDescription>
              Top performing content in your library
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="views">Views</SelectItem>
                <SelectItem value="shares">Shares</SelectItem>
                <SelectItem value="favorites">Favorites</SelectItem>
                <SelectItem value="searches">Searches</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as TimeframeType)}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No data available for the selected period
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const Icon = item.content_type
                ? CONTENT_TYPE_ICONS[item.content_type] || File
                : File;

              return (
                <div
                  key={item.recording_id}
                  className="group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleItemClick(item.recording_id)}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-semibold">
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className="p-2 rounded-md bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {item.title || 'Untitled'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MetricIcon className="h-3 w-3" />
                        <span className="font-medium">{item.metric_value.toLocaleString()}</span>
                        <span>{metric}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(parseISO(item.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Trend indicator */}
                  {index === 0 && (
                    <Badge variant="default" className="gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Top
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => router.push('/library')}
          >
            View All in Library
          </Button>
        )}
      </CardContent>
    </Card>
  );
}