'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, XOctagon } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription } from '@/app/components/ui/alert';
import type { UsageAlert } from '@/lib/services/usage-alerts';

interface UsageAlertResponse {
  data: UsageAlert | null;
}

/**
 * Fetches the current usage alert and renders a dismissible banner.
 * Returns null (no DOM output) when usage is below the warning threshold.
 */
export function UsageAlertBanner() {
  const { data } = useQuery<UsageAlertResponse>({
    queryKey: ['organization-usage-alert'],
    queryFn: async () => {
      const res = await fetch('/api/organizations/usage-alert');
      if (!res.ok) throw new Error('Failed to load usage alert');
      return res.json();
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
    retry: false,
  });

  const alert = data?.data;
  if (!alert) return null;

  const isHardStop = alert.level === 'hard_stop';
  const isCritical = alert.level === 'critical';

  return (
    <Alert
      variant={isHardStop || isCritical ? 'destructive' : 'warning'}
      className="mb-6"
    >
      {isHardStop ? (
        <XOctagon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      )}
      <AlertDescription className="flex flex-wrap items-center gap-x-1">
        {alert.message}{' '}
        <Link
          href="/settings/organization/usage"
          className="font-medium underline underline-offset-2"
        >
          View usage
        </Link>{' '}
        or{' '}
        <Link
          href="/settings/billing"
          className="font-medium underline underline-offset-2"
        >
          upgrade your plan
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
