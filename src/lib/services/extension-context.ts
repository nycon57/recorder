import { createClient as createAdminClient } from '@/lib/supabase/admin';
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

function toKnowledgeMatch(
  candidate: KnowledgeMatchCandidate | null,
): KnowledgeMatch | null {
  if (!candidate) return null;

  return {
    matched: true,
    basis: candidate.basis,
    confidence: candidate.confidence,
    app: candidate.app,
    screen: candidate.screen,
    label: candidate.label,
    pageIds: candidate.pageIds,
    selectorHints: candidate.selectorHints,
  };
}

async function fetchVendorMatchCandidates(
  supabase: SupabaseClient,
  app: string,
  screen: string,
  url: string,
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

  const rows = data ?? [];
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

  const rows = data ?? [];
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
  const vendorMatch = chooseKnowledgeMatch(
    await fetchVendorMatchCandidates(
      supabase,
      args.app.toLowerCase(),
      args.screen.toLowerCase(),
      args.url,
    ),
  );
  const orgMatch = chooseKnowledgeMatch(
    await fetchOrgMatchCandidates(
      supabase,
      args.orgId,
      args.app.toLowerCase(),
      args.screen.toLowerCase(),
      args.url,
    ),
  );

  return {
    vendorKnowledgeMatch: toKnowledgeMatch(vendorMatch),
    orgKnowledgeMatch: toKnowledgeMatch(orgMatch),
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
