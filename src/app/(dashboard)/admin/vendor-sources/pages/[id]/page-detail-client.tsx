'use client';

import { Loader2, ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { useFetchWithAbort } from '@/app/hooks/useFetchWithAbort';
import { PageDetail } from '@/app/components/admin/vendor-sources/page-detail';

interface Props {
  pageId: string;
}

/**
 * Client shell that fetches vendor page detail and delegates to PageDetail.
 * Separated so the server page can handle auth + dynamic rendering cleanly.
 *
 * TRIB-149
 */
export function PageDetailClient({ pageId }: Props) {
  const { data, loading, error } = useFetchWithAbort<{
    data: {
      page: {
        id: string;
        app: string;
        screen: string;
        source_url: string | null;
        content_hash: string | null;
        created_at: string;
        updated_at: string;
        vendor_source_id: string | null;
        curated_by: string | null;
        ingest_job_id: string | null;
      };
      parentSource: {
        app: string;
        source_url: string;
        publisher_hostname: string;
        status: string;
      } | null;
      curatedByEmail: string | null;
    };
  }>(`/api/admin/vendor-sources/pages/${pageId}`);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading page detail…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.data?.page) {
    const message = error?.message.includes('404')
      ? 'This vendor page does not exist or has been deleted.'
      : error?.message.includes('403')
        ? 'Access denied. System admin privileges required.'
        : error?.message ?? 'Failed to load page detail.';

    return (
      <div className="trbd-page">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <PageDetail
      page={data.data.page}
      parentSource={data.data.parentSource}
      curatedByEmail={data.data.curatedByEmail ?? null}
    />
  );
}
