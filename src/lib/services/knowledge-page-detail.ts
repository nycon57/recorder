import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { resolveKnowledgeStatusForWikiPage } from '@/lib/utils/knowledge-status';

type OrgWikiPageRow = Database['public']['Tables']['org_wiki_pages']['Row'];
type VendorWikiPageRow = Database['public']['Tables']['vendor_wiki_pages']['Row'];
type WikiPageSourceRow = Database['public']['Tables']['wiki_page_sources']['Row'];
type WikiRelationshipRow = Database['public']['Tables']['wiki_relationships']['Row'];
type ContentRow = Database['public']['Tables']['content']['Row'];
type TranscriptRow = Database['public']['Tables']['transcripts']['Row'];
type DocumentRow = Database['public']['Tables']['documents']['Row'];
type WorkflowRow = Database['public']['Tables']['workflows']['Row'];
type AgentApprovalRow = Database['public']['Tables']['agent_approval_queue']['Row'];

type MinimalContentRow = Pick<
  ContentRow,
  'id' | 'title' | 'status' | 'content_type' | 'updated_at'
>;

type MinimalSourceRow = Pick<
  WikiPageSourceRow,
  'id' | 'source_type' | 'source_id' | 'contributed_at' | 'contribution_summary'
>;

type MinimalTranscriptRow = Pick<TranscriptRow, 'id' | 'content_id' | 'updated_at'>;
type MinimalDocumentRow = Pick<DocumentRow, 'id' | 'content_id' | 'status' | 'updated_at'>;
type MinimalWorkflowRow = Pick<
  WorkflowRow,
  'id' | 'content_id' | 'title' | 'status' | 'updated_at'
>;
type MinimalRelationshipRow = Pick<
  WikiRelationshipRow,
  | 'id'
  | 'source_page_id'
  | 'target_page_id'
  | 'relationship_type'
  | 'source_type'
  | 'confidence'
  | 'evidence'
  | 'created_at'
>;
type MinimalApprovalRow = Pick<
  AgentApprovalRow,
  | 'id'
  | 'agent_type'
  | 'action_type'
  | 'content_id'
  | 'description'
  | 'status'
  | 'reviewed_by'
  | 'reviewed_at'
  | 'rejection_reason'
  | 'expires_at'
  | 'created_at'
>;

type MinimalOrgPageRow = Pick<
  OrgWikiPageRow,
  | 'id'
  | 'org_id'
  | 'app'
  | 'screen'
  | 'topic'
  | 'content'
  | 'confidence'
  | 'valid_from'
  | 'valid_until'
  | 'supersedes_id'
  | 'compilation_log'
  | 'created_at'
  | 'updated_at'
>;

type MinimalVendorPageRow = Pick<
  VendorWikiPageRow,
  | 'id'
  | 'app'
  | 'screen'
  | 'content'
  | 'source_url'
  | 'app_version'
  | 'created_at'
  | 'updated_at'
>;

interface WikiPageHistoryRow {
  id: string;
  org_id: string;
  app: string | null;
  screen: string | null;
  topic: string;
  content: string;
  confidence: number;
  valid_from: string;
  valid_until: string | null;
  supersedes_id: string | null;
  compilation_log: unknown;
  created_at: string;
  updated_at: string;
}

