'use client';

import { useEffect, useState } from 'react';
import { FileVideo, FileAudio, FileImage, FileText, File } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatBytes, calculatePercentage } from '@/lib/utils/formatting';

interface FileTypeData {
  mimeType: string;
  count: number;
  storage: number;
  averageSize: number;
  compressionRate: number;
}

interface FileAnalyticsData {
  fileTypes: FileTypeData[];
  totalFiles: number;
  totalStorage: number;
}

export default function FileTypeAnalytics() {
  const [data, setData] = useState<FileAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/analytics/metrics');

        if (!response.ok) {
          throw new Error('Failed to fetch file type data');
        }

        const { data: metricsData } = await response.json();

        setData({
          fileTypes: metricsData.fileTypes || [],
          totalFiles: metricsData.summary?.totalFiles || 0,
          totalStorage: metricsData.summary?.totalStorage || 0,
        });
      } catch (err) {
        console.error('Error fetching file type data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('video/')) return <FileVideo className="h-4 w-4" />;
    if (mimeType.startsWith('audio/')) return <FileAudio className="h-4 w-4" />;
    if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4" />;
    if (mimeType.startsWith('text/')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const getFileTypeColor = (mimeType: string): string => {
    if (mimeType.startsWith('video/')) return 'text-blue-600 dark:text-blue-400';
    if (mimeType.startsWith('audio/')) return 'text-purple-600 dark:text-purple-400';
    if (mimeType.startsWith('image/')) return 'text-green-600 dark:text-green-400';
    if (mimeType.startsWith('text/')) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading file type data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* File Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>File Type Distribution</CardTitle>
          <CardDescription>
            Storage and compression effectiveness by file type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.fileTypes.length > 0 ? (
              data.fileTypes.map((fileType) => (
                <div key={fileType.mimeType} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={getFileTypeColor(fileType.mimeType)}>
                        {getFileIcon(fileType.mimeType)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{fileType.mimeType}</p>
                        <p className="text-xs text-muted-foreground">
                          {fileType.count.toLocaleString()} files • Avg. {formatBytes(fileType.averageSize)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {formatBytes(fileType.storage)}
                      </Badge>
                      {fileType.compressionRate > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {fileType.compressionRate.toFixed(1)}% compressed
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Storage Bar */}
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${calculatePercentage(fileType.storage, data.totalStorage)}%`
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {calculatePercentage(fileType.count, data.totalFiles).toFixed(1)}% of files
                    </span>
                    <span>
                      {calculatePercentage(fileType.storage, data.totalStorage).toFixed(1)}% of storage
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No file type data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compression Effectiveness */}
      <Card>
        <CardHeader>
          <CardTitle>Compression Effectiveness by Type</CardTitle>
          <CardDescription>
            How well different file types compress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.fileTypes
              .filter((ft) => ft.compressionRate > 0)
              .sort((a, b) => b.compressionRate - a.compressionRate)
              .map((fileType) => (
                <div key={`compression-${fileType.mimeType}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{fileType.mimeType}</span>
                    <Badge
                      variant={fileType.compressionRate >= 50 ? 'default' : fileType.compressionRate >= 25 ? 'secondary' : 'outline'}
                    >
                      {fileType.compressionRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        fileType.compressionRate >= 50 ? 'bg-green-600' :
                        fileType.compressionRate >= 25 ? 'bg-yellow-600' :
                        'bg-orange-600'
                      }`}
                      style={{ width: `${fileType.compressionRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saving {formatBytes(fileType.storage * (fileType.compressionRate / 100))} compared to uncompressed
                  </p>
                </div>
              ))}

            {data.fileTypes.filter((ft) => ft.compressionRate > 0).length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No compression data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Storage Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Files</p>
              <p className="text-2xl font-bold">{data.totalFiles.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Storage</p>
              <p className="text-2xl font-bold">{formatBytes(data.totalStorage)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">File Types</p>
              <p className="text-2xl font-bold">{data.fileTypes.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Avg. File Size</p>
              <p className="text-2xl font-bold">
                {data.totalFiles > 0 ? formatBytes(data.totalStorage / data.totalFiles) : '0 B'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
