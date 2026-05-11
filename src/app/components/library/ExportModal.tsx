'use client';

import { useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  FileJson,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Progress } from '@/app/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { useToast } from '@/app/components/ui/use-toast';
import { formatFileSize } from '@/lib/types/content';

type ExportFormat = 'zip' | 'json' | 'csv';
type ExportStatus = 'idle' | 'preparing' | 'downloading' | 'success' | 'error';

interface ExportOptions {
  includeTranscripts: boolean;
  includeDocuments: boolean;
  includeMetadata: boolean;
  includeMedia: boolean;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems?: string[];
  totalItems?: number;
}

const EMPTY_SELECTED_ITEMS: string[] = [];

/**
 * Export Modal Component
 * Allows users to export their library content in various formats
 */
export default function ExportModal(
  props: Parameters<typeof useExportModalImplementation>[0],
) {
  return useExportModalImplementation(props);
}

function useExportModalImplementation({
  isOpen,
  onClose,
  selectedItems = EMPTY_SELECTED_ITEMS,
  totalItems = 0,
}: ExportModalProps) {
  const { toast } = useToast();

  const [state, dispatch] = useReducer(
    (
      current: {
        format: ExportFormat;
        options: ExportOptions;
        status: ExportStatus;
        progress: number;
        error: string | null;
      },
      patch: Partial<{
        format: ExportFormat;
        options: ExportOptions;
        status: ExportStatus;
        progress: number;
        error: string | null;
      }>,
    ) => ({ ...current, ...patch }),
    {
      format: 'zip' as ExportFormat,
      options: {
        includeTranscripts: true,
        includeDocuments: true,
        includeMetadata: true,
        includeMedia: true,
      },
      status: 'idle' as ExportStatus,
      progress: 0,
      error: null,
    },
  );
  const { format, options, status, progress, error } = state;

  const isExporting = status === 'preparing' || status === 'downloading';
  const hasSelectedItems = selectedItems.length > 0;

  const resetExportState = () => {
    dispatch({ status: 'idle', progress: 0, error: null });
  };

  const { data: estimatedSize = 0 } = useQuery<number>({
    queryKey: ['library', 'export', 'estimate', format, options, selectedItems],
    enabled: isOpen,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        format,
        ids: selectedItems.join(','),
        ...Object.entries(options).reduce(
          (acc, [key, value]) => {
            acc[key] = value.toString();
            return acc;
          },
          {} as Record<string, string>,
        ),
      });

      const response = await fetch(`/api/library/export/estimate?${params}`, {
        signal,
      });
      if (!response.ok) return 0;

      const data = await response.json();
      return data.data?.estimatedSize || 0;
    },
  });

  const handleExport = async () => {
    dispatch({ status: 'preparing', progress: 0, error: null });

    try {
      // Prepare export request
      const body = {
        format,
        options,
        recordingIds: hasSelectedItems ? selectedItems : undefined,
      };

      // Create export on server
      const response = await fetch('/api/library/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      const result = await response.json();
      const exportId = result.data?.exportId;

      if (!exportId) {
        throw new Error('No export ID received');
      }

      // Poll for export status
      dispatch({ status: 'downloading' });
      const maxAttempts = 60; // 5 minutes max
      const pollInterval = 5000; // 5 seconds

      const pollExportStatus = async (attempt: number): Promise<void> => {
        if (attempt >= maxAttempts) {
          throw new Error('Export timed out');
        }

        const statusResponse = await fetch(
          `/api/library/export/${exportId}/status`,
        );
        const statusData = await statusResponse.json();

        if (statusData.data?.status === 'completed') {
          // Download the file
          const downloadUrl = statusData.data.downloadUrl;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download =
            statusData.data.filename || `export-${Date.now()}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          dispatch({ status: 'success', progress: 100 });

          toast({
            title: 'Export complete',
            description: `Your ${format.toUpperCase()} export has been downloaded.`,
          });

          // Close modal after success
          setTimeout(() => {
            resetExportState();
            onClose();
          }, 2000);

          return;
        } else if (statusData.data?.status === 'failed') {
          throw new Error(statusData.data.error || 'Export failed');
        }

        // Update progress
        dispatch({
          progress: statusData.data?.progress || (attempt / maxAttempts) * 90,
        });

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        return pollExportStatus(attempt + 1);
      };

      await pollExportStatus(0);
    } catch (err) {
      console.error('Export error:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to export content';
      dispatch({ status: 'error', error: message });

      toast({
        title: 'Export failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      resetExportState();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Library</DialogTitle>
          <DialogDescription>
            {hasSelectedItems
              ? `Export ${selectedItems.length} selected ${
                  selectedItems.length === 1 ? 'item' : 'items'
                }`
              : `Export all ${totalItems} items from your library`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) =>
                dispatch({ format: value as ExportFormat })
              }
              disabled={isExporting}
            >
              <div className="flex items-center gap-x-2">
                <RadioGroupItem value="zip" id="zip" />
                <Label
                  htmlFor="zip"
                  className="flex items-center cursor-pointer"
                >
                  <FileArchive className="size-4 mr-2 text-muted-foreground" />
                  <div>
                    <div className="font-medium">ZIP Archive</div>
                    <div className="text-xs text-muted-foreground">
                      All files, transcripts, and documents
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center gap-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label
                  htmlFor="json"
                  className="flex items-center cursor-pointer"
                >
                  <FileJson className="size-4 mr-2 text-muted-foreground" />
                  <div>
                    <div className="font-medium">JSON</div>
                    <div className="text-xs text-muted-foreground">
                      Metadata and text content only
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center gap-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label
                  htmlFor="csv"
                  className="flex items-center cursor-pointer"
                >
                  <FileSpreadsheet className="size-4 mr-2 text-muted-foreground" />
                  <div>
                    <div className="font-medium">CSV</div>
                    <div className="text-xs text-muted-foreground">
                      Table view with basic metadata
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Export Options */}
          {format === 'zip' && (
            <div className="space-y-3">
              <Label>Include in Export</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-x-2">
                  <Checkbox
                    id="media"
                    checked={options.includeMedia}
                    onCheckedChange={(checked) =>
                      dispatch({
                        options: {
                          ...options,
                          includeMedia: checked as boolean,
                        },
                      })
                    }
                    disabled={isExporting}
                  />
                  <Label htmlFor="media" className="text-sm cursor-pointer">
                    Media files (videos, audio)
                  </Label>
                </div>
                <div className="flex items-center gap-x-2">
                  <Checkbox
                    id="transcripts"
                    checked={options.includeTranscripts}
                    onCheckedChange={(checked) =>
                      dispatch({
                        options: {
                          ...options,
                          includeTranscripts: checked as boolean,
                        },
                      })
                    }
                    disabled={isExporting}
                  />
                  <Label
                    htmlFor="transcripts"
                    className="text-sm cursor-pointer"
                  >
                    Transcripts
                  </Label>
                </div>
                <div className="flex items-center gap-x-2">
                  <Checkbox
                    id="documents"
                    checked={options.includeDocuments}
                    onCheckedChange={(checked) =>
                      dispatch({
                        options: {
                          ...options,
                          includeDocuments: checked as boolean,
                        },
                      })
                    }
                    disabled={isExporting}
                  />
                  <Label htmlFor="documents" className="text-sm cursor-pointer">
                    Generated documents
                  </Label>
                </div>
                <div className="flex items-center gap-x-2">
                  <Checkbox
                    id="metadata"
                    checked={options.includeMetadata}
                    onCheckedChange={(checked) =>
                      dispatch({
                        options: {
                          ...options,
                          includeMetadata: checked as boolean,
                        },
                      })
                    }
                    disabled={isExporting}
                  />
                  <Label htmlFor="metadata" className="text-sm cursor-pointer">
                    Metadata (titles, descriptions, tags)
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Size Estimate */}
          {estimatedSize > 0 && (
            <Alert>
              <AlertDescription className="text-sm">
                Estimated export size: {formatFileSize(estimatedSize)}
              </AlertDescription>
            </Alert>
          )}

          {/* Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {status === 'preparing'
                    ? 'Preparing export...'
                    : 'Downloading...'}
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Success Message */}
          {status === 'success' && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-medium">
                Export completed successfully!
              </span>
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && error && (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="size-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={
              isExporting ||
              (!options.includeMedia &&
                !options.includeTranscripts &&
                !options.includeDocuments &&
                !options.includeMetadata &&
                format === 'zip')
            }
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {status === 'preparing' ? 'Preparing...' : 'Exporting...'}
              </>
            ) : (
              <>
                <Download className="mr-2 size-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
