import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  OrgStorageOverview,
  TopFilesTable,
  OrgIssues,
  AdminActionsPanel,
} from '@/app/components/admin';

export const metadata: Metadata = {
  title: 'Organization Storage | Admin',
  description: 'Deep dive into organization storage usage and optimization',
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrganizationStoragePage({ params }: PageProps) {
  const { id } = await params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Organization Storage Deep Dive</h1>
        <p className="text-muted-foreground">
          Detailed storage analysis and management for this organization
        </p>
      </div>

      {/* Storage Overview */}
      <OrgStorageOverview organizationId={id} />

      {/* Issues and Actions Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization-Specific Issues */}
        <OrgIssues organizationId={id} />

        {/* Admin Actions Panel */}
        <AdminActionsPanel organizationId={id} />
      </div>

      {/* Top Files Table */}
      <TopFilesTable organizationId={id} />
    </div>
  );
}
