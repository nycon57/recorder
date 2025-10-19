import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/app/components/ui/sidebar';
import { Separator } from '@/app/components/ui/separator';
import { AppSidebar } from '@/app/components/layout/app-sidebar';
import { Breadcrumbs } from '@/app/components/layout/breadcrumbs';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  // Fetch user role and system admin status for conditional navigation
  // Using admin client to bypass RLS (safe in server component)
  let userRole: 'owner' | 'admin' | 'contributor' | 'reader' = 'reader';
  let isSystemAdmin = false;

  try {
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role, is_system_admin')
      .eq('clerk_id', userId)
      .single();

    if (userData?.role) {
      userRole = userData.role as typeof userRole;
    }

    // System admin flag for platform-level admin access
    if (userData?.is_system_admin === true) {
      isSystemAdmin = true;
    }
  } catch (error) {
    console.error('[DashboardLayout] Error fetching user data:', error);
    // Continue with defaults if fetch fails
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar role={userRole} isSystemAdmin={isSystemAdmin} />
      <SidebarInset>
        {/* Header with sidebar trigger and breadcrumbs */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
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