interface CompilationLogEntry {
  action: 'created' | 'additive' | 'redundant' | 'flagged' | 'applied' | 'rejected';
  source_recording_id: string;
  detected_at: string;
  contradictions?: Array<{
    old: string;
    new: string;
    field?: string;
  }>;
  additions?: string[];
  confidence_delta?: number;
  old_content?: string | null;
  new_content?: string | null;
  merged_content?: string | null;
  diff_summary?: string | null;
  applied_at?: string | null;
  applied_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

interface PendingContradiction {
  entryIndex: number;
  entry: CompilationLogEntry;
}

export interface KnowledgePageSourceArtifacts {
  transcript: MinimalTranscriptRow | null;
  document: MinimalDocumentRow | null;
  workflow: MinimalWorkflowRow | null;
}

export interface KnowledgePageSource {
  id: string;
  sourceType: WikiPageSourceRow['source_type'];
  sourceId: string;
  contributedAt: string;
  contributionSummary: string | null;
  content: MinimalContentRow | null;
  artifacts: KnowledgePageSourceArtifacts;
}

export interface KnowledgePageRelationship {
  id: string;
  direction: 'incoming' | 'outgoing';
  relationshipType: WikiRelationshipRow['relationship_type'];
  sourceType: WikiRelationshipRow['source_type'];
  confidence: number;
  evidence: string | null;
  createdAt: string;
  relatedPage: {
    id: string;
    topic: string;
    app: string | null;
    screen: string | null;
    validUntil: string | null;
  } | null;
}

export interface KnowledgePageHistoryVersion {
  id: string;
  topic: string;
  content: string;
  confidence: number;
  validFrom: string;
  validUntil: string | null;
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
  knowledgeStatus: ReturnType<typeof resolveKnowledgeStatusForWikiPage>;
}

export interface KnowledgePageApprovalSummary {
  pendingContradictions: PendingContradiction[];
  resolvedContradictions: CompilationLogEntry[];
  pendingApprovals: MinimalApprovalRow[];
  reviewedApprovals: MinimalApprovalRow[];
}

export interface OrgKnowledgePageDetail {
  kind: 'org';
  page: MinimalOrgPageRow;
  vendorBaseline: MinimalVendorPageRow[];
  sources: KnowledgePageSource[];
  relationships: KnowledgePageRelationship[];
  history: KnowledgePageHistoryVersion[];
  approvals: KnowledgePageApprovalSummary;
}

export interface VendorKnowledgePageDetail {
  kind: 'vendor';
  page: MinimalVendorPageRow;
  matchingOrgPages: Array<
    Pick<
      OrgWikiPageRow,
      'id' | 'topic' | 'app' | 'screen' | 'confidence' | 'valid_until' | 'updated_at'
    >
  >;
}

export type KnowledgePageDetail = OrgKnowledgePageDetail | VendorKnowledgePageDetail;

export interface KnowledgePageArtifactIndexItem {
  transcript: MinimalTranscriptRow | null;
  document: MinimalDocumentRow | null;
  workflow: MinimalWorkflowRow | null;
}

export type KnowledgePageArtifactIndex = Map<string, KnowledgePageArtifactIndexItem>;

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function readCompilationLog(value: unknown): CompilationLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value as CompilationLogEntry[];
}

function extractPendingContradictions(log: CompilationLogEntry[]): PendingContradiction[] {
  const pending: PendingContradiction[] = [];
  for (let index = 0; index < log.length; index += 1) {
    const entry = log[index];
    if (entry.action === 'flagged' && (entry.resolved_at ?? null) === null) {
      pending.push({
        entryIndex: index,
        entry,
      });
    }
  }
  return pending;
}

function pickLatestByContentId<Row extends { content_id: string; updated_at: string }>(
  rows: Row[]
): Map<string, Row> {
  const latest = new Map<string, Row>();
  for (const row of rows) {
    const current = latest.get(row.content_id);
    if (!current || toTimestamp(row.updated_at) > toTimestamp(current.updated_at)) {
      latest.set(row.content_id, row);
    }
  }
  return latest;
}

export function buildKnowledgePageArtifactIndex(input: {
  transcripts: MinimalTranscriptRow[];
  documents: MinimalDocumentRow[];
  workflows: MinimalWorkflowRow[];
}): KnowledgePageArtifactIndex {
  const transcriptByContentId = pickLatestByContentId(input.transcripts);
  const documentByContentId = pickLatestByContentId(input.documents);
  const workflowByContentId = pickLatestByContentId(input.workflows);

  const contentIds = new Set<string>([
    ...transcriptByContentId.keys(),
    ...documentByContentId.keys(),
    ...workflowByContentId.keys(),
  ]);

  const index: KnowledgePageArtifactIndex = new Map();
  for (const contentId of contentIds) {
    index.set(contentId, {
      transcript: transcriptByContentId.get(contentId) ?? null,
      document: documentByContentId.get(contentId) ?? null,
      workflow: workflowByContentId.get(contentId) ?? null,
    });
  }

  return index;
}

