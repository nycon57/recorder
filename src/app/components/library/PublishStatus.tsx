'use client';

import * as React from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  ExternalLink,
  FileUp,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PublishedDocument, PublishStatus } from '@/lib/types/publishing';

// =====================================================
// TYPES
// =====================================================

interface PublishStatusProps {
  /** Content ID to fetch publications for */
  contentId: string;
  /** Optional pre-fetched publications */
  publications?: PublishedDocument[];
  /** Display variant */
  variant?: 'compact' | 'full';
  /** Callback to open publish modal */
  onPublish?: () => void;
  /** Callback to refresh publications list */
  onRefresh?: () => void;
}

// =====================================================
// CONSTANTS
// =====================================================

const destinationIcons: Record<
  PublishedDocument['destination'],
  React.ReactNode
> = {
  google_drive: <span className="text-base">📁</span>,
  sharepoint: <span className="text-base">📊</span>,
  onedrive: <span className="text-base">☁️</span>,
  notion: <span className="text-base">📝</span>,
};

const destinationNames: Record<PublishedDocument['destination'], string> = {
  google_drive: 'Google Drive',
  sharepoint: 'SharePoint',
  onedrive: 'OneDrive',
  notion: 'Notion',
};

const statusConfig: Record<
  PublishStatus,
  {
    label: string;
    icon: React.ReactNode;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    color: string;
  }
