import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import { resolveOrgWikiPagesByVector } from '@/lib/services/org-wiki-embedding';
import { resolveVendorCorpusPages } from '@/lib/services/vendor-doc-corpus';
import type {
  KnowledgeAvailability,
  KnowledgeMatch,
  KnowledgeMatchBasis,
} from '@tribora/shared';

type SupabaseClient = ReturnType<typeof createAdminClient>;

interface VendorRow {
  id: string;
  app: string;
  screen: string;
  element_selectors: unknown;
}

interface OrgRow {
  id: string;
  app: string | null;
  screen: string | null;
  topic: string;
}

type RankableKnowledgeRow = {
  id: string;
  screen?: string | null;
  topic?: string | null;
  element_selectors?: unknown;
  vectorScore?: number | null;
};

type PageRelevanceVectorContext = {
  question: string;
  questionEmbedding: number[];
};

export interface KnowledgeMatchCandidate {
  pageIds: string[];
  basis: Exclude<KnowledgeMatchBasis, 'none'>;
  confidence: number;
  app: string | null;
  screen: string | null;
  label: string;
  selectorHints: string[];
}

export interface ResolveExtensionContextMatchesArgs {
  orgId: string;
  app: string;
  screen: string;
  url: string;
}

export interface ResolveExtensionContextMatchesResult {
  vendorKnowledgeMatch: KnowledgeMatch | null;
  orgKnowledgeMatch: KnowledgeMatch | null;
  knowledgeAvailability: KnowledgeAvailability;
  relevantWikiPages: string[];
}

const BASIS_WEIGHT: Record<Exclude<KnowledgeMatchBasis, 'none'>, number> = {
  exact: 4,
  screen_alias: 3,
  app_only: 2,
  domain_alias: 1,
};

const MIN_VECTOR_SEARCH_LIMIT = 10;
const MAX_VECTOR_SEARCH_LIMIT = 50;

const KNOWN_DOMAIN_ALIASES: Array<{ app: string; hostPattern: RegExp }> = [
  { app: 'salesforce', hostPattern: /(?:^|\.)salesforce\.com$/i },
  { app: 'salesforce', hostPattern: /(?:^|\.)force\.com$/i },
  { app: 'hubspot', hostPattern: /(?:^|\.)hubspot\.com$/i },
  { app: 'jira', hostPattern: /(?:^|\.)atlassian\.net$/i },
  { app: 'zendesk', hostPattern: /(?:^|\.)zendesk\.com$/i },
  { app: 'notion', hostPattern: /(?:^|\.)notion\.(?:so|site)$/i },
  { app: 'supabase', hostPattern: /(?:^|\.)supabase\.com$/i },
];

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim().toLowerCase()).filter(Boolean)),
  ) as string[];
}

function extractDomainAppAlias(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      KNOWN_DOMAIN_ALIASES.find(({ hostPattern }) => hostPattern.test(hostname))
        ?.app ?? null
    );
  } catch {
    return null;
  }
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function buildScreenAliases(screen: string): string[] {
  const normalized = screen.trim().toLowerCase();
  if (!normalized) return [];

  const segments = normalized.split('-').filter(Boolean);
  const aliases = [
    normalized,
    segments[segments.length - 1],
    segments[0],
    segments.slice(-2).join('-'),
  ];

  return uniqueStrings(aliases);
}

function extractSelectorHints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value.map((entry) => (typeof entry === 'string' ? entry : null)),
  );
}

function tokenizeForRanking(value: string | null | undefined): string[] {
  return uniqueStrings(
    (value ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length >= 2),
  );
}

function extractUrlRankingTokens(url: string): string[] {
  try {
    const parsed = new URL(url);
    return tokenizeForRanking(
      [parsed.hostname, parsed.pathname.replace(/\d+/g, '')].join(' '),
    );
  } catch {
    return [];
  }
}

function buildPageRelevanceQuery(args: {
  app: string;
  screen: string;
  url: string;
}): string {
  const urlTokens = extractUrlRankingTokens(args.url).join(' ');
  return uniqueStrings([args.app, args.screen, urlTokens]).join(' ');
}

