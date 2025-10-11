import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import RecordingDetailClient from '@/app/components/RecordingDetailClient';

async function getRecording(id: string, clerkOrgId: string) {
  const supabase = supabaseAdmin;

  // First, look up the internal organization ID using Clerk org ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .single();

  if (!org) {
    return null;
  }

  const { data: recording, error } = await supabase
    .from('recordings')
    .select(
      `
      *,
      transcripts (*),
      documents (*)
    `
    )
    .eq('id', id)
    .eq('org_id', org.id)
    .single();

  if (error || !recording) {
    return null;
  }

  // Generate signed video URLs if available
  // Prefer processed (MP4) for playback, fallback to raw (WEBM)
  let videoUrl = null;
  let downloadUrl = null;

  // Use processed version if available (MP4)
  if (recording.storage_path_processed) {
    const { data: urlData } = await supabase.storage
      .from('recordings')
      .createSignedUrl(recording.storage_path_processed, 3600); // 1 hour expiry

    videoUrl = urlData?.signedUrl || null;
    downloadUrl = videoUrl; // Prefer MP4 for download
  }

  // Fallback to raw version (WEBM)
  if (!videoUrl && recording.storage_path_raw) {
    const { data: urlData } = await supabase.storage
      .from('recordings')
      .createSignedUrl(recording.storage_path_raw, 3600); // 1 hour expiry

    videoUrl = urlData?.signedUrl || null;
    downloadUrl = videoUrl;
  }

  return {
    ...recording,
    videoUrl,
    downloadUrl,
  };
}

export default async function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/');
  }

  const { id } = await params;
  const recording = await getRecording(id, orgId);

  if (!recording) {
    notFound();
  }

  const transcript = Array.isArray(recording.transcripts)
    ? recording.transcripts[0]
    : null;
  const document = Array.isArray(recording.documents)
    ? recording.documents[0]
    : null;

  // Fetch tags for this recording
  const { data: recordingTags } = await supabaseAdmin
    .from('recording_tags')
    .select(`
      tag_id,
      tags (
        id,
        name,
        color,
        created_at,
        updated_at
      )
    `)
    .eq('recording_id', id);

  const tags = recordingTags
    ?.map((rt: any) => rt.tags)
    .filter(Boolean) || [];

  return (
    <RecordingDetailClient
      recording={recording}
      transcript={transcript}
      document={document}
      initialTags={tags}
    />
  );
}
