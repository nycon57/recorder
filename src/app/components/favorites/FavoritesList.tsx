'use client';

import * as React from 'react';
import { Star, X, FileText, Video, Mic, FileType } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Separator } from '@/app/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ContentType } from '@/lib/types/database';

interface FavoriteItem {
  id: string;
  title: string;
  content_type: ContentType;
  created_at: string;
  thumbnail_url?: string | null;
}

interface FavoritesListProps {
  favorites: FavoriteItem[];
  onSelect: (item: FavoriteItem) => void;
  onRemove: (itemId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const CONTENT_TYPE_ICONS: Record<ContentType, React.ReactNode> = {
  recording: <Video className="size-4" />,
  video: <Video className="size-4" />,
  audio: <Mic className="size-4" />,
  document: <FileType className="size-4" />,
  text: <FileText className="size-4" />,
};

/**
 * FavoritesList Component
 * Quick access sidebar for favorited items
 *
 * Features:
 * - List all favorited items
 * - Quick navigation
 * - Remove from favorites
 * - Thumbnails for media
 * - Content type icons
 * - Empty state
 *
 * Usage:
 * <FavoritesList
 *   favorites={userFavorites}
 *   onSelect={navigateToItem}
 *   onRemove={removeFavorite}
 * />
 */
export function FavoritesList({
  favorites,
  onSelect,
  onRemove,
  isLoading = false,
  className,
}: FavoritesListProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Star className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No favorites yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Star items to quickly access them here
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Star className="size-4 fill-yellow-400 text-yellow-400" />
          Favorites
        </h3>
        <span className="text-xs text-muted-foreground">{favorites.length}</span>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-1">
          {favorites.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <Separator className="my-1" />}
              <div
                className="group flex items-start gap-3 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                onClick={() => onSelect(item)}
              >
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="size-12 object-cover rounded shrink-0"
                  />
                ) : (
                  <div className="size-12 rounded bg-muted flex items-center justify-center shrink-0">
                    {CONTENT_TYPE_ICONS[item.content_type]}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{item.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  aria-label="Remove from favorites"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </React.Fragment>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
