'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  VideoIcon,
  FileVideoIcon,
  AudioLinesIcon,
  FileTextIcon,
  FileEditIcon,
  Clock,
  HardDrive,
} from 'lucide-react';

import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import type { ContentType } from '@/lib/types/database';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  formatFileSize,
} from '@/lib/types/content';

interface RecentItem {
  id: string;
  title: string | null;
  description: string | null;
  content_type: ContentType | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  duration_sec: number | null;
  file_size: number | null;
}

interface RecentItemsProps {
  items: RecentItem[];
  isLoading?: boolean;
}

const contentTypeIcons: Record<ContentType, typeof VideoIcon> = {
  recording: VideoIcon,
  video: FileVideoIcon,
  audio: AudioLinesIcon,
  document: FileTextIcon,
  text: FileEditIcon,
};

export function RecentItems({ items, isLoading = false }: RecentItemsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Recent Items</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null; // EmptyState will be shown by parent
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Recent Items</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => {
          const contentType = item.content_type || 'recording';
          const Icon = contentTypeIcons[contentType];
          const colors = CONTENT_TYPE_COLORS[contentType];
          const label = CONTENT_TYPE_LABELS[contentType];

          return (
            <Link
              key={item.id}
              href={`/library/${item.id}`}
              className="group text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl"
              aria-label={`View ${item.title || 'Untitled'}`}
            >
              <Card className="h-full overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:scale-[1.02]">
                {/* Thumbnail or Icon */}
                <div className={`relative h-32 ${colors.bg} flex items-center justify-center`}>
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title || 'Thumbnail'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon className={`size-12 ${colors.text}`} />
                  )}

                  {/* Badge overlay */}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="shadow-sm">
                      {label}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  {/* Title */}
                  <h3 className="font-semibold text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                    {item.title || 'Untitled'}
                  </h3>

                  {/* Metadata */}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3" />
                      <span>
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true
                        })}
                      </span>
                    </div>

                    {item.file_size && (
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="size-3" />
                        <span>{formatFileSize(item.file_size)}</span>
                      </div>
                    )}

                    {item.duration_sec && (
                      <div className="flex items-center gap-1.5">
                        <VideoIcon className="size-3" />
                        <span>
                          {Math.floor(item.duration_sec / 60)}:
                          {String(Math.floor(item.duration_sec % 60)).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
