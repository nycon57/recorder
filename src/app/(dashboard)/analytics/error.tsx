'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Analytics page error:', error);
  }, [error]);

  return (
    <div className="trbd-page flex items-center justify-center min-h-[600px]">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="trbd-icon-chip">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <CardTitle>Something went wrong</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We encountered an error while loading your analytics. This could be
            a temporary issue.
          </p>

          {error.message && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-xs font-mono text-muted-foreground">
                {error.message}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => reset()}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
