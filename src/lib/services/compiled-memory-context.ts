import { createClient as createAdminClient } from '@/lib/supabase/admin';
import {
  resolveOrgWikiPagesByVector,
  type ResolvedOrgWikiPage,
} from '@/lib/services/org-wiki-embedding';
import { getVendorForOrg } from '@/lib/services/vendor-customers';
import {
  resolveVendorWikiPage,
  type VendorWikiPage,
} from '@/lib/services/vendor-wiki-resolver';
import {
  resolveVendorCorpusPages,
  formatVendorKnowledgeTitle,
  type VendorCorpusPageMatch,
} from '@/lib/services/vendor-doc-corpus';
import { resolveClusterContext } from '@/lib/services/wiki-clusters';

const DEFAULT_MATCH_LIMIT = 3;
const CLUSTER_CONTEXT_PER_CLUSTER = 2;

export type CompiledMemoryCitationLayer =
  | 'vendor'
  | 'vendor_training'
  | 'org';

export interface CompiledMemoryCitation {
  sourceId: string;
  title: string;
  layer: CompiledMemoryCitationLayer;
  linkUrl?: string;
}

export interface ResolveCompiledMemoryContextArgs {
  orgId: string;
  userId?: string;
  app: string;
  screen: string;
  question?: string;
  questionEmbedding: number[];
  asOf?: string | null;
  limit?: number;
}

interface ResolveCompiledMemoryContextDeps {
  createAdminClient?: typeof createAdminClient;
  getVendorForOrg?: typeof getVendorForOrg;
  resolveOrgWikiPagesByVector?: typeof resolveOrgWikiPagesByVector;
  resolveVendorWikiPage?: typeof resolveVendorWikiPage;
  resolveVendorCorpusPages?: typeof resolveVendorCorpusPages;
  resolveClusterContext?: typeof resolveClusterContext;
}

export interface CompiledMemoryContext {
  vendorKnowledge: {
    page: VendorWikiPage | null;
    pages: VendorCorpusPageMatch[];
  };
  vendorTraining: {
    pages: ResolvedOrgWikiPage[];
  };
  orgKnowledge: {
    pages: ResolvedOrgWikiPage[];
    priorTopics: string[];
  };
  citationsBySourceId: Record<string, CompiledMemoryCitation>;
}

async function resolveVendorTrainingPages(args: {
  orgId: string;
  app: string;
  questionEmbedding: number[];
  asOf?: string | null;
  limit: number;
}, deps: ResolveCompiledMemoryContextDeps = {}): Promise<ResolvedOrgWikiPage[]> {
  const { orgId, app, questionEmbedding, asOf, limit } = args;
  const getVendorForOrgFn = deps.getVendorForOrg ?? getVendorForOrg;
  const resolveOrgWikiPagesByVectorFn =
    deps.resolveOrgWikiPagesByVector ?? resolveOrgWikiPagesByVector;

  if (!questionEmbedding || questionEmbedding.length === 0) {
    return [];
  }

  try {
    const vendorInfo = await getVendorForOrgFn(orgId);
    if (!vendorInfo) return [];

    const inScope =
      !vendorInfo.whiteLabelConfig.knowledge_scope ||
      vendorInfo.whiteLabelConfig.knowledge_scope.length === 0 ||
      vendorInfo.whiteLabelConfig.knowledge_scope.some(
        (scope) => scope.toLowerCase() === app,
      );

    if (!inScope) {
      return [];
    }

    return await resolveOrgWikiPagesByVectorFn({
      orgId: vendorInfo.vendorOrgId,
      questionEmbedding,
      limit,
      asOf,
    });
  } catch (vendorTrainingError) {
    console.error(
      '[compiled-memory-context] vendor training resolution failed:',
      vendorTrainingError,
    );
    return [];
  }
}

