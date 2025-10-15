'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  FileArchive,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBytes } from '@/lib/utils';
import type { ExportResult } from '@/lib/types/phase8';

interface ExportProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  exportResult: ExportResult | null;
  itemCount: number;
  format: string;
}

export function ExportProgressDialog({
  isOpen,
  onClose,
  exportResult,
  itemCount,
  format,
}: ExportProgressDialogProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'preparing' | 'processing' | 'complete' | 'error'>('preparing');

  useEffect(() => {
    if (!exportResult) {
      // Simulate progress while waiting for export
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);

      return () => clearInterval(interval);
    } else {
      // Export complete
      setProgress(100);
      setStatus('complete');
    }
  }, [exportResult]);

  useEffect(() => {
    if (progress > 30 && status === 'preparing') {
      setStatus('processing');
    }
  }, [progress, status]);

  const handleDownload = () => {
    if (exportResult?.download_url) {
      window.open(exportResult.download_url, '_blank');
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'preparing':
        return 'Preparing your export...';
      case 'processing':
        return `Processing ${itemCount} items...`;
      case 'complete':
        return 'Export ready!';
      case 'error':
        return 'Export failed';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-12 w-12 text-green-500" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-destructive" />;
      default:
        return <FileArchive className="h-12 w-12 text-primary animate-pulse" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={status === 'complete' || status === 'error' ? onClose : undefined}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Progress</DialogTitle>
          <DialogDescription>
            {getStatusMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Icon Animation */}
          <div className="flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={status}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {getStatusIcon()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress Bar */}
          {status !== 'error' && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{Math.round(progress)}%</span>
                {status === 'processing' && (
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export Details */}
          {exportResult && status === 'complete' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Your export is ready to download
                </AlertDescription>
              </Alert>

              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">File size</span>
                  <span className="font-medium">
                    {formatBytes(exportResult.file_size_bytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium uppercase">{format}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expires</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">
                      {new Date(exportResult.expires_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          {status === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                An error occurred while creating your export. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Messages */}
          {status === 'processing' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Gathering selected items</span>
              </div>
              {progress > 40 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Extracting transcripts and documents</span>
                </motion.div>
              )}
              {progress > 70 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Creating {format.toUpperCase()} archive...</span>
                </motion.div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {status === 'complete' && exportResult ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download Export
              </Button>
            </>
          ) : status === 'error' ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}