export function enrichKnowledgePageSources(input: {
  sourceRows: MinimalSourceRow[];
  contentById: Map<string, MinimalContentRow>;
  artifactIndex: KnowledgePageArtifactIndex;
}): KnowledgePageSource[] {
  return [...input.sourceRows]
    .sort((left, right) => toTimestamp(right.contributed_at) - toTimestamp(left.contributed_at))
    .map((source) => {
      const content = input.contentById.get(source.source_id) ?? null;
      const artifacts = input.artifactIndex.get(source.source_id) ?? {
        transcript: null,
        document: null,
        workflow: null,
      };

      return {
        id: source.id,
        sourceType: source.source_type,
        sourceId: source.source_id,
        contributedAt: source.contributed_at,
        contributionSummary: source.contribution_summary,
        content,
        artifacts,
      };
    });
}

export function buildKnowledgePageRelationships(input: {
  pageId: string;
  relationships: MinimalRelationshipRow[];
  pagesById: Map<string, Pick<OrgWikiPageRow, 'id' | 'topic' | 'app' | 'screen' | 'valid_until'>>;
}): KnowledgePageRelationship[] {
  return [...input.relationships]
    .map((relationship) => {
      const isOutgoing = relationship.source_page_id === input.pageId;
      const relatedPageId = isOutgoing
        ? relationship.target_page_id
        : relationship.source_page_id;
      const relatedPage = input.pagesById.get(relatedPageId) ?? null;

      return {
        id: relationship.id,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        relationshipType: relationship.relationship_type,
        sourceType: relationship.source_type,
        confidence: relationship.confidence,
        evidence: relationship.evidence,
        createdAt: relationship.created_at,
        relatedPage: relatedPage
          ? {
              id: relatedPage.id,
              topic: relatedPage.topic,
              app: relatedPage.app,
              screen: relatedPage.screen,
              validUntil: relatedPage.valid_until,
            }
          : null,
      };
    })
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));
}

export function splitApprovalRowsByStatus(approvals: MinimalApprovalRow[]): {
  pendingApprovals: MinimalApprovalRow[];
  reviewedApprovals: MinimalApprovalRow[];
} {
  const pendingApprovals: MinimalApprovalRow[] = [];
  const reviewedApprovals: MinimalApprovalRow[] = [];

  for (const approval of approvals) {
    if (approval.status === 'pending') {
      pendingApprovals.push(approval);
    } else {
      reviewedApprovals.push(approval);
    }
  }

  pendingApprovals.sort(
    (left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at)
  );
  reviewedApprovals.sort(
    (left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at)
  );

  return { pendingApprovals, reviewedApprovals };
}

async function loadOrgPageHistory(orgId: string, pageId: string) {
  const { data, error } = await supabaseAdmin.rpc('get_org_wiki_page_history' as never, {
    p_page_id: pageId,
    p_org_id: orgId,
  } as never);

  if (error) {
    console.warn('[knowledge-page-detail] Failed to load page history:', error.message);
    return [] as KnowledgePageHistoryVersion[];
  }

  const rows = (data ?? []) as WikiPageHistoryRow[];
  return rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    content: row.content,
    confidence: row.confidence,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    supersedesId: row.supersedes_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    knowledgeStatus: resolveKnowledgeStatusForWikiPage({
      validUntil: row.valid_until,
      app: row.app,
      screen: row.screen,
      hasPendingReview:
        extractPendingContradictions(readCompilationLog(row.compilation_log)).length > 0,
    }),
  }));
}

