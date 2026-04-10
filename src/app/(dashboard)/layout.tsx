import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/app/components/ui/sidebar';
import { Separator } from '@/app/components/ui/separator';
import { AuroraSidebar } from '@/app/components/layout/aurora-sidebar';
import { Breadcrumbs } from '@/app/components/layout/breadcrumbs';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPendingReviewCount } from '@/lib/services/wiki-review';

// Force dynamic rendering for all dashboard pages (auth required)
export const dynamic = 'force-dynamic';

/**
 * Dashboard Layout
 * Protected layout with sidebar navigation
 * Requires authentication and organization context
 *
 * Features:
 * - Collapsible sidebar (Cmd/Ctrl + B)
 * - Role-based navigation
 * - Breadcrumb navigation
 * - Responsive design
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  const userId = session.user.id;

  // Fetch user role and system admin status for conditional navigation
  // Using admin client to bypass RLS (safe in server component)
  let userRole: 'owner' | 'admin' | 'contributor' | 'reader' = 'reader';
  let isSystemAdmin = false;
  let hasOnboardingPlan = false;
  let hasDigestEnabled = false;
  let wikiReviewCount = 0;

  try {
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, org_id, role, is_system_admin')
      .eq('id', userId)
      .single();

    if (userData?.role) {
      userRole = userData.role as typeof userRole;
    }

    // System admin flag for platform-level admin access
    if (userData?.is_system_admin === true) {
      isSystemAdmin = true;
    }

    // Run independent sidebar queries in parallel
    if (userData?.org_id) {
      const [planResult, settingsResult, pendingReviewCount] = await Promise.all([
        userData.id
          ? supabaseAdmin
              .from('agent_onboarding_plans')
              .select('id')
              .eq('org_id', userData.org_id)
              .eq('user_id', userData.id)
              .eq('plan_status', 'active')
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from('org_agent_settings')
          .select('digest_enabled, global_agent_enabled')
          .eq('org_id', userData.org_id)
          .maybeSingle(),
        // TRIB-34: cached (60s) count of pending flagged contradictions for
        // the admin nav badge. Swallowed on failure — sidebar should never
        // block on this.
        getPendingReviewCount(userData.org_id).catch(() => 0),
      ]);

      hasOnboardingPlan = !!planResult.data;
      hasDigestEnabled =
        settingsResult.data?.digest_enabled === true &&
        settingsResult.data?.global_agent_enabled !== false;
      wikiReviewCount = pendingReviewCount;
    }
  } catch (error) {
    console.error('[DashboardLayout] Error fetching user data:', error);
    // Continue with defaults if fetch fails
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AuroraSidebar role={userRole} isSystemAdmin={isSystemAdmin} hasOnboardingPlan={hasOnboardingPlan} hasDigestEnabled={hasDigestEnabled} wikiReviewCount={wikiReviewCount} />
      <SidebarInset>
        {/* Header with sidebar trigger and breadcrumbs */}
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-accent/10 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <SidebarTrigger className="-ml-1 hover:bg-accent/10 hover:text-accent transition-colors" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-accent/20" />
          <Breadcrumbs />
        </header>

        {/* Main content area */}
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
