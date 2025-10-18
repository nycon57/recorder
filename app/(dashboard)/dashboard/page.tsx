import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { DashboardContent } from '@/app/components/dashboard';

export const metadata = {
  title: 'Dashboard - Record',
  description: 'Your knowledge management hub',
};

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

  return (
    <div className="container mx-auto py-8 px-4">
      <DashboardContent />
    </div>
  );
}