export async function fetchKnowledgePageDetail(input: {
  orgId: string;
  pageId: string;
}): Promise<KnowledgePageDetail | null> {
  const { data: orgPage, error: orgPageError } = await supabaseAdmin
    .from('org_wiki_pages')
    .select(
      'id, org_id, app, screen, topic, content, confidence, valid_from, valid_until, supersedes_id, compilation_log, created_at, updated_at'
    )
    .eq('org_id', input.orgId)
    .eq('id', input.pageId)
    .maybeSingle();

  if (orgPageError) {
    throw new Error(`Failed to load org wiki page detail: ${orgPageError.message}`);
  }

  if (orgPage) {
    const page = orgPage as MinimalOrgPageRow;
    const sourceRowsPromise = supabaseAdmin
      .from('wiki_page_sources')
      .select('id, source_type, source_id, contributed_at, contribution_summary')
      .eq('page_id', page.id)
      .order('contributed_at', { ascending: false });

    const relationshipsPromise = supabaseAdmin
      .from('wiki_relationships')
      .select(
        'id, source_page_id, target_page_id, relationship_type, source_type, confidence, evidence, created_at'
      )
      .eq('org_id', input.orgId)
      .or(`source_page_id.eq.${page.id},target_page_id.eq.${page.id}`);

    const vendorBaselinePromise =
      page.app && page.screen
        ? supabaseAdmin
            .from('vendor_wiki_pages')
            .select(
              'id, app, screen, content, source_url, app_version, created_at, updated_at'
            )
            .ilike('app', page.app)
            .ilike('screen', page.screen)
            .order('updated_at', { ascending: false })
            .limit(5)
        : Promise.resolve({
            data: [] as MinimalVendorPageRow[],
            error: null as { message: string } | null,
          });

    const [sourceRowsResult, relationshipsResult, vendorBaselineResult, history] =
      await Promise.all([
        sourceRowsPromise,
        relationshipsPromise,
        vendorBaselinePromise,
        loadOrgPageHistory(input.orgId, page.id),
      ]);

    if (sourceRowsResult.error) {
      throw new Error(`Failed to load page sources: ${sourceRowsResult.error.message}`);
    }
    if (relationshipsResult.error) {
      throw new Error(
        `Failed to load page relationships: ${relationshipsResult.error.message}`
      );
    }
    if (vendorBaselineResult.error) {
      throw new Error(
        `Failed to load vendor baseline for page: ${vendorBaselineResult.error.message}`
      );
    }

    const sourceRows = (sourceRowsResult.data ?? []) as MinimalSourceRow[];
    const sourceContentIds = Array.from(
      new Set(
        sourceRows
          .filter((source) => source.source_type !== 'manual')
          .map((source) => source.source_id)
      )
    );

    const [contentRowsResult, transcriptRowsResult, documentRowsResult, workflowRowsResult] =
      sourceContentIds.length > 0
        ? await Promise.all([
            supabaseAdmin
              .from('content')
              .select('id, title, status, content_type, updated_at')
              .in('id', sourceContentIds),
            supabaseAdmin
              .from('transcripts')
              .select('id, content_id, updated_at')
              .in('content_id', sourceContentIds),
            supabaseAdmin
              .from('documents')
              .select('id, content_id, status, updated_at')
              .in('content_id', sourceContentIds),
            supabaseAdmin
              .from('workflows')
              .select('id, content_id, title, status, updated_at')
              .in('content_id', sourceContentIds)
              .not('status', 'eq', 'archived'),
          ])
        : [
            { data: [] as MinimalContentRow[], error: null as { message: string } | null },
            {
              data: [] as MinimalTranscriptRow[],
              error: null as { message: string } | null,
            },
            { data: [] as MinimalDocumentRow[], error: null as { message: string } | null },
            { data: [] as MinimalWorkflowRow[], error: null as { message: string } | null },
          ];

    if (contentRowsResult.error) {
      throw new Error(`Failed to load source content records: ${contentRowsResult.error.message}`);
    }
    if (transcriptRowsResult.error) {
      throw new Error(`Failed to load source transcripts: ${transcriptRowsResult.error.message}`);
    }
    if (documentRowsResult.error) {
      throw new Error(`Failed to load source documents: ${documentRowsResult.error.message}`);
    }
    if (workflowRowsResult.error) {
      throw new Error(`Failed to load source workflows: ${workflowRowsResult.error.message}`);
    }

    const relationshipRows = (relationshipsResult.data ?? []) as MinimalRelationshipRow[];
    const relatedPageIds = Array.from(
      new Set(
        relationshipRows.flatMap((relationship) => [
          relationship.source_page_id,
          relationship.target_page_id,
        ])
      )
    );

    const relatedPagesResult =
      relatedPageIds.length > 0
        ? await supabaseAdmin
            .from('org_wiki_pages')
            .select('id, topic, app, screen, valid_until')
            .eq('org_id', input.orgId)
            .in('id', relatedPageIds)
        : {
            data: [] as Array<
              Pick<OrgWikiPageRow, 'id' | 'topic' | 'app' | 'screen' | 'valid_until'>
            >,
            error: null as { message: string } | null,
          };

    if (relatedPagesResult.error) {
      throw new Error(`Failed to load related wiki pages: ${relatedPagesResult.error.message}`);
    }

    const approvalsResult =
      sourceContentIds.length > 0
        ? await supabaseAdmin
            .from('agent_approval_queue')
            .select(
              'id, agent_type, action_type, content_id, description, status, reviewed_by, reviewed_at, rejection_reason, expires_at, created_at'
            )
            .eq('org_id', input.orgId)
            .in('content_id', sourceContentIds)
            .order('created_at', { ascending: false })
        : {
            data: [] as MinimalApprovalRow[],
            error: null as { message: string } | null,
          };

    if (approvalsResult.error) {
      throw new Error(`Failed to load related approval queue entries: ${approvalsResult.error.message}`);
    }

    const contentRows = (contentRowsResult.data ?? []) as MinimalContentRow[];
    const transcriptRows = (transcriptRowsResult.data ?? []) as MinimalTranscriptRow[];
    const documentRows = (documentRowsResult.data ?? []) as MinimalDocumentRow[];
    const workflowRows = (workflowRowsResult.data ?? []) as MinimalWorkflowRow[];

    const contentById = new Map(contentRows.map((row) => [row.id, row]));
    const artifactIndex = buildKnowledgePageArtifactIndex({
      transcripts: transcriptRows,
      documents: documentRows,
      workflows: workflowRows,
    });
    const sources = enrichKnowledgePageSources({
      sourceRows,
      contentById,
      artifactIndex,
    });

    const pagesById = new Map(
      (
        (relatedPagesResult.data ?? []) as Array<
          Pick<OrgWikiPageRow, 'id' | 'topic' | 'app' | 'screen' | 'valid_until'>
        >
      ).map((relatedPage) => [relatedPage.id, relatedPage])
    );
    const relationships = buildKnowledgePageRelationships({
      pageId: page.id,
      relationships: relationshipRows,
      pagesById,
    });

    const compilationLog = readCompilationLog(page.compilation_log);
    const pendingContradictions = extractPendingContradictions(compilationLog);
    const resolvedContradictions = compilationLog.filter(
      (entry) => entry.action === 'flagged' && (entry.resolved_at ?? null) !== null
    );
    resolvedContradictions.sort(
      (left, right) => toTimestamp(right.detected_at) - toTimestamp(left.detected_at)
    );

    const { pendingApprovals, reviewedApprovals } = splitApprovalRowsByStatus(
      (approvalsResult.data ?? []) as MinimalApprovalRow[]
    );

    return {
      kind: 'org',
      page,
      vendorBaseline: (vendorBaselineResult.data ?? []) as MinimalVendorPageRow[],
      sources,
      relationships,
      history,
      approvals: {
        pendingContradictions,
        resolvedContradictions,
        pendingApprovals,
        reviewedApprovals,
      },
    };
  }

  const { data: vendorPage, error: vendorPageError } = await supabaseAdmin
    .from('vendor_wiki_pages')
    .select('id, app, screen, content, source_url, app_version, created_at, updated_at')
    .eq('id', input.pageId)
    .maybeSingle();

  if (vendorPageError) {
    throw new Error(`Failed to load vendor wiki page detail: ${vendorPageError.message}`);
  }

  if (!vendorPage) {
    return null;
  }

  const page = vendorPage as MinimalVendorPageRow;
  const { data: matchingOrgPages, error: matchingOrgPagesError } = await supabaseAdmin
    .from('org_wiki_pages')
    .select('id, topic, app, screen, confidence, valid_until, updated_at')
    .eq('org_id', input.orgId)
    .is('valid_until', null)
    .ilike('app', page.app)
    .ilike('screen', page.screen)
    .order('updated_at', { ascending: false });

  if (matchingOrgPagesError) {
    throw new Error(
      `Failed to load org matches for vendor page detail: ${matchingOrgPagesError.message}`
    );
  }

  return {
    kind: 'vendor',
    page,
    matchingOrgPages:
      (matchingOrgPages ?? []) as VendorKnowledgePageDetail['matchingOrgPages'],
  };
}
