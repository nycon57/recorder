'use client';

import { formatDistanceToNow, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
  FileVideo,
  FileText,
  FolderPlus,
  Tag,
  Star,
  Share2,
  Trash2,
  Edit,
  User,
  Search,
  FileAudio,
  File,
  LogIn,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ActivityFeedItem, ActivityAction } from '@/lib/types/phase8';

interface ActivityItemProps {
  activity: ActivityFeedItem;
  className?: string;
}

const actionIcons: Record<ActivityAction, typeof FileVideo> = {
  'recording.created': FileVideo,
  'recording.updated': Edit,
  'recording.deleted': Trash2,
  'recording.shared': Share2,
  'recording.favorited': Star,
  'recording.unfavorited': Star,
  'collection.created': FolderPlus,
  'collection.updated': Edit,
  'collection.deleted': Trash2,
  'collection.item_added': FolderPlus,
  'collection.item_removed': FolderPlus,
  'tag.created': Tag,
  'tag.updated': Edit,
  'tag.deleted': Trash2,
  'tag.applied': Tag,
  'tag.removed': Tag,
  'document.generated': FileText,
  'document.updated': Edit,
  'search.executed': Search,
  'user.login': LogIn,
};

const actionVerbs: Record<ActivityAction, string> = {
  'recording.created': 'created',
  'recording.updated': 'updated',
  'recording.deleted': 'deleted',
  'recording.shared': 'shared',
  'recording.favorited': 'favorited',
  'recording.unfavorited': 'unfavorited',
  'collection.created': 'created collection',
  'collection.updated': 'updated collection',
  'collection.deleted': 'deleted collection',
  'collection.item_added': 'added item to',
  'collection.item_removed': 'removed item from',
  'tag.created': 'created tag',
  'tag.updated': 'updated tag',
  'tag.deleted': 'deleted tag',
  'tag.applied': 'applied tag to',
  'tag.removed': 'removed tag from',
  'document.generated': 'generated document for',
  'document.updated': 'updated document for',
  'search.executed': 'searched for',
  'user.login': 'logged in',
};

const getContentTypeIcon = (contentType: string) => {
  switch (contentType) {
    case 'video':
    case 'recording':
      return FileVideo;
    case 'audio':
      return FileAudio;
    case 'document':
      return FileText;
    default:
      return File;
  }
};

export function ActivityItem({ activity, className }: ActivityItemProps) {
  const router = useRouter();
  const Icon = actionIcons[activity.action] || File;
  const verb = actionVerbs[activity.action] || activity.action;

  const handleClick = () => {
    if (activity.resource_type === 'recording' && activity.resource_id) {
      router.push(`/recordings/${activity.resource_id}`);
    } else if (activity.resource_type === 'collection' && activity.resource_id) {
      router.push(`/collections/${activity.resource_id}`);
    }
  };

  const getUserInitials = (name: string | null) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatActivityText = () => {
    const resourceLink = activity.resource_title ? (
      <button
        onClick={handleClick}
        className="font-medium text-foreground hover:underline"
      >
        {activity.resource_title}
      </button>
    ) : (
      <span className="font-medium text-foreground">
        {activity.resource_type}
      </span>
    );

    // Special formatting for search
    if (activity.action === 'search.executed') {
      return (
        <>
          <span className="text-muted-foreground">searched for</span>{' '}
          <span className="font-medium text-foreground">
            "{activity.metadata?.query || 'unknown'}"
          </span>
        </>
      );
    }

    // Special formatting for login
    if (activity.action === 'user.login') {
      return <span className="text-muted-foreground">logged in</span>;
    }

    return (
      <>
        <span className="text-muted-foreground">{verb}</span> {resourceLink}
      </>
    );
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer',
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* User Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={activity.user_avatar || undefined} alt={activity.user_name || 'User'} />
        <AvatarFallback>{getUserInitials(activity.user_name)}</AvatarFallback>
      </Avatar>

      {/* Activity Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm">
          <span className="font-medium text-foreground">
            {activity.user_name || 'Someone'}
          </span>{' '}
          {formatActivityText()}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            <span>{activity.resource_type}</span>
          </div>
          <span>•</span>
          <time
            dateTime={activity.created_at}
            title={new Date(activity.created_at).toLocaleString()}
          >
            {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
          </time>
        </div>

        {/* Additional metadata */}
        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {activity.metadata.tags && Array.isArray(activity.metadata.tags) && (
              <div className="flex gap-1">
                {activity.metadata.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Icon */}
      <div
        className={cn(
          'p-2 rounded-md shrink-0',
          'bg-muted group-hover:bg-muted/70',
          activity.action.includes('deleted') && 'text-red-500',
          activity.action.includes('favorited') && !activity.action.includes('unfavorited') && 'text-yellow-500',
          activity.action.includes('shared') && 'text-blue-500',
          activity.action.includes('created') && 'text-green-500'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}