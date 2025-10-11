import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { supabaseAdmin } from '@/lib/supabase/admin';
import DashboardClient from '@/app/components/DashboardClient';

export const metadata = {
  title: 'Dashboard - Record',
  description: 'View and manage your recordings',
};

async function getRecordings(clerkOrgId: string) {
  try {
    // Use admin client to bypass RLS (Clerk auth is already validated in parent component)
    const supabase = supabaseAdmin;

    console.log('[Dashboard] Fetching recordings for Clerk org:', clerkOrgId);

    // First, look up the internal organization ID using Clerk org ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', clerkOrgId)
      .single();

    if (orgError || !org) {
      console.error('[Dashboard] Error fetching organization:', {
        message: orgError?.message || 'Organization not found',
        clerkOrgId,
        error: orgError,
      });
      // Return empty array - organization doesn't exist yet or lookup failed
      return [];
    }

    console.log('[Dashboard] Found organization:', { orgId: org.id, clerkOrgId });

    // Now fetch recordings using the internal org UUID
    const { data: recordings, error } = await supabase
      .from('recordings')
      .select(`
        *,
        recording_tags (
          tag_id,
          tags (
            id,
            name,
            color
          )
        )
      `)
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Dashboard] Error fetching recordings:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        orgId: org.id,
      });
      // Return empty array - dashboard will show "no recordings" state
      return [];
    }

    // Map recordings to include tags
    const recordingsWithTags = (recordings || []).map(recording => ({
      ...recording,
      tags: recording.recording_tags?.map((rt: any) => rt.tags).filter(Boolean) || []
    }));

    console.log('[Dashboard] Successfully fetched recordings:', {
      count: recordingsWithTags?.length || 0,
      recordings: recordingsWithTags?.map(r => ({ id: r.id, title: r.title, status: r.status })),
    });

    return recordingsWithTags;
  } catch (err) {
    console.error('[Dashboard] Unexpected error fetching recordings:', err);
    return [];
  }
}

export default async function DashboardPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/');
  }

  if (!orgId) {
    return (
      <div className="text-center py-12">
        <div className="max-w-2xl mx-auto bg-secondary/10 border border-secondary rounded-lg p-8">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Organizations Not Enabled
          </h2>
          <div className="text-left space-y-4 text-muted-foreground">
            <p>
              This application requires Clerk Organizations to be enabled. To enable:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Go to <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">dashboard.clerk.com</a></li>
              <li>Select your application</li>
              <li>Navigate to <strong>Organizations</strong> in the sidebar</li>
              <li>Click <strong>Enable Organizations</strong></li>
              <li>Set <code className="bg-muted px-2 py-1 rounded">NEXT_PUBLIC_CLERK_ORGANIZATIONS_ENABLED=true</code> in .env.local</li>
              <li>Restart the dev server</li>
            </ol>
            <p className="mt-4 text-sm text-muted-foreground/80">
              <strong>Note:</strong> Organizations are required for multi-tenant functionality, team collaboration, and proper data isolation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const recordings = await getRecordings(orgId);

  return <DashboardClient recordings={recordings} />;
}
