'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Archive,
  Trash2,
  FileDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
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

interface AdminActionsPanelProps {
  organizationId: string;
}

type ActionType = 'compress' | 'migrate' | 'cleanup' | 'report' | null;

type LoadingState = {
  compress: boolean;
  migrate: boolean;
  cleanup: boolean;
  report: boolean;
};

export default function AdminActionsPanel({ organizationId }: AdminActionsPanelProps) {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({
    compress: false,
    migrate: false,
    cleanup: false,
    report: false,
  });
  const [confirmAction, setConfirmAction] = useState<ActionType>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const handleAction = async (action: ActionType) => {
    if (!action) return;

    // Abort any previous request and clear timeout
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    // Update the specific action's loading state
    setLoadingStates((prev) => ({ ...prev, [action]: true }));
    setResult(null);

    // Create abort controller with timeout
    abortControllerRef.current = new AbortController();
    const controller = abortControllerRef.current;

    // Set timeout to abort after 10 seconds
    timeoutIdRef.current = setTimeout(() => {
      controller.abort();
    }, 10000);

    // Capture refs locally to avoid clearing a newer request in finally
    const localTimeoutId = timeoutIdRef.current;
    const localController = abortControllerRef.current;

    try {
      const response = await fetch(`/api/analytics/organizations/${organizationId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to execute action');
      }

      const { data } = await response.json();

      setResult({
        type: 'success',
        message: data.message || 'Action completed successfully',
      });
    } catch (err) {
      console.error('Error executing action:', err);

      // Handle abort specifically
      if (err instanceof Error && err.name === 'AbortError') {
        setResult({
          type: 'error',
          message: 'Request timed out. Please try again.',
        });
      } else {
        setResult({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to execute action',
        });
      }
    } finally {
      // Clear timeout and abort controller only if they match the local captures
      if (timeoutIdRef.current === localTimeoutId) {
        clearTimeout(localTimeoutId);
        timeoutIdRef.current = null;
      }
      if (abortControllerRef.current === localController) {
        abortControllerRef.current = null;
      }

      // Reset loading state for this action
      setLoadingStates((prev) => ({ ...prev, [action]: false }));
      setConfirmAction(null);
    }
  };

  const getActionConfig = (action: ActionType) => {
    switch (action) {
      case 'compress':
        return {
          title: 'Force Compression',
          description:
            'This will queue all uncompressed files for compression. This may take some time to complete.',
          confirmText: 'Start Compression',
        };
      case 'migrate':
        return {
          title: 'Migrate to Cold Storage',
          description:
            'Files older than 90 days will be migrated to cold storage tier. This will reduce costs but increase access latency.',
          confirmText: 'Start Migration',
        };
      case 'cleanup':
        return {
          title: 'Clean Up Old Files',
          description:
            'This will identify and mark files for deletion based on retention policies. Files marked for deletion can be reviewed before permanent removal.',
          confirmText: 'Start Cleanup',
        };
      case 'report':
        return {
          title: 'Generate Storage Report',
          description:
            'A comprehensive storage report will be generated and emailed to you. This includes usage trends, cost analysis, and optimization recommendations.',
          confirmText: 'Generate Report',
        };
      default:
        return null;
    }
  };

  const actionConfig = confirmAction ? getActionConfig(confirmAction) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Admin Actions
          </CardTitle>
          <CardDescription>
            Administrative tools for managing organization storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Result Message */}
          {result && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                result.type === 'success'
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}
            >
              {result.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <p>{result.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Force Compression */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">Force Compression</p>
                <p className="text-xs text-muted-foreground">
                  Queue all uncompressed files for compression
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction('compress')}
                disabled={loadingStates.compress}
              >
                {loadingStates.compress ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span className="ml-2">Compress</span>
              </Button>
            </div>

            {/* Migrate to Cold Storage */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">Migrate to Cold Storage</p>
                <p className="text-xs text-muted-foreground">
                  Move old files to cheaper storage tier
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction('migrate')}
                disabled={loadingStates.migrate}
              >
                {loadingStates.migrate ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                <span className="ml-2">Migrate</span>
              </Button>
            </div>

            {/* Clean Up Old Files */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">Clean Up Old Files</p>
                <p className="text-xs text-muted-foreground">
                  Identify files for deletion per retention policy
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction('cleanup')}
                disabled={loadingStates.cleanup}
              >
                {loadingStates.cleanup ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="ml-2">Clean Up</span>
              </Button>
            </div>

            {/* Generate Report */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">Generate Storage Report</p>
                <p className="text-xs text-muted-foreground">
                  Comprehensive analysis and recommendations
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction('report')}
                disabled={loadingStates.report}
              >
                {loadingStates.report ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                <span className="ml-2">Generate</span>
              </Button>
            </div>
          </div>

          {/* Warning Note */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              All actions will be queued as background jobs. You will be notified when they complete.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {actionConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmAction ? loadingStates[confirmAction] : false}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction(confirmAction)}
              disabled={confirmAction ? loadingStates[confirmAction] : false}
            >
              {confirmAction && loadingStates[confirmAction] ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                actionConfig?.confirmText
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
