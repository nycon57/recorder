/**
 * Public Share Page
 *
 * View shared recordings and conversations without authentication.
 */

import { notFound, redirect } from 'next/navigation';
import { validateShareAccess, incrementShareView, getShare } from '@/lib/services/sharing';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import SharePasswordForm from './SharePasswordForm';
import SharedRecording from './SharedRecording';
import SharedConversation from './SharedConversation';

interface SharePageProps {
  params: Promise<{ shareId: string }>;
  searchParams: Promise<{ password?: string }>;
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { shareId } = await params;
  const { password } = await searchParams;

  // Validate share access
  const validation = await validateShareAccess(shareId, password);

  if (!validation.valid) {
    if (validation.reason === 'not_found') {
      notFound();
    }

    if (validation.reason === 'expired') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Link Expired</h1>
            <p className="text-muted-foreground">
              This share link has expired and is no longer accessible.
            </p>
          </div>
        </div>
      );
    }

    if (validation.reason === 'max_views') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">View Limit Reached</h1>
            <p className="text-muted-foreground">
              This share link has reached its maximum number of views and is no longer accessible.
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
