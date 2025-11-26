import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';

import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  VideoDetailView,
  AudioDetailView,
  DocumentDetailView,
  TextNoteDetailView,
} from '@/app/components/library';

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

  // Fetch content item (from content table - unified content storage)
  const { data: item, error } = await supabase
    .from('content')
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
 * Fetch sources for highlighting from cache
 */
async function getHighlightSources(sourceKey: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/chat?sourcesKey=${sourceKey}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return null;
    }

    const { sources } = await response.json();
    return sources || null;
  } catch (error) {
    console.error('[Library Detail] Failed to fetch highlight sources:', error);
    return null;
  }
}

/**
 * Library Item Detail Page
 * Displays detailed view of content item with type-specific renderers
 * Routes to appropriate component based on content_type:
 * - recording/video -> VideoDetailView
 * - audio -> AudioDetailView
 * - document -> DocumentDetailView
 * - text -> TextNoteDetailView
 *
 * Supports citation highlighting via URL parameters:
 * - ?sourceKey={key} - Retrieves all cited chunks
 * - &highlight={chunkId} - Specifies which chunk to scroll to
 */
export default async function LibraryItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sourceKey?: string; highlight?: string }>;
}) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/');
  }

  const { id } = await params;
  const { sourceKey, highlight } = await searchParams;

  const item = await getContentItem(id, orgId);

  // Pass sourceKey and highlight to components for client-side fetching
  // (Server-side fetch has issues with Next.js routing/caching)

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
    .from('content_tags')
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
    .eq('content_id', id);

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
          sourceKey={sourceKey}
          initialHighlightId={highlight}
        />
      );

    case 'audio':
      return (
        <AudioDetailView
          recording={item}
          transcript={transcript}
          document={document}
          initialTags={tags}
          sourceKey={sourceKey}
          initialHighlightId={highlight}
        />
      );

    case 'document':
      return (
        <DocumentDetailView
          recording={item}
          transcript={transcript}
          document={document}
          initialTags={tags}
          sourceKey={sourceKey}
          initialHighlightId={highlight}
        />
      );

    case 'text':
      return (
        <TextNoteDetailView
          recording={item}
          transcript={transcript}
          document={document}
          initialTags={tags}
          sourceKey={sourceKey}
          initialHighlightId={highlight}
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
          sourceKey={sourceKey}
          initialHighlightId={highlight}
        />
      );
  }
}
