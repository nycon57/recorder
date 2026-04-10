import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { DigestContent } from './digest-content';

export const metadata = {
  title: 'Weekly Digest - Tribora',
  description: 'Your weekly knowledge base health report',
};

export default async function DigestPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <DigestContent />
    </div>
  );
}