function normalizeVectorScore(score: number | null | undefined): number {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 0;
  if (score <= 0) return 0;
  if (score >= 1) return 1;
  return score;
}

function vectorSearchLimit(pageCount: number): number {
  return Math.min(
    Math.max(pageCount, MIN_VECTOR_SEARCH_LIMIT),
    MAX_VECTOR_SEARCH_LIMIT,
  );
}

function logVectorFallback(message: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.warn(message, { errorMessage });
}

async function generatePageRelevanceEmbedding(
  input: string,
): Promise<number[] | null> {
  try {
    const { embedding } = await generateEmbeddingWithFallback(
      input,
      'RETRIEVAL_QUERY',
    );
    return embedding;
  } catch (error) {
    logVectorFallback(
      '[extension-context] page relevance embedding failed, falling back to lexical ranking:',
      error,
    );
    return null;
  }
}

async function buildPageRelevanceVectorContext(args: {
  app: string;
  screen: string;
  url: string;
}): Promise<PageRelevanceVectorContext | null> {
  const question = buildPageRelevanceQuery(args);
  if (!question) return null;

  const questionEmbedding = await generatePageRelevanceEmbedding(question);
  if (!questionEmbedding) return null;

  return { question, questionEmbedding };
}

async function resolveVendorPageVectorScores(args: {
  app: string;
  screen: string;
  url: string;
  pageIds: string[];
  vectorContext: PageRelevanceVectorContext | null;
}): Promise<Map<string, number>> {
  if (args.pageIds.length === 0) return new Map();

  if (!args.vectorContext) return new Map();

  try {
    const matches = await resolveVendorCorpusPages({
      app: args.app,
      screen: args.screen,
      question: args.vectorContext.question,
      questionEmbedding: args.vectorContext.questionEmbedding,
      limit: vectorSearchLimit(args.pageIds.length),
    });
    const allowedPageIds = new Set(args.pageIds);
    const scores = new Map<string, number>();

    for (const match of matches) {
      const confidence =
        typeof match.confidence === 'number' &&
        Number.isFinite(match.confidence)
          ? match.confidence
          : null;
      if (
        !match.vendorPageId ||
        !allowedPageIds.has(match.vendorPageId) ||
        confidence === null
      ) {
        continue;
      }
      const current = scores.get(match.vendorPageId) ?? 0;
      scores.set(match.vendorPageId, Math.max(current, confidence));
    }

    return scores;
  } catch (error) {
    logVectorFallback(
      '[extension-context] vendor page vector ranking failed, falling back to lexical ranking:',
      error,
    );
    return new Map();
  }
}

async function resolveOrgPageVectorScores(args: {
  orgId: string;
  app: string;
  screen: string;
  url: string;
  pageIds: string[];
  vectorContext: PageRelevanceVectorContext | null;
}): Promise<Map<string, number>> {
  if (args.pageIds.length === 0) return new Map();

  if (!args.vectorContext) return new Map();

  try {
    const matches = await resolveOrgWikiPagesByVector({
      orgId: args.orgId,
      questionEmbedding: args.vectorContext.questionEmbedding,
      limit: vectorSearchLimit(args.pageIds.length),
    });
    const allowedPageIds = new Set(args.pageIds);
    const scores = new Map<string, number>();

    for (const match of matches) {
      const confidence =
        typeof match.confidence === 'number' &&
        Number.isFinite(match.confidence)
          ? match.confidence
          : null;
      if (!allowedPageIds.has(match.id) || confidence === null) continue;
      const current = scores.get(match.id) ?? 0;
      scores.set(match.id, Math.max(current, confidence));
    }

    return scores;
  } catch (error) {
    logVectorFallback(
      '[extension-context] org page vector ranking failed, falling back to lexical ranking:',
      error,
    );
    return new Map();
  }
}