> = {
  published: {
    label: 'Synced',
    icon: <Check className="size-3" />,
    variant: 'default',
    color: 'text-green-600 dark:text-green-400',
  },
  syncing: {
    label: 'Syncing',
    icon: <Loader2 className="size-3 animate-spin" />,
    variant: 'secondary',
    color: 'text-blue-600 dark:text-blue-400',
  },
  pending: {
    label: 'Pending',
    icon: <Clock className="size-3" />,
    variant: 'outline',
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  outdated: {
    label: 'Outdated',
    icon: <AlertCircle className="size-3" />,
    variant: 'outline',
    color: 'text-orange-600 dark:text-orange-400',
  },
  failed: {
    label: 'Failed',
    icon: <AlertCircle className="size-3" />,
    variant: 'destructive',
    color: 'text-red-600 dark:text-red-400',
  },
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function PublishStatus({
  contentId,
  publications: initialPublications,
  variant = 'full',
  onPublish,
  onRefresh,
}: PublishStatusProps) {
  const [publications, setPublications] = React.useState<PublishedDocument[]>(
    initialPublications ?? []
  );
  const [isLoading, setIsLoading] = React.useState(!initialPublications);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch publications if not provided
  React.useEffect(() => {
    if (initialPublications) {
      setPublications(initialPublications);
      return;
    }

    const fetchPublications = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/library/${contentId}/publish`);

        if (!response.ok) {
          throw new Error('Failed to fetch publications');
        }

        const data = await response.json();
        setPublications(data.publications ?? []);
      } catch (err) {
        console.error('Error fetching publications:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        toast.error('Failed to load publication status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublications();
  }, [contentId, initialPublications]);

  // Refresh publications
  const handleRefresh = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/library/${contentId}/publish`);

      if (!response.ok) {
        throw new Error('Failed to fetch publications');
      }

      const data = await response.json();
      setPublications(data.publications ?? []);
      toast.success('Publications refreshed');
      onRefresh?.();
    } catch (err) {
      console.error('Error refreshing publications:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to refresh publications');
    } finally {
      setIsLoading(false);
    }
  }, [contentId, onRefresh]);

  if (isLoading && !publications.length) {
    return variant === 'compact' ? (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="size-3 animate-spin" />
        <span className="sr-only">Loading publications</span>
      </Badge>
    ) : (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="sr-only">Loading publications</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return variant === 'compact' ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="size-3" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Error loading publications</p>
        </TooltipContent>
      </Tooltip>
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (publications.length === 0) {
    return variant === 'compact' ? (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onPublish}
        aria-label="Publish document"
      >
        <FileUp className="size-4 text-muted-foreground" />
      </Button>
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <FileUp className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Not published</p>
            <p className="text-sm text-muted-foreground">
              Share this document to your connected platforms
            </p>
          </div>
          {onPublish && (
            <Button onClick={onPublish} size="sm">
              <FileUp className="size-4" />
              Publish
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <CompactView
        publications={publications}
        onPublish={onPublish}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />
    );
  }

  return (
    <FullView
      contentId={contentId}
      publications={publications}
      onPublish={onPublish}
      onRefresh={handleRefresh}
      isRefreshing={isLoading}
    />
  );
}

// =====================================================
// COMPACT VIEW
// =====================================================

interface CompactViewProps {
  publications: PublishedDocument[];
  onPublish?: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function CompactView({
  publications,
  onPublish,
  onRefresh,
  isRefreshing,
}: CompactViewProps) {
  const destinationSummary = publications
    .map((pub) => destinationNames[pub.destination])
    .join(', ');

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-muted/50"
              aria-label={`${publications.length} publication${publications.length === 1 ? '' : 's'}`}
            >
              <FileUp className="size-3" />
              {publications.length}
            </Badge>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Published to:</p>
          <p className="text-xs">{destinationSummary}</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Publications ({publications.length})
        </div>
        <DropdownMenuSeparator />

        {publications.map((pub) => (
          <DropdownMenuItem
            key={pub.id}
            className="flex items-center justify-between gap-2"
            onSelect={(e) => {
              e.preventDefault();
              window.open(pub.externalUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {destinationIcons[pub.destination]}
              <span className="truncate text-sm">
                {destinationNames[pub.destination]}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={cn('text-xs', statusConfig[pub.status].color)}>
                {statusConfig[pub.status].icon}
              </span>
              <ExternalLink className="size-3 text-muted-foreground" />
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onRefresh} disabled={isRefreshing}>
          <RefreshCw
            className={cn('size-4', isRefreshing && 'animate-spin')}
          />
          Refresh
        </DropdownMenuItem>

        {onPublish && (
          <DropdownMenuItem onSelect={onPublish}>
            <FileUp className="size-4" />
            Publish to another location
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =====================================================
// FULL VIEW
// =====================================================

interface FullViewProps {
  contentId: string;
  publications: PublishedDocument[];
  onPublish?: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function FullView({
  contentId,
  publications,
  onPublish,
  onRefresh,
  isRefreshing,
}: FullViewProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Published Locations</CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh publications"
          >
            <RefreshCw
              className={cn('size-4', isRefreshing && 'animate-spin')}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="divide-y">
        {publications.map((pub) => (
          <PublicationItem key={pub.id} contentId={contentId} publication={pub} onRefresh={onRefresh} />
        ))}
      </CardContent>

      {onPublish && (
        <div className="px-6 pb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={onPublish}
            className="w-full"
          >
            <FileUp className="size-4" />
            Publish to another location
          </Button>
        </div>
      )}
    </Card>
  );
}

// =====================================================
// PUBLICATION ITEM
// =====================================================

interface PublicationItemProps {
  contentId: string;
  publication: PublishedDocument;
  onRefresh: () => void;
}

function PublicationItem({ contentId, publication, onRefresh }: PublicationItemProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/library/${contentId}/publish/${publication.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete publication');
      }

      toast.success('Publication removed');
      onRefresh();
    } catch (err) {
      console.error('Error deleting publication:', err);
      toast.error('Failed to remove publication');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch(
        `/api/library/${contentId}/publish/${publication.id}/sync`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync publication');
      }

      toast.success('Publication synced');
      onRefresh();
    } catch (err) {
      console.error('Error syncing publication:', err);
      toast.error('Failed to sync publication');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdate = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch(
        `/api/library/${contentId}/publish/${publication.id}/update`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update publication');
      }

      toast.success('Publication updated');
      onRefresh();
    } catch (err) {
      console.error('Error updating publication:', err);
      toast.error('Failed to update publication');
    } finally {
      setIsSyncing(false);
    }
  };

  const statusInfo = statusConfig[publication.status];

  return (
    <>
      <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5">{destinationIcons[publication.destination]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium">
                {destinationNames[publication.destination]}
              </p>
              <Badge
                variant={statusInfo.variant}
                className={cn('gap-1', statusInfo.color)}
              >
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            </div>

            {publication.folderPath && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {publication.folderPath}
              </p>
            )}

            {publication.lastPublishedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Last published:{' '}
                {new Date(publication.lastPublishedAt).toLocaleDateString(
                  undefined,
                  {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )}
              </p>
            )}

            {publication.lastError && (
              <p className="text-xs text-destructive mt-1">
                Error: {publication.lastError}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  window.open(
                    publication.externalUrl,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
                aria-label={`View in ${destinationNames[publication.destination]}`}
              >
                <ExternalLink className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View in {destinationNames[publication.destination]}</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Publication actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    publication.externalUrl,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              >
                <ExternalLink className="size-4" />
                View in {destinationNames[publication.destination]}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleSync} disabled={isSyncing}>
                <RefreshCw
                  className={cn('size-4', isSyncing && 'animate-spin')}
                />
                Re-sync
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleUpdate} disabled={isSyncing}>
                <FileUp className="size-4" />
                Update with latest content
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
                Remove publication
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove publication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the publication record from Tribora. The document
              will remain in {destinationNames[publication.destination]}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
