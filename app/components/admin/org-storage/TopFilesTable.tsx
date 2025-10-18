'use client';

import { useEffect, useState } from 'react';
import { FileVideo, User, Calendar, HardDrive, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatBytes } from '@/lib/utils/formatting';

interface FileRecord {
  id: string;
  title: string;
  size: number;
  uploadedAt: string;
  userName: string;
  userId: string;
  mimeType: string;
  compressionRate: number;
  tier: 'hot' | 'warm' | 'cold' | 'glacier';
}

interface TopFilesTableProps {
  organizationId: string;
}

export default function TopFilesTable({ organizationId }: TopFilesTableProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const controller = new AbortController();

    const fetchFiles = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/analytics/organizations/${organizationId}/top-files?limit=${limit}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch top files');
        }

        const { data } = await response.json();

        // Guard state updates
        if (!controller.signal.aborted) {
          setFiles(data.files || []);
          setError(null);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching top files:', err);
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load files');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchFiles();

    return () => {
      controller.abort();
    };
  }, [organizationId, limit]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTierBadgeVariant = (tier: string): 'default' | 'secondary' | 'outline' => {
    switch (tier) {
      case 'hot':
        return 'default';
      case 'warm':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading top files: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileVideo className="h-5 w-5" />
              Largest Files
            </CardTitle>
            <CardDescription>
              Top {files.length} files by storage size
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={limit === 10 ? 'default' : 'outline'}
              onClick={() => setLimit(10)}
            >
              Top 10
            </Button>
            <Button
              size="sm"
              variant={limit === 25 ? 'default' : 'outline'}
              onClick={() => setLimit(25)}
            >
              Top 25
            </Button>
            <Button
              size="sm"
              variant={limit === 50 ? 'default' : 'outline'}
              onClick={() => setLimit(50)}
            >
              Top 50
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileVideo className="h-12 w-12 mx-auto mb-4" />
            <p className="text-sm">No files found for this organization</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
              <div className="col-span-4">File</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2">Tier</div>
              <div className="col-span-2">Uploaded By</div>
              <div className="col-span-1">Date</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Rows */}
            {files.map((file, index) => (
              <div
                key={file.id}
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-muted/50 rounded-lg transition-colors"
              >
                {/* File Info */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.title}</p>
                    <p className="text-xs text-muted-foreground">{file.mimeType}</p>
                  </div>
                </div>

                {/* Size */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{formatBytes(file.size)}</span>
                  </div>
                  {file.compressionRate > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {file.compressionRate.toFixed(0)}% compressed
                    </p>
                  )}
                </div>

                {/* Tier */}
                <div className="col-span-2">
                  <Badge variant={getTierBadgeVariant(file.tier)} className="text-xs">
                    {file.tier.toUpperCase()}
                  </Badge>
                </div>

                {/* User */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm truncate">{file.userName}</span>
                  </div>
                </div>

                {/* Date */}
                <div className="col-span-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  <Link href={`/recordings/${file.id}`} target="_blank">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Open recording in new tab">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