function applyVectorScores<T extends RankableKnowledgeRow>(
  rows: T[],
  scores: Map<string, number>,
): T[] {
  if (scores.size === 0) return rows;
  return rows.map((row) => ({
    ...row,
    vectorScore: scores.get(row.id) ?? row.vectorScore ?? null,
  }));
}

export function rankKnowledgeRowsByPageRelevance<
  T extends RankableKnowledgeRow,
>(
  rows: T[],
  args: {
    screen: string;
    url: string;
  },
): T[] {
  const screenTokens = new Set([
    ...tokenizeForRanking(args.screen),
    ...buildScreenAliases(args.screen).flatMap(tokenizeForRanking),
  ]);
  const urlTokens = new Set(extractUrlRankingTokens(args.url));
  const pageTokens = new Set([...screenTokens, ...urlTokens]);

  const scoreRow = (row: T): number => {
    const selectorHints = extractSelectorHints(row.element_selectors);
    const rowTokens = tokenizeForRanking(
      [row.screen, row.topic, selectorHints.join(' ')]
        .filter(Boolean)
        .join(' '),
    );
    const rowTokenSet = new Set(rowTokens);
    const overlap = [...pageTokens].filter((token) =>
      rowTokenSet.has(token),
    ).length;
    const screenOverlap = [...screenTokens].filter((token) =>
      rowTokenSet.has(token),
    ).length;
    const urlOverlap = [...urlTokens].filter((token) =>
      rowTokenSet.has(token),
    ).length;
    const normalizedScreen = row.screen?.trim().toLowerCase() ?? '';
    const exactScreenBoost =
      normalizedScreen && normalizedScreen === args.screen.toLowerCase()
        ? 12
        : 0;
    const vectorBoost = normalizeVectorScore(row.vectorScore) * 12;

    return (
      exactScreenBoost +
      vectorBoost +
      screenOverlap * 5 +
      urlOverlap * 2 +
      overlap
    );
  };

  return rows
    .map((row) => ({ row, score: scoreRow(row) }))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;

      const leftLabel =
        `${left.row.screen ?? ''} ${left.row.topic ?? ''}`.trim();
      const rightLabel =
        `${right.row.screen ?? ''} ${right.row.topic ?? ''}`.trim();
      const labelDelta = leftLabel.localeCompare(rightLabel);
      if (labelDelta !== 0) return labelDelta;

      return left.row.id.localeCompare(right.row.id);
    })
    .map(({ row }) => row);
}

type KnowledgeMatchSurface = 'vendor' | 'org';

type KnowledgeMatchExplainability = Pick<
  KnowledgeMatch,
  'basisCategory' | 'basisLabel' | 'basisExplanation'
>;

export function buildKnowledgeMatchExplainability(args: {
  surface: KnowledgeMatchSurface;
  basis: Exclude<KnowledgeMatchBasis, 'none'>;
  url: string;
  requestedApp: string;
  requestedScreen: string;
  matchedApp: string | null;
  matchedScreen: string | null;
  matchedLabel?: string | null;
}): KnowledgeMatchExplainability {
  const {
    surface,
    basis,
    url,
    requestedApp,
    requestedScreen,
    matchedApp,
    matchedScreen,
    matchedLabel,
  } = args;

  const subject =
    surface === 'vendor' ? 'the vendor baseline' : 'the org overlay';
  const normalizedLabel = matchedLabel?.trim() || null;
  const label = normalizedLabel || matchedScreen || matchedApp || 'this page';
  const requestedAppLabel = requestedApp || 'unknown';
  const requestedScreenLabel = requestedScreen || 'unknown';
  const hasMatchedContext = Boolean(matchedApp || matchedScreen);

  switch (basis) {
    case 'exact':
      return {
        basisCategory: 'exact',
        basisLabel: 'Exact match',
        basisExplanation: hasMatchedContext
          ? `Matched ${subject} because the detected app "${requestedAppLabel}" and screen "${requestedScreenLabel}" exactly matched "${label}".`
          : `Matched ${subject} because the detected context exactly matched the saved knowledge label "${label}".`,
      };
    case 'screen_alias':
      return {
        basisCategory: 'alias',
        basisLabel: 'Alias match',
        basisExplanation: `Matched ${subject} by screen alias because the detected screen "${requestedScreenLabel}" was routed to "${matchedScreen ?? label}" inside "${matchedApp ?? requestedAppLabel}".`,
      };
    case 'app_only':
      return {
        basisCategory: 'app',
        basisLabel: 'App-level match',
        basisExplanation: `Matched ${subject} at the app level because "${matchedApp ?? requestedAppLabel}" was recognized, but there was no exact screen baseline for "${requestedScreenLabel}".`,
      };
    case 'domain_alias': {
      const hostname = extractHostname(url) ?? 'unknown host';
      return {
        basisCategory: 'domain',
        basisLabel: 'Domain match',
        basisExplanation: `Matched ${subject} by domain because the detected host "${hostname}" maps to "${matchedApp ?? requestedAppLabel}", so Tribora mapped the page into that app's knowledge family.`,
      };
    }
  }
}

