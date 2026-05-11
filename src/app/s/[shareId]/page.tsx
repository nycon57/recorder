/**
 * Public Share Page
 *
 * View shared recordings and conversations without authentication.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import {
  validateShareAccess,
  incrementShareView,
  getShare,
} from '@/lib/services/sharing';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

import SharePasswordForm from './SharePasswordForm';
import SharedRecording from './SharedRecording';
import SharedConversation from './SharedConversation';

interface SharePageProps {
  params: Promise<{ shareId: string }>;
  searchParams: Promise<{ password?: string }>;
}

export const metadata: Metadata = {
  title: 'Shared Content | Tribora',
  description: 'View a recording or conversation securely shared from Tribora.',
};

export default async function SharePage({
  params,
  searchParams,
}: SharePageProps) {
  const { shareId, validation } = await Promise.all([
    params,
    searchParams,
  ]).then(([{ shareId }, { password }]) =>
    validateShareAccess(shareId, password).then((validation) => ({
      shareId,
      validation,
    })),
  );

  if (!validation.valid) {
    if (validation.reason === 'not_found') {
      notFound();
    }

    if (validation.reason === 'expired') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-2xl font-semibold text-foreground mb-4">
              Link Expired
            </h1>
            <p className="text-muted-foreground">
              This share link has expired and is no longer accessible.
            </p>
          </div>
        </div>
      );
    }

    if (validation.reason === 'invalid_password') {
      return <SharePasswordForm shareId={shareId} />;
    }
  }

  const share = validation.share!;

  // Increment view count
  await incrementShareView(shareId);

  // Render based on resource type
  if (share.resourceType === 'recording') {
    return <SharedRecording share={share} />;
  } else {
    return <SharedConversation share={share} />;
  }
}
