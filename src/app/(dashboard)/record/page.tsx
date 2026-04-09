import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';

import RecorderApp from '@/app/components/RecorderApp';

export const metadata = {
  title: 'New Recording - Tribora',
  description: 'Capture your expertise with a new screen recording',
};

export default async function RecordPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  return <RecorderApp />;
}