export function chooseKnowledgeMatch(
  candidates: KnowledgeMatchCandidate[],
): KnowledgeMatchCandidate | null {
  if (candidates.length === 0) return null;

  return [...candidates].sort((left, right) => {
    const basisDelta = BASIS_WEIGHT[right.basis] - BASIS_WEIGHT[left.basis];
    if (basisDelta !== 0) return basisDelta;

    const confidenceDelta = right.confidence - left.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;

    return right.pageIds.length - left.pageIds.length;
  })[0];
}

export function summarizeKnowledgeAvailability(
  vendorMatch: KnowledgeMatchCandidate | null,
  orgMatch: KnowledgeMatchCandidate | null,
): KnowledgeAvailability {
  if (orgMatch) {
    return {
      hasVendorDocs: vendorMatch !== null,
      hasOrgKnowledge: true,
      mode: 'org_backed',
      message:
        vendorMatch !== null
          ? 'Vendor documentation and team-specific guidance are available for this page.'
          : 'Team-specific guidance is available for this page.',
    };
  }

  if (vendorMatch) {
    return {
      hasVendorDocs: true,
      hasOrgKnowledge: false,
      mode: 'vendor_backed',
      message: 'Vendor documentation is available for this page.',
    };
  }

  return {
    hasVendorDocs: false,
    hasOrgKnowledge: false,
    mode: 'dom_only',
    message:
      'No matched vendor or team-specific knowledge was found for this page. Answer from the visible page structure and state the limits clearly.',
  };
}

function toKnowledgeMatch(args: {
  candidate: KnowledgeMatchCandidate | null;
  surface: KnowledgeMatchSurface;
  requestedApp: string;
  requestedScreen: string;
  url: string;
}): KnowledgeMatch | null {
  const { candidate, surface, requestedApp, requestedScreen, url } = args;
  if (!candidate) return null;

  const explainability = buildKnowledgeMatchExplainability({
    surface,
    basis: candidate.basis,
    url,
    requestedApp,
    requestedScreen,
    matchedApp: candidate.app,
    matchedScreen: candidate.screen,
    matchedLabel: candidate.label,
  });

  return {
    matched: true,
    basis: candidate.basis,
    confidence: candidate.confidence,
    app: candidate.app,
    screen: candidate.screen,
    label: candidate.label,
    pageIds: candidate.pageIds,
    selectorHints: candidate.selectorHints,
    ...explainability,
  };
}

