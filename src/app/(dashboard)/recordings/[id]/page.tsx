import { redirect } from 'next/navigation';

/**
 * Recording Detail Redirect Page
 * Maintains backwards compatibility by redirecting /recordings/[id] to /library/[id]
 */
export default async function RecordingDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/library/${id}`);
}
