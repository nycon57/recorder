import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import RecorderApp from '@/app/components/RecorderApp';

export const metadata = {
  title: 'New Recording - Record',
  description: 'Create a new screen and camera recording',
};

export default async function RecordPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/');
  }

  if (!orgId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-normal text-foreground mb-4">
          No Organization Selected
        </h2>
        <p className="text-muted-foreground mb-6">
          Please create or select an organization to start recording.
        </p>
      </div>
    );
  }

  return <RecorderApp />;
}