async function fetchVendorMatchCandidates(
  supabase: SupabaseClient,
  app: string,
  screen: string,
  url: string,
  vectorContext: PageRelevanceVectorContext | null,
): Promise<KnowledgeMatchCandidate[]> {
  const domainAlias = extractDomainAppAlias(url);
  const appCandidates = uniqueStrings([
    app !== 'unknown' ? app : null,
    domainAlias,
  ]);

  if (appCandidates.length === 0) return [];

  const screenAliases = buildScreenAliases(screen);
  const exactApp = appCandidates[0] ?? domainAlias ?? 'unknown';

  const { data, error } = (await supabase
    .from('vendor_wiki_pages')
    .select('id, app, screen, element_selectors')
    .in('app', appCandidates)
    .order('updated_at', { ascending: false })) as {
    data: VendorRow[] | null;
    error: unknown;
  };

  if (error) {
    console.error('[extension-context] vendor candidate lookup failed:', error);
    return [];
  }

  const vectorScores = await resolveVendorPageVectorScores({
    app: exactApp,
    screen,
    url,
    pageIds: (data ?? []).map((row) => row.id),
    vectorContext,
  });
  const rows = rankKnowledgeRowsByPageRelevance(
    applyVectorScores(data ?? [], vectorScores),
    {
      screen,
      url,
    },
  );
  const exactRows = rows.filter(
    (row) => row.app === exactApp && row.screen === screen.toLowerCase(),
  );
  if (exactRows.length > 0) {
    return [
      {
        pageIds: exactRows.map((row) => row.id),
        basis: 'exact',
        confidence: 0.95,
        app: exactRows[0]?.app ?? exactApp,
        screen: exactRows[0]?.screen ?? screen,
        label: `${exactRows[0]?.app ?? exactApp} — ${exactRows[0]?.screen ?? screen}`,
        selectorHints: uniqueStrings(
          exactRows.flatMap((row) =>
            extractSelectorHints(row.element_selectors),
          ),
        ),
      },
    ];
  }

  const aliasRows = rows.filter(
    (row) =>
      row.app === exactApp &&
      screenAliases.includes((row.screen ?? '').toLowerCase()),
  );
  const candidates: KnowledgeMatchCandidate[] = [];

  if (aliasRows.length > 0) {
    candidates.push({
      pageIds: aliasRows.map((row) => row.id),
      basis: 'screen_alias',
      confidence: 0.74,
      app: aliasRows[0]?.app ?? exactApp,
      screen: aliasRows[0]?.screen ?? null,
      label: `${aliasRows[0]?.app ?? exactApp} — ${aliasRows[0]?.screen ?? 'screen'}`,
      selectorHints: uniqueStrings(
        aliasRows.flatMap((row) => extractSelectorHints(row.element_selectors)),
      ),
    });
  }

  const appOnlyRows = rows.filter((row) => row.app === exactApp);
  if (appOnlyRows.length > 0) {
    candidates.push({
      pageIds: appOnlyRows.map((row) => row.id),
      basis:
        app === 'unknown' && domainAlias === exactApp
          ? 'domain_alias'
          : 'app_only',
      confidence: app === 'unknown' && domainAlias === exactApp ? 0.48 : 0.58,
      app: appOnlyRows[0]?.app ?? exactApp,
      screen: null,
      label: appOnlyRows[0]?.app ?? exactApp,
      selectorHints: uniqueStrings(
        appOnlyRows.flatMap((row) =>
          extractSelectorHints(row.element_selectors),
        ),
      ),
    });
  }

  return candidates;
}