async function resolveOrgKnowledge(args: {
  orgId: string;
  userId?: string;
  questionEmbedding: number[];
  asOf?: string | null;
  limit: number;
}, deps: ResolveCompiledMemoryContextDeps = {}): Promise<CompiledMemoryContext['orgKnowledge']> {
  const { orgId, userId, questionEmbedding, asOf, limit } = args;
  const resolveOrgWikiPagesByVectorFn =
    deps.resolveOrgWikiPagesByVector ?? resolveOrgWikiPagesByVector;
  const resolveClusterContextFn =
    deps.resolveClusterContext ?? resolveClusterContext;
  const createAdminClientFn = deps.createAdminClient ?? createAdminClient;

  if (!questionEmbedding || questionEmbedding.length === 0) {
    return {
      pages: [],
      priorTopics: [],
    };
  }

  let pages: ResolvedOrgWikiPage[] = [];
  try {
    pages = await resolveOrgWikiPagesByVectorFn({
      orgId,
      questionEmbedding,
      limit,
      asOf,
    });
  } catch (orgError) {
    console.error(
      '[compiled-memory-context] org page resolution failed:',
      orgError,
    );
    return {
      pages: [],
      priorTopics: [],
    };
  }

  if (pages.length === 0) {
    return {
      pages: [],
      priorTopics: [],
    };
  }

  const supabase = createAdminClientFn();

  if (asOf == null) {
    try {
      const { data: settingsRaw } = await supabase
        .from('org_agent_settings')
        .select('wiki_cluster_context_enabled')
        .eq('org_id', orgId)
        .maybeSingle();

      const settings = settingsRaw as
        | { wiki_cluster_context_enabled: boolean | null }
        | null;

      const enabled = settings?.wiki_cluster_context_enabled !== false;
      if (enabled) {
        const basePageIds = pages.map((page) => page.id);
        const clusterPages = await resolveClusterContextFn({
          orgId,
          basePageIds,
          perCluster: CLUSTER_CONTEXT_PER_CLUSTER,
          excludePageIds: basePageIds,
        });

        if (clusterPages.length > 0) {
          pages = [...pages, ...clusterPages];
        }
      }
    } catch (clusterError) {
      console.error(
        '[compiled-memory-context] cluster context expansion failed:',
        clusterError,
      );
    }
  }

  if (!userId) {
    return {
      pages,
      priorTopics: [],
    };
  }

  let priorTopics: string[] = [];
  try {
    const pageIds = pages.map((page) => page.id);
    const { data: priorInteractions } = await supabase
      .from('user_wiki_interactions')
      .select('wiki_page_id')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .in('wiki_page_id', pageIds);

    if (priorInteractions && priorInteractions.length > 0) {
      const priorPageIds = new Set(
        (priorInteractions as { wiki_page_id: string }[]).map(
          (interaction) => interaction.wiki_page_id,
        ),
      );

      priorTopics = Array.from(
        new Set(
          pages
            .filter((page) => priorPageIds.has(page.id))
            .map((page) => page.topic),
        ),
      );
    }
  } catch (memoryError) {
    console.error(
      '[compiled-memory-context] user memory lookup failed:',
      memoryError,
    );
  }

  return {
    pages,
    priorTopics,
  };
}

async function resolveOrgCitationLinks(
  pageIds: string[],
  deps: ResolveCompiledMemoryContextDeps = {},
): Promise<Map<string, string>> {
  if (pageIds.length === 0) {
    return new Map();
  }

  try {
    const createAdminClientFn = deps.createAdminClient ?? createAdminClient;
    const supabase = createAdminClientFn();
    const { data } = await supabase
      .from('wiki_page_sources')
      .select('page_id, source_id, source_type')
      .in('page_id', pageIds)
      .eq('source_type', 'recording')
      .order('contributed_at', { ascending: true });

    const rows =
      (data as
        | Array<{
            page_id: string;
            source_id: string;
            source_type: string;
          }>
        | null) ?? [];

    const links = new Map<string, string>();
    for (const row of rows) {
      if (!links.has(row.page_id) && row.source_id) {
        links.set(row.page_id, `/dashboard/recordings/${row.source_id}`);
      }
    }

    return links;
  } catch (error) {
    console.error(
      '[compiled-memory-context] org citation link resolution failed:',
      error,
    );
    return new Map();
  }
}

