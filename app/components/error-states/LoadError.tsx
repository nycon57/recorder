'use client';

import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';

/**
 * LoadError Component
 *
 * Generic error state for content loading failures
 * Used when API requests fail or data cannot be fetched
 */
interface LoadErrorProps {
  title?: string;
  message?: string;
  errorCode?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  onRetry?: () => void;
  onGoHome?: () => void;
  onGoBack?: () => void;
}

export function LoadError({
  title = 'Failed to Load Content',
  message = 'We encountered an error while loading this content. Please try again.',
  errorCode,
  showHomeButton = true,
  showBackButton = false,
  onRetry,
  onGoHome,
  onGoBack,
}: LoadErrorProps) {
  return (
    <Card className="border-dashed border-2 border-destructive/50">
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Error icon */}
        <div className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-6 mb-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>

        {/* Error message */}
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {message}
        </p>

        {/* Error code */}
        {errorCode && (
          <div className="text-xs font-mono text-muted-foreground bg-muted px-3 py-1.5 rounded mb-6">
            Error: {errorCode}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-center">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          {showBackButton && onGoBack && (
            <Button onClick={onGoBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          )}
          {showHomeButton && onGoHome && (
            <Button onClick={onGoHome} variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          )}
        </div>

        {/* Help text */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg max-w-md">
          <p className="text-xs text-muted-foreground">
            If this issue persists, please contact support with the error code above.
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * NetworkError Component
 *
 * Specific error for network/connection issues
 */
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <LoadError
      title="Connection Error"
      message="We couldn't connect to the server. Please check your internet connection and try again."
      errorCode="NETWORK_ERROR"
      showHomeButton={false}
      showBackButton={false}
      onRetry={onRetry}
    />
  );
}

/**
 * NotFoundError Component
 *
 * Error for 404/content not found
 */
export function NotFoundError({ resourceType = 'Content', onGoHome }: { resourceType?: string; onGoHome?: () => void }) {
  return (
    <Card className="border-dashed border-2">
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="text-8xl font-bold text-muted-foreground/20 mb-4">
          404
        </div>
        <h3 className="text-2xl font-semibold mb-2">{resourceType} Not Found</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          The {resourceType.toLowerCase()} you're looking for doesn't exist or has been deleted.
        </p>
        {onGoHome && (
          <Button onClick={onGoHome} variant="default">
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
        )}
      </div>
    </Card>
  );
}
