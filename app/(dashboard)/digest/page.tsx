import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { DigestContent } from './digest-content';

export const metadata = {
  title: 'Weekly Digest - Tribora',
  description: 'Your weekly knowledge base health report',
};

export default async function DigestPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/');
  }

  if (!orgId) {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <DigestContent />
    </div>
  );
}