async function buildCitationsBySourceId(args: {
  vendorPage: VendorWikiPage | null;
  vendorPages: VendorCorpusPageMatch[];
  vendorTrainingPages: ResolvedOrgWikiPage[];
  orgPages: ResolvedOrgWikiPage[];
}, deps: ResolveCompiledMemoryContextDeps = {}): Promise<Record<string, CompiledMemoryCitation>> {
  const { vendorPage, vendorPages, vendorTrainingPages, orgPages } = args;
  const citationsBySourceId: Record<string, CompiledMemoryCitation> = {};

  if (vendorPage) {
    citationsBySourceId[vendorPage.id] = {
      sourceId: vendorPage.id,
      title: formatVendorKnowledgeTitle(vendorPage.app, vendorPage.screen),
      layer: 'vendor',
      linkUrl: vendorPage.source_url ?? undefined,
    };
  }

  for (const vendorKnowledgePage of vendorPages) {
    citationsBySourceId[vendorKnowledgePage.id] = {
      sourceId: vendorKnowledgePage.id,
      title: vendorKnowledgePage.title,
      layer: 'vendor',
      linkUrl: vendorKnowledgePage.sourceUrl ?? undefined,
    };
  }

  for (const page of vendorTrainingPages) {
    citationsBySourceId[page.id] = {
      sourceId: page.id,
      title: page.topic,
      layer: 'vendor_training',
    };
  }

  const orgCitationLinks = await resolveOrgCitationLinks(
    orgPages.map((page) => page.id),
    deps,
  );

  for (const page of orgPages) {
    citationsBySourceId[page.id] = {
      sourceId: page.id,
      title: page.topic,
      layer: 'org',
      linkUrl: orgCitationLinks.get(page.id),
    };
  }

  return citationsBySourceId;
}

export async function resolveCompiledMemoryContext(
  args: ResolveCompiledMemoryContextArgs,
  deps: ResolveCompiledMemoryContextDeps = {},
): Promise<CompiledMemoryContext> {
  const {
    orgId,
    userId,
    app,
    screen,
    question = '',
    questionEmbedding,
    asOf,
    limit = DEFAULT_MATCH_LIMIT,
  } = args;
  const resolveVendorWikiPageFn =
    deps.resolveVendorWikiPage ?? resolveVendorWikiPage;
  const resolveVendorCorpusPagesFn =
    deps.resolveVendorCorpusPages ?? resolveVendorCorpusPages;

  const [vendorPage, vendorCorpusPages, vendorTrainingPages, orgKnowledge] =
    await Promise.all([
      resolveVendorWikiPageFn({ app, screen }),
      resolveVendorCorpusPagesFn({
        app,
        screen,
        question,
        questionEmbedding,
        limit,
      }),
      resolveVendorTrainingPages(
        {
          orgId,
          app,
          questionEmbedding,
          asOf,
          limit,
        },
        deps,
      ),
      resolveOrgKnowledge(
        {
          orgId,
          userId,
          questionEmbedding,
          asOf,
          limit,
        },
        deps,
      ),
    ]);

  const vendorPages: VendorCorpusPageMatch[] = [];
  const seenVendorPageIds = new Set<string>();
  const seenSourceIds = new Set<string>();

  if (vendorPage) {
    const exactCorpusPage =
      vendorCorpusPages.find(
        (page) =>
          page.vendorPageId === vendorPage.id || page.id === vendorPage.id,
      ) ?? null;

    vendorPages.push({
      id: vendorPage.id,
      vendorPageId: vendorPage.id,
      vendorSourceId:
        exactCorpusPage?.vendorSourceId ?? vendorPage.vendor_source_id,
      app: vendorPage.app,
      screen: vendorPage.screen,
      title:
        exactCorpusPage?.title ??
        formatVendorKnowledgeTitle(vendorPage.app, vendorPage.screen),
      content: vendorPage.content,
      sourceUrl: exactCorpusPage?.sourceUrl ?? vendorPage.source_url,
      confidence: exactCorpusPage?.confidence ?? 0.8,
      distance: exactCorpusPage?.distance ?? 0.2,
      matchType: 'exact',
    });
    seenVendorPageIds.add(vendorPage.id);
    seenSourceIds.add(vendorPage.id);
    if (exactCorpusPage) {
      seenSourceIds.add(exactCorpusPage.id);
    }
  }

  for (const vendorCorpusPage of vendorCorpusPages) {
    if (seenSourceIds.has(vendorCorpusPage.id)) {
      continue;
    }

    if (
      vendorCorpusPage.vendorPageId &&
      seenVendorPageIds.has(vendorCorpusPage.vendorPageId)
    ) {
      continue;
    }

    vendorPages.push(vendorCorpusPage);
    seenSourceIds.add(vendorCorpusPage.id);
    if (vendorCorpusPage.vendorPageId) {
      seenVendorPageIds.add(vendorCorpusPage.vendorPageId);
    }
  }

  const citationsBySourceId = await buildCitationsBySourceId({
    vendorPage,
    vendorPages,
    vendorTrainingPages,
    orgPages: orgKnowledge.pages,
  }, deps);

  return {
    vendorKnowledge: {
      page: vendorPage,
      pages: vendorPages,
    },
    vendorTraining: {
      pages: vendorTrainingPages,
    },
    orgKnowledge,
    citationsBySourceId,
  };
}
