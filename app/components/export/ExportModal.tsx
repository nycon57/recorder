'use client';

import { useState } from 'react';
import { useToast } from '@/app/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { ExportProgressDialog } from './ExportProgressDialog';
import {
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  FileText,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';
import type { ExportOptions, ExportResult } from '@/lib/types/phase8';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems?: string[];
  onExportComplete?: (result: ExportResult) => void;
}

type ExportFormat = 'zip' | 'json' | 'csv' | 'markdown';

const FORMAT_ICONS: Record<ExportFormat, typeof FileArchive> = {
  zip: FileArchive,
  json: FileJson,
  csv: FileSpreadsheet,
  markdown: FileText,
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  zip: 'ZIP Archive',
  json: 'JSON Data',
  csv: 'CSV Spreadsheet',
  markdown: 'Markdown Documents',
};

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  zip: 'Complete archive with all files and metadata',
  json: 'Structured data for integration with other systems',
  csv: 'Tabular data for spreadsheet applications',
  markdown: 'Formatted documents for documentation systems',
};

export function ExportModal({
  isOpen,
  onClose,
  selectedItems = [],
  onExportComplete,
}: ExportModalProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ExportFormat>('zip');
  const [includeTranscripts, setIncludeTranscripts] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setShowProgress(true);

    try {
      const exportOptions: ExportOptions = {
        format,
        include_transcripts: includeTranscripts,
        include_documents: includeDocuments,
        include_metadata: includeMetadata,
      };

      const response = await fetch('/api/library/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recording_ids: selectedItems,
          options: exportOptions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Export failed: ${response.statusText}`);
      }

      // Get the file as a blob
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `export-${Date.now()}.${format}`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Create a result object for the progress dialog
      const result: ExportResult = {
        download_url: url,
        file_size_bytes: blob.size,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      };

      setExportResult(result);
      onExportComplete?.(result);
    } catch (error) {
      console.error('Export error:', error);
      setShowProgress(false);
      setExportResult(null);

      // Show user-facing error notification
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setFormat('zip');
      setIncludeTranscripts(true);
      setIncludeDocuments(true);
      setIncludeMetadata(true);
      setExportResult(null);
      onClose();
    }
  };

  const estimateSize = () => {
    // Rough estimate based on selected options
    let sizeEstimate = selectedItems.length * 50000; // 50KB base per item

    if (includeTranscripts) sizeEstimate += selectedItems.length * 10000; // 10KB per transcript
    if (includeDocuments) sizeEstimate += selectedItems.length * 20000; // 20KB per document
    if (includeMetadata) sizeEstimate += selectedItems.length * 5000; // 5KB per metadata

    if (format === 'zip') sizeEstimate *= 0.6; // Compression estimate

    return sizeEstimate;
  };

  const FormatIcon = FORMAT_ICONS[format];

  return (
    <>
      <Dialog open={isOpen && !showProgress} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Library Items</DialogTitle>
            <DialogDescription>
              Export {selectedItems.length || 'all'} selected items from your library
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as ExportFormat)}
                disabled={isExporting}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <FormatIcon className="h-4 w-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((fmt) => {
                    const Icon = FORMAT_ICONS[fmt];
                    return (
                      <SelectItem key={fmt} value={fmt}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{FORMAT_LABELS[fmt]}</p>
                            <p className="text-xs text-muted-foreground">
                              {FORMAT_DESCRIPTIONS[fmt]}
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Export Options */}
            <div className="space-y-3">
              <Label>Include in Export</Label>

              <div className="space-y-2">
                <label
                  className={cn(
                    'flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-muted/50',
                    isExporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    id="transcripts"
                    checked={includeTranscripts}
                    onCheckedChange={(checked) => setIncludeTranscripts(!!checked)}
                    disabled={isExporting || format === 'csv'}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="transcripts"
                      className="cursor-pointer font-normal"
                    >
                      Transcripts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Include speech-to-text transcriptions
                    </p>
                  </div>
                </label>

                <label
                  className={cn(
                    'flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-muted/50',
                    isExporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    id="documents"
                    checked={includeDocuments}
                    onCheckedChange={(checked) => setIncludeDocuments(!!checked)}
                    disabled={isExporting || format === 'csv'}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="documents"
                      className="cursor-pointer font-normal"
                    >
                      Generated Documents
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Include AI-generated documentation
                    </p>
                  </div>
                </label>

                <label
                  className={cn(
                    'flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-muted/50',
                    isExporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    id="metadata"
                    checked={includeMetadata}
                    onCheckedChange={(checked) => setIncludeMetadata(!!checked)}
                    disabled={isExporting}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="metadata"
                      className="cursor-pointer font-normal"
                    >
                      Metadata
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Include timestamps, tags, and other metadata
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Format-specific Info */}
            {format === 'csv' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  CSV format exports metadata only and doesn't include file content
                </AlertDescription>
              </Alert>
            )}

            {/* Export Summary */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Items to export</span>
                <Badge variant="secondary">{selectedItems.length || 'All'}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated size</span>
                <span className="font-medium">{formatBytes(estimateSize())}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Format</span>
                <div className="flex items-center gap-1">
                  <FormatIcon className="h-3 w-3" />
                  <span className="font-medium">{FORMAT_LABELS[format]}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || (!includeTranscripts && !includeDocuments && !includeMetadata)}
            >
              <Download className="h-4 w-4 mr-2" />
              Start Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Progress Dialog */}
      {showProgress && (
        <ExportProgressDialog
          isOpen={showProgress}
          onClose={() => {
            setShowProgress(false);
            handleClose();
          }}
          exportResult={exportResult}
          itemCount={selectedItems.length}
          format={format}
        />
      )}
    </>
  );
}