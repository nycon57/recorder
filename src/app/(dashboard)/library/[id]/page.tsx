import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  VideoDetailView,
  AudioDetailView,
  DocumentDetailView,
  TextNoteDetailView,
} from '@/app/components/library';
import { RelatedContent } from '@/app/components/content/RelatedContent';
import { ContentChatWidget } from '@/app/components/content/ContentChatWidget';
import { OnboardingViewTracker } from '@/app/components/onboarding/OnboardingViewTracker';
import { fetchKnowledgeStatusForSource } from '@/lib/services/knowledge-status';
import type { WorkflowStep, Database, Tag } from '@/lib/types/database';
import WorkflowViewer from '@/app/components/workflow/WorkflowViewer';

type ContentRow = Database['public']['Tables']['content']['Row'];
type TranscriptRow = Database['public']['Tables']['transcripts']['Row'];
type DocumentRow = Database['public']['Tables']['documents']['Row'];
type TagRow = Database['public']['Tables']['tags']['Row'];

type ContentDetailRow = ContentRow & {
  transcripts: TranscriptRow[] | TranscriptRow | null;
  documents: DocumentRow[] | DocumentRow | null;
};

type ContentTagLinkRow = {
  content_id: string;
  tag_id: string;
  tags: TagRow | null;
};

type DetailTranscript = {
  id: string;
  content_id: string;
  text: string;
  words_json?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }> | null;
  language?: string | null;
  confidence?: number | null;
  provider?: string | null;
};

type DetailDocument = {
  id: string;
  content_id: string;
  markdown: string;
  html?: string | null;
  summary?: string | null;
  version: string;
  status: string;
  model?: string | null;
};

function normalizeTranscript(
  transcript: TranscriptRow[] | TranscriptRow | null
): DetailTranscript | null {
  const row = Array.isArray(transcript) ? transcript[0] : transcript;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    content_id: row.content_id,
    text: row.text,
    words_json: Array.isArray(row.words_json)
      ? (row.words_json as DetailTranscript['words_json'])
      : null,
    language: row.language,
    confidence: row.confidence,
    provider: row.provider,
  };
}

function normalizeDocument(
  document: DocumentRow[] | DocumentRow | null
): DetailDocument | null {
  const row = Array.isArray(document) ? document[0] : document;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    content_id: row.content_id,
    markdown: row.markdown,
    html: row.html,
    summary: row.summary,
    version: row.version,
    status: row.status,
    model: row.model,
  };
}