async function fetchOrgMatchCandidates(
  supabase: SupabaseClient,
  orgId: string,
  app: string,
  screen: string,
  url: string,
  vectorContext: PageRelevanceVectorContext | null,
): Promise<KnowledgeMatchCandidate[]> {
  const domainAlias = extractDomainAppAlias(url);
  const appCandidates = uniqueStrings([
    app !== 'unknown' ? app : null,
    domainAlias,
  ]);

  if (appCandidates.length === 0) return [];

  const screenAliases = buildScreenAliases(screen);
  const exactApp = appCandidates[0] ?? domainAlias ?? 'unknown';

  const { data, error } = (await supabase
    .from('org_wiki_pages')
    .select('id, app, screen, topic')
    .eq('org_id', orgId)
    .is('valid_until', null)
    .in('app', appCandidates)
    .order('updated_at', { ascending: false })) as {
    data: OrgRow[] | null;
    error: unknown;
  };

  if (error) {
    console.error('[extension-context] org candidate lookup failed:', error);
    return [];
  }

  const vectorScores = await resolveOrgPageVectorScores({
    orgId,
    app: exactApp,
    screen,
    url,
    pageIds: (data ?? []).map((row) => row.id),
    vectorContext,
  });
  const rows = rankKnowledgeRowsByPageRelevance(
    applyVectorScores(data ?? [], vectorScores),
    {
      screen,
      url,
    },
  );
  const exactRows = rows.filter(
    (row) => row.app === exactApp && row.screen === screen.toLowerCase(),
  );
  if (exactRows.length > 0) {
    return [
      {
        pageIds: exactRows.map((row) => row.id),
        basis: 'exact',
        confidence: 0.91,
        app: exactRows[0]?.app ?? exactApp,
        screen: exactRows[0]?.screen ?? screen,
        label: exactRows[0]?.topic ?? `${exactApp} — ${screen}`,
        selectorHints: [],
      },
    ];
  }

  const aliasRows = rows.filter(
    (row) =>
      row.app === exactApp &&
      row.screen &&
      screenAliases.includes(row.screen.toLowerCase()),
  );

  const candidates: KnowledgeMatchCandidate[] = [];
  if (aliasRows.length > 0) {
    candidates.push({
      pageIds: aliasRows.map((row) => row.id),
      basis: 'screen_alias',
      confidence: 0.7,
      app: aliasRows[0]?.app ?? exactApp,
      screen: aliasRows[0]?.screen ?? null,
      label: aliasRows[0]?.topic ?? `${exactApp} guidance`,
      selectorHints: [],
    });
  }

  const appOnlyRows = rows.filter((row) => row.app === exactApp);
  if (appOnlyRows.length > 0) {
    candidates.push({
      pageIds: appOnlyRows.map((row) => row.id),
      basis:
        app === 'unknown' && domainAlias === exactApp
          ? 'domain_alias'
          : 'app_only',
      confidence: app === 'unknown' && domainAlias === exactApp ? 0.46 : 0.63,
      app: appOnlyRows[0]?.app ?? exactApp,
      screen: null,
      label: appOnlyRows[0]?.topic ?? `${exactApp} guidance`,
      selectorHints: [],
    });
  }

  return candidates;
}

export async function resolveExtensionContextMatches(
  args: ResolveExtensionContextMatchesArgs,
): Promise<ResolveExtensionContextMatchesResult> {
  const supabase = createAdminClient();
  const normalizedApp = args.app.toLowerCase();
  const normalizedScreen = args.screen.toLowerCase();
  const domainAlias = extractDomainAppAlias(args.url);
  const effectiveApp =
    normalizedApp !== 'unknown' ? normalizedApp : (domainAlias ?? normalizedApp);
  const vectorContext =
    effectiveApp === 'unknown'
      ? null
      : await buildPageRelevanceVectorContext({
          app: effectiveApp,
          screen: normalizedScreen,
          url: args.url,
        });
  const [vendorCandidates, orgCandidates] = await Promise.all([
    fetchVendorMatchCandidates(
      supabase,
      normalizedApp,
      normalizedScreen,
      args.url,
      vectorContext,
    ),
    fetchOrgMatchCandidates(
      supabase,
      args.orgId,
      normalizedApp,
      normalizedScreen,
      args.url,
      vectorContext,
    ),
  ]);
  const vendorMatch = chooseKnowledgeMatch(vendorCandidates);
  const orgMatch = chooseKnowledgeMatch(orgCandidates);

  return {
    vendorKnowledgeMatch: toKnowledgeMatch({
      candidate: vendorMatch,
      surface: 'vendor',
      requestedApp: args.app,
      requestedScreen: args.screen,
      url: args.url,
    }),
    orgKnowledgeMatch: toKnowledgeMatch({
      candidate: orgMatch,
      surface: 'org',
      requestedApp: args.app,
      requestedScreen: args.screen,
      url: args.url,
    }),
    knowledgeAvailability: summarizeKnowledgeAvailability(
      vendorMatch,
      orgMatch,
    ),
    relevantWikiPages: uniqueStrings([
      ...(vendorMatch?.pageIds ?? []),
      ...(orgMatch?.pageIds ?? []),
    ]),
  };
}
