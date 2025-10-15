'use client';

import { useState, useEffect } from 'react';
import {
  Download,
  FileArchive,
  FileText,
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

/**
 * Export Modal Component
 * Allows users to export their library content in various formats
 */
export default function ExportModal({
  isOpen,
  onClose,
  selectedItems = [],
  totalItems = 0,
}: ExportModalProps) {
  const { toast } = useToast();

  const [format, setFormat] = useState<ExportFormat>('zip');
  const [options, setOptions] = useState<ExportOptions>({
    includeTranscripts: true,
    includeDocuments: true,
    includeMetadata: true,
    includeMedia: true,
  });
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [estimatedSize, setEstimatedSize] = useState<number>(0);

  const isExporting = status === 'preparing' || status === 'downloading';
  const hasSelectedItems = selectedItems.length > 0;

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setProgress(0);
      setError(null);
    }
  }, [isOpen]);

  // Estimate export size
  useEffect(() => {
    const calculateSize = async () => {
      if (!isOpen) return;

      try {
        const params = new URLSearchParams({
          format,
          ids: selectedItems.join(','),
          ...Object.entries(options).reduce((acc, [key, value]) => {
            acc[key] = value.toString();
            return acc;
          }, {} as Record<string, string>),
        });

        const response = await fetch(`/api/library/export/estimate?${params}`);
        if (response.ok) {
          const data = await response.json();
          setEstimatedSize(data.data?.estimatedSize || 0);
        }
      } catch (error) {
        console.error('Failed to estimate export size:', error);
      }
    };

    calculateSize();
  }, [format, options, selectedItems, isOpen]);

  const handleExport = async () => {
    setStatus('preparing');
    setProgress(0);
    setError(null);

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
      setStatus('downloading');
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      const pollInterval = 5000; // 5 seconds

      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`/api/library/export/${exportId}/status`);
        const statusData = await statusResponse.json();

        if (statusData.data?.status === 'completed') {
          // Download the file
          const downloadUrl = statusData.data.downloadUrl;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = statusData.data.filename || `export-${Date.now()}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setStatus('success');
          setProgress(100);

          toast({
            title: 'Export complete',
            description: `Your ${format.toUpperCase()} export has been downloaded.`,
          });

          // Close modal after success
          setTimeout(() => {
            onClose();
          }, 2000);

          return;
        } else if (statusData.data?.status === 'failed') {
          throw new Error(statusData.data.error || 'Export failed');
        }

        // Update progress
        setProgress(statusData.data?.progress || (attempts / maxAttempts) * 90);

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      throw new Error('Export timed out');
    } catch (err: any) {
      console.error('Export error:', err);
      setStatus('error');
      setError(err.message || 'Failed to export content');

      toast({
        title: 'Export failed',
        description: err.message || 'Failed to export content',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (!isExporting) {
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
              onValueChange={(value) => setFormat(value as ExportFormat)}
              disabled={isExporting}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="zip" id="zip" />
                <Label htmlFor="zip" className="flex items-center cursor-pointer">
                  <FileArchive className="w-4 h-4 mr-2 text-muted-foreground" />
                  <div>
                    <div className="font-medium">ZIP Archive</div>
                    <div className="text-xs text-muted-foreground">
                      All files, transcripts, and documents
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center cursor-pointer">
                  <FileJson className="w-4 h-4 mr-2 text-muted-foreground" />
                  <div>
                    <div className="font-medium">JSON</div>
                    <div className="text-xs text-muted-foreground">
                      Metadata and text content only
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-muted-foreground" />
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="media"
                    checked={options.includeMedia}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeMedia: checked as boolean })
                    }
                    disabled={isExporting}
                  />
                  <Label htmlFor="media" className="text-sm cursor-pointer">
                    Media files (videos, audio)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="transcripts"
                    checked={options.includeTranscripts}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeTranscripts: checked as boolean })
                    }
                    disabled={isExporting}
                  />
                  <Label htmlFor="transcripts" className="text-sm cursor-pointer">
                    Transcripts
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="documents"
                    checked={options.includeDocuments}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeDocuments: checked as boolean })
                    }
                    disabled={isExporting}
                  />
                  <Label htmlFor="documents" className="text-sm cursor-pointer">
                    Generated documents
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metadata"
                    checked={options.includeMetadata}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeMetadata: checked as boolean })
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
                  {status === 'preparing' ? 'Preparing export...' : 'Downloading...'}
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Success Message */}
          {status === 'success' && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Export completed successfully!</span>
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && error && (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
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
            disabled={isExporting || (!options.includeMedia && !options.includeTranscripts && !options.includeDocuments && !options.includeMetadata && format === 'zip')}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {status === 'preparing' ? 'Preparing...' : 'Exporting...'}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}