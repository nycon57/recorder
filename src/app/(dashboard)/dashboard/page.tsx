import { Suspense } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';

import {
  AgentStatusWidget,
  DashboardContent,
  KnowledgeHealthWidget,
} from '@/app/components/dashboard';

export const metadata = {
  title: 'Dashboard - Tribora',
  description: 'Your knowledge intelligence hub',
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <DashboardContent />
      <Suspense fallback={null}>
        <KnowledgeHealthWidget />
      </Suspense>
      <Suspense fallback={null}>
        <AgentStatusWidget />
      </Suspense>
    </div>
  );
}
