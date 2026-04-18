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
  userId: string;
  app: string;
  screen: string;
  questionEmbedding: number[];
  asOf?: string | null;
  limit?: number;
}

export interface CompiledMemoryContext {
  vendorKnowledge: {
    page: VendorWikiPage | null;
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
}): Promise<ResolvedOrgWikiPage[]> {
  const { orgId, app, questionEmbedding, asOf, limit } = args;

  if (!questionEmbedding || questionEmbedding.length === 0) {
    return [];
  }

  try {
    const vendorInfo = await getVendorForOrg(orgId);
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

    return await resolveOrgWikiPagesByVector({
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
  userId: string;
  questionEmbedding: number[];
  asOf?: string | null;
  limit: number;
}): Promise<CompiledMemoryContext['orgKnowledge']> {
  const { orgId, userId, questionEmbedding, asOf, limit } = args;

  if (!questionEmbedding || questionEmbedding.length === 0) {
    return {
      pages: [],
      priorTopics: [],
    };
  }

  let pages: ResolvedOrgWikiPage[] = [];
  try {
    pages = await resolveOrgWikiPagesByVector({
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

  const supabase = createAdminClient();

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
        const clusterPages = await resolveClusterContext({
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
): Promise<Map<string, string>> {
  if (pageIds.length === 0) {
    return new Map();
  }

  try {
    const supabase = createAdminClient();
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
  vendorTrainingPages: ResolvedOrgWikiPage[];
  orgPages: ResolvedOrgWikiPage[];
}): Promise<Record<string, CompiledMemoryCitation>> {
  const { vendorPage, vendorTrainingPages, orgPages } = args;
  const citationsBySourceId: Record<string, CompiledMemoryCitation> = {};

  if (vendorPage) {
    citationsBySourceId[vendorPage.id] = {
      sourceId: vendorPage.id,
      title: `${vendorPage.app} — ${vendorPage.screen}`,
      layer: 'vendor',
      linkUrl: vendorPage.source_url ?? undefined,
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
): Promise<CompiledMemoryContext> {
  const {
    orgId,
    userId,
    app,
    screen,
    questionEmbedding,
    asOf,
    limit = DEFAULT_MATCH_LIMIT,
  } = args;

  const [vendorPage, vendorTrainingPages, orgKnowledge] = await Promise.all([
    resolveVendorWikiPage({ app, screen }),
    resolveVendorTrainingPages({
      orgId,
      app,
      questionEmbedding,
      asOf,
      limit,
    }),
    resolveOrgKnowledge({
      orgId,
      userId,
      questionEmbedding,
      asOf,
      limit,
    }),
  ]);

  const citationsBySourceId = await buildCitationsBySourceId({
    vendorPage,
    vendorTrainingPages,
    orgPages: orgKnowledge.pages,
  });

  return {
    vendorKnowledge: {
      page: vendorPage,
    },
    vendorTraining: {
      pages: vendorTrainingPages,
    },
    orgKnowledge,
    citationsBySourceId,
  };
}
