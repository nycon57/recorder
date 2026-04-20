'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { NewIngestForm } from '@/app/components/admin/vendor-sources/new-ingest-form';

/**
 * Client shell for the /new page — separates the async server component
 * (auth guard + dynamic export) from the client-side form.
 *
 * TRIB-149
 */
export function NewIngestFormPage() {
  const router = useRouter();

  function handleSuccess() {
    router.push('/admin/vendor-sources');
  }

  return (
    <div className="trbd-page">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/vendor-sources" className="hover:text-foreground transition-colors">
          Vendor Sources
        </Link>
        <span>/</span>
        <span className="text-foreground">New source</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="trbd-page-title flex items-center gap-2">
            <BookOpen className="h-7 w-7" />
            Add vendor source
          </h1>
          <p className="text-muted-foreground">
            Queue a new vendor documentation ingest. The crawler starts within seconds.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" asChild>
          <Link href="/admin/vendor-sources">
            <ArrowLeft className="h-4 w-4" />
            Back to sources
          </Link>
        </Button>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Ingest configuration</CardTitle>
          <CardDescription>
            Specify the vendor app and root URL. The worker will crawl the site and
            upsert structured pages into the canonical vendor corpus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewIngestForm onSuccess={() => handleSuccess()} />
        </CardContent>
      </Card>
    </div>
  );
}