async function getContentItem(id: string, internalOrgId: string) {
  const { data: item, error } = await supabaseAdmin
    .from('content')
    .select<ContentDetailRow>(
      `
      *,
      transcripts (*),
      documents (*)
    `,
    )
    .eq('id', id)
    .eq('org_id', internalOrgId)
    .single();

  if (error || !item) {
    return null;
  }

  let videoUrl = null;
  let downloadUrl = null;

  if (item.content_type === 'recording' || item.content_type === 'video') {
    // Prefer processed (MP4) over raw (WEBM)
    if (item.storage_path_processed) {
      const { data: urlData } = await supabaseAdmin.storage
        .from('recordings')
        .createSignedUrl(item.storage_path_processed, 3600);

      videoUrl = urlData?.signedUrl || null;
      downloadUrl = videoUrl;
    }

    if (!videoUrl && item.storage_path_raw) {
      const { data: urlData } = await supabaseAdmin.storage
        .from('recordings')
        .createSignedUrl(item.storage_path_raw, 3600);

      videoUrl = urlData?.signedUrl || null;
      downloadUrl = videoUrl;
    }
  }

  if (item.content_type === 'audio' && item.storage_path_raw) {
    const { data: urlData } = await supabaseAdmin.storage
      .from('recordings')
      .createSignedUrl(item.storage_path_raw, 3600);

    videoUrl = urlData?.signedUrl || null; // Reuse videoUrl for audio playback
    downloadUrl = videoUrl;
  }

  if (item.content_type === 'document' && item.storage_path_raw) {
    const { data: urlData } = await supabaseAdmin.storage
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
 * URL parameters:
 * - ?sourceKey={key} - Retrieves all cited chunks
 * - &highlight={chunkId} - Specifies which chunk to scroll to
 * - &t={seconds} - Seek to specific timestamp (video/audio only)
 */
export default async function LibraryItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sourceKey?: string; highlight?: string; t?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  // Look up the user's org from database
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('org_id')
    .eq('id', session.user.id)
    .maybeSingle();

  const orgId = userData?.org_id;

  if (!orgId) {
    redirect('/');
  }

  const { id } = await params;
  const { sourceKey, highlight, t } = await searchParams;

  const initialTimestamp = t ? parseInt(t, 10) : undefined;

  const item = await getContentItem(id, orgId);

  if (!item) {
    notFound();
  }

  const knowledgeStatus = await fetchKnowledgeStatusForSource({
    orgId,
    sourceId: item.id,
    sourceStatus: item.status,
  });

  const transcript = normalizeTranscript(item.transcripts);
  const document = normalizeDocument(item.documents);

  const { data: itemTags } = await supabaseAdmin
    .from('content_tags')
    .select<ContentTagLinkRow>(
      `
      content_id,
      tag_id,
      tags (
        id,
        name,
        color,
        created_at,
        updated_at
      )
    `,
    )
    .eq('content_id', id);

  const tags =
    itemTags
      ?.map((rt) => rt.tags)
      .filter((tag): tag is Tag => Boolean(tag)) || [];

  // Fetch the most recent non-archived workflow for this content
  const { data: rawWorkflow } = await supabaseAdmin
    .from('workflows')
    .select('*')
    .eq('content_id', id)
    .eq('org_id', item.org_id)
    .not('status', 'eq', 'archived')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const FRAMES_BUCKET = process.env.FRAMES_STORAGE_BUCKET || 'video-frames';

  let workflow = rawWorkflow;
  let supersededByContentId: string | null = null;

  if (rawWorkflow) {
    const steps = await Promise.all(
      rawWorkflow.steps.map(async (step: WorkflowStep) => {
        if (!step.screenshotPath) return step;
        try {
          const { data } = await supabaseAdmin.storage
            .from(FRAMES_BUCKET)
            .createSignedUrl(step.screenshotPath, 3600);
          return { ...step, screenshotPath: data?.signedUrl ?? null };
        } catch {
          return { ...step, screenshotPath: null };
        }
      }),
    );
    workflow = { ...rawWorkflow, steps };

    if (rawWorkflow.superseded_by) {
      const { data: superseding } = await supabaseAdmin
        .from('workflows')
        .select('content_id')
        .eq('id', rawWorkflow.superseded_by)
        .single();
      supersededByContentId = superseding?.content_id ?? null;
    }
  }

  const sharedProps = {
    recording: item,
    transcript,
    document,
    knowledgeStatus,
    initialTags: tags,
    sourceKey,
    initialHighlightId: highlight,
  };

  let detailView: React.ReactNode;
  switch (item.content_type) {
    case 'recording':
    case 'video':
      detailView = (
        <VideoDetailView {...sharedProps} initialTimestamp={initialTimestamp} />
      );
      break;
    case 'audio':
      detailView = (
        <AudioDetailView {...sharedProps} initialTimestamp={initialTimestamp} />
      );
      break;
    case 'document':
      detailView = <DocumentDetailView {...sharedProps} />;
      break;
    case 'text':
      detailView = <TextNoteDetailView {...sharedProps} />;
      break;
    default:
      detailView = (
        <VideoDetailView {...sharedProps} initialTimestamp={initialTimestamp} />
      );
  }

  const showRelated =
    item.status === 'completed' || item.status === 'transcribed';

  return (
    <>
      <OnboardingViewTracker contentId={id} />
      {detailView}
      {workflow && (
        <section className="trbd-page" aria-labelledby="workflow-heading">
          <h2 id="workflow-heading" className="text-heading-4">
            Workflow
          </h2>
          <WorkflowViewer
            workflowId={workflow.id}
            workflow={workflow}
            supersededByContentId={supersededByContentId}
          />
        </section>
      )}
      {showRelated && (
        <>
          <section
            className="trbd-page"
            aria-labelledby="related-content-heading"
          >
            <h2 id="related-content-heading" className="text-heading-4">
              Related Content
            </h2>
            <Suspense fallback={null}>
              <RelatedContent contentId={id} orgId={item.org_id} />
            </Suspense>
          </section>
          <ContentChatWidget
            contentId={id}
            contentTitle={item.title || 'Untitled'}
          />
        </>
      )}
    </>
  );
}
