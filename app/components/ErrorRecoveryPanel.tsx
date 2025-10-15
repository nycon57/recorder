'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Wifi,
  Server,
  Database,
  CreditCard,
  RefreshCw,
  LifeBuoy,
  ChevronRight,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { Button } from '@/app/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { Separator } from '@/app/components/ui/separator';

export interface ProcessingError {
  type: 'api' | 'network' | 'data' | 'quota' | 'unknown';
  message: string;
  code?: string;
  details?: string;
  timestamp?: string;
}

interface ErrorRecoveryPanelProps {
  error: ProcessingError;
  onRetry?: () => void;
  onRetryFromPoint?: () => void;
  onRestartAll?: () => void;
  onCancel?: () => void;
  className?: string;
}

export default function ErrorRecoveryPanel({
  error,
  onRetry,
  onRetryFromPoint,
  onRestartAll,
  onCancel,
  className,
}: ErrorRecoveryPanelProps) {
  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return <Wifi className="size-6" aria-hidden="true" />;
      case 'api':
        return <Server className="size-6" aria-hidden="true" />;
      case 'data':
        return <Database className="size-6" aria-hidden="true" />;
      case 'quota':
        return <CreditCard className="size-6" aria-hidden="true" />;
      default:
        return <AlertCircle className="size-6" aria-hidden="true" />;
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'network':
        return 'Network Connection Error';
      case 'api':
        return 'API Processing Error';
      case 'data':
        return 'Data Validation Error';
      case 'quota':
        return 'Usage Quota Exceeded';
      default:
        return 'Processing Error';
    }
  };

  const getSuggestedActions = () => {
    switch (error.type) {
      case 'network':
        return [
          'Check your internet connection',
          'Verify firewall or VPN settings',
          'Try refreshing the page',
          'Wait a moment and retry',
        ];
      case 'api':
        return [
          'The service may be temporarily unavailable',
          'Check the status page for ongoing incidents',
          'Retry the operation in a few moments',
          'Contact support if the issue persists',
        ];
      case 'data':
        return [
          'Verify the recording file is not corrupted',
          'Ensure the file format is supported',
          'Check that the recording has audio content',
          'Try reprocessing from the beginning',
        ];
      case 'quota':
        return [
          'You have reached your plan limits',
          'Upgrade your plan for more processing time',
          'Wait until your quota resets',
          'Contact support for quota adjustments',
        ];
      default:
        return [
          'Try retrying the operation',
          'Refresh the page and try again',
          'Check the browser console for details',
          'Contact support if the problem continues',
        ];
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Error Alert */}
      <Alert variant="destructive" className="border-2">
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, times: [0, 0.5, 1] }}
            className="flex-shrink-0 text-destructive"
          >
            {getErrorIcon()}
          </motion.div>
          <div className="flex-1 space-y-2">
            <AlertTitle className="text-base font-semibold">{getErrorTitle()}</AlertTitle>
            <AlertDescription className="text-sm">{error.message}</AlertDescription>

            {/* Error Details */}
            {(error.code || error.details || error.timestamp) && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {error.code && (
                  <p>
                    <span className="font-semibold">Error Code:</span> {error.code}
                  </p>
                )}
                {error.details && (
                  <p>
                    <span className="font-semibold">Details:</span> {error.details}
                  </p>
                )}
                {error.timestamp && (
                  <p>
                    <span className="font-semibold">Time:</span> {formatTimestamp(error.timestamp)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Alert>

      {/* Suggested Actions */}
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <LifeBuoy className="size-4" aria-hidden="true" />
          Suggested Actions
        </h3>
        <ul className="space-y-2.5">
          {getSuggestedActions().map((action, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <ChevronRight className="size-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-500" aria-hidden="true" />
              <span>{action}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      <Separator />

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Primary Actions */}
        <div className="flex flex-1 gap-3">
          {onRetry && (
            <Button onClick={onRetry} className="flex-1 sm:flex-none" aria-label="Retry operation">
              <RefreshCw className="size-4 mr-2" aria-hidden="true" />
              Retry
            </Button>
          )}
          {onRetryFromPoint && (
            <Button
              onClick={onRetryFromPoint}
              variant="outline"
              className="flex-1 sm:flex-none"
              aria-label="Retry from failure point"
            >
              Retry from Failure Point
            </Button>
          )}
          {onRestartAll && (
            <Button
              onClick={onRestartAll}
              variant="outline"
              className="flex-1 sm:flex-none"
              aria-label="Restart all steps"
            >
              Restart All Steps
            </Button>
          )}
        </div>

        {/* Secondary Actions */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="flex-1 sm:flex-none"
            aria-label="Contact support"
          >
            <a href="mailto:support@example.com" target="_blank" rel="noopener noreferrer">
              <LifeBuoy className="size-4 mr-2" aria-hidden="true" />
              Contact Support
            </a>
          </Button>
          {onCancel && (
            <Button
              onClick={onCancel}
              variant="ghost"
              size="sm"
              className="flex-1 sm:flex-none"
              aria-label="Cancel and close"
            >
              <XCircle className="size-4 mr-2" aria-hidden="true" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Additional Help */}
      {error.type === 'quota' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4"
        >
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Need more processing time?</strong> Upgrade your plan to increase your monthly quota and
            unlock additional features.
          </p>
          <Button size="sm" className="mt-3" aria-label="View plans">
            View Plans
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
