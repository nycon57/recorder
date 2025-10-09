import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import RecordingCard from '@/app/components/RecordingCard';

export const metadata = {
  title: 'Dashboard - Record',
  description: 'View and manage your recordings',
};

async function getRecordings(orgId: string) {
  try {
    const supabase = await createClient();

    const { data: recordings, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching recordings:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      // Return empty array - dashboard will show "no recordings" state
      return [];
    }

    return recordings || [];
  } catch (err) {
    console.error('Unexpected error fetching recordings:', err);
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

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Recordings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage and view your recorded content
          </p>
        </div>
        <Link
          href="/record"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition inline-flex items-center space-x-2"
        >
          <span className="text-xl">🎥</span>
          <span>New Recording</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Total Recordings
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {recordings.length}
              </p>
            </div>
            <div className="text-3xl">📹</div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Transcribed
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {
                  recordings.filter((r) =>
                    ['transcribed', 'completed'].includes(r.status)
                  ).length
                }
              </p>
            </div>
            <div className="text-3xl">📝</div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Processing
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {
                  recordings.filter((r) =>
                    ['uploading', 'uploaded', 'transcribing'].includes(r.status)
                  ).length
                }
              </p>
            </div>
            <div className="text-3xl">⚙️</div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Documents
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {recordings.filter((r) => r.status === 'completed').length}
              </p>
            </div>
            <div className="text-3xl">📄</div>
          </div>
        </div>
      </div>

      {/* Recordings List */}
      {recordings.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <div className="text-6xl mb-4">🎬</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No recordings yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first recording
          </p>
          <Link
            href="/record"
            className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition space-x-2"
          >
            <span className="text-xl">🎥</span>
            <span>Create Recording</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recordings.map((recording) => (
            <RecordingCard key={recording.id} recording={recording} />
          ))}
        </div>
      )}
    </div>
  );
}
