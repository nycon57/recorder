import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';

import { supabaseAdmin } from '@/lib/supabase/admin';
import VideoDetailView from './components/VideoDetailView';
import AudioDetailView from './components/AudioDetailView';
import DocumentDetailView from './components/DocumentDetailView';
import TextNoteDetailView from './components/TextNoteDetailView';

async function getContentItem(id: string, clerkOrgId: string) {
  const supabase = supabaseAdmin;

  // Look up internal organization ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .single();

  if (!org) {
    return null;
  }

  // Fetch content item (from recordings table - unified content storage)
  const { data: item, error } = await supabase
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

  if (error || !item) {
    return null;
  }

  // Generate signed URLs based on content type
  let videoUrl = null;
  let downloadUrl = null;

  // For recordings and videos - generate video URLs
  if (item.content_type === 'recording' || item.content_type === 'video') {
    // Prefer processed (MP4) over raw (WEBM)
    if (item.storage_path_processed) {
      const { data: urlData } = await supabase.storage
        .from('recordings')
        .createSignedUrl(item.storage_path_processed, 3600);

      videoUrl = urlData?.signedUrl || null;
      downloadUrl = videoUrl;
    }

    // Fallback to raw version
    if (!videoUrl && item.storage_path_raw) {
      const { data: urlData } = await supabase.storage
        .from('recordings')
        .createSignedUrl(item.storage_path_raw, 3600);

      videoUrl = urlData?.signedUrl || null;
      downloadUrl = videoUrl;
    }
  }

  // For audio files
  if (item.content_type === 'audio' && item.storage_path_raw) {
    const { data: urlData } = await supabase.storage
      .from('recordings')
      .createSignedUrl(item.storage_path_raw, 3600);

    videoUrl = urlData?.signedUrl || null; // Reuse videoUrl for audio playback
    downloadUrl = videoUrl;
  }

  // For documents
  if (item.content_type === 'document' && item.storage_path_raw) {
    const { data: urlData } = await supabase.storage
      .from('recordings')
      .createSignedUrl(item.storage_path_raw, 3600);

    downloadUrl = urlData?.signedUrl || null;
  }

  return {
    ...item,
    videoUrl,
    downloadUrl,
  };
}

/**
 * Library Item Detail Page
 * Displays detailed view of content item with type-specific renderers
 * Routes to appropriate component based on content_type:
 * - recording/video -> VideoDetailView
 * - audio -> AudioDetailView
 * - document -> DocumentDetailView
 * - text -> TextNoteDetailView
 */
export default async function LibraryItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/');
  }

  const { id } = await params;
  const item = await getContentItem(id, orgId);

  if (!item) {
    notFound();
  }

  // Handle both object and array responses from Supabase
  const transcript = Array.isArray(item.transcripts)
    ? item.transcripts[0]
    : item.transcripts || null;
  const document = Array.isArray(item.documents)
    ? item.documents[0]
    : item.documents || null;

  // Fetch tags
  const { data: itemTags } = await supabaseAdmin
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

  const tags = itemTags
    ?.map((rt: any) => rt.tags)
    .filter(Boolean) || [];

  // Route to appropriate view based on content type
  switch (item.content_type) {
    case 'recording':
    case 'video':
      return (
        <VideoDetailView
          recording={item}
          transcript={transcript}
          document={document}
          initialTags={tags}
        />
      );

    case 'audio':
      return (
        <AudioDetailView
          recording={item}
          transcript={transcript}
          document={document}
          initialTags={tags}
        />
      );

    case 'document':
      return (
        <DocumentDetailView
          recording={item}
          transcript={transcript}
          document={document}
          initialTags={tags}
        />
      );

    case 'text':
      return (
        <TextNoteDetailView
          recording={item}
          transcript={transcript}
          document={document}
          initialTags={tags}
        />
      );

    default:
      // Fallback to video view for unknown types
      return (
        <VideoDetailView
          recording={item}
          transcript={transcript}
          document={document}
          initialTags={tags}
        />
      );
  }
}
