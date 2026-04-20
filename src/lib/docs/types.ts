export type Audience = 'public' | 'org-admin' | 'system-admin';

export type DocsSource = 'git' | 'db';

export type SectionId =
  | 'getting-started'
  | 'product'
  | 'integrations'
  | 'reference'
  | 'policies'
  | 'knowledge-ops'
  | 'org-admin'
  | 'observability'
  | 'platform-runbooks'
  | 'vendor-sources'
  | 'system-admin'
  | 'security';

export interface DocsPage {
  /** No leading slash. Pattern: `^[a-z0-9][a-z0-9/-]*$`. */
  slug: string;
  title: string;
  /** Used in section index and `<meta name="description">`. */
  description: string;
  /** Minimum audience required to view this page. */
  audience: Audience;
  section: SectionId;
  /** Optional sub-grouping for nav nesting within a section. */
  group?: string;
  /** Sort order within section/group. Default 1000. */
  order?: number;
  /** ISO YYYY-MM-DD. Set by compiler from git log or DB `updated_at`. */
  updatedAt: string;
  /** Related page slugs. Cross-audience rules enforced by registry at build time. */
  related?: string[];
  tags?: string[];
  /** Hidden from nav; direct URL still works subject to `canView`. */
  unlisted?: boolean;
  /** Excluded from registry entirely. */
  draft?: boolean;
  /** Set by the loader, not authored. */
  source: DocsSource;
  /** Set by the loader. Used by search indexer (TRIB-155). */
  contentHash: string;
}

export interface DocsSection {
  id: SectionId;
  title: string;
  /** Minimum audience required to see this section. */
  audience: Audience;
  /** Sort order in the nav. */
  order: number;
  description?: string;
}

export interface DocsAudienceContext {
  audience: Audience;
  userId?: string;
  orgId?: string;
  isSystemAdmin: boolean;
  role?: 'owner' | 'admin' | 'contributor' | 'reader';
}

export interface DocsNavTree {
  sections: Array<{
    section: DocsSection;
    groups: Array<{ group?: string; pages: DocsPage[] }>;
  }>;
}

export interface DocsRegistry {
  /** All non-draft pages keyed by slug. */
  pages: ReadonlyMap<string, DocsPage>;
  /** Static section list. */
  sections: ReadonlyArray<DocsSection>;
  /** Look up a single page by slug (undefined if not in registry). */
  findPage(slug: string): DocsPage | undefined;
  /** All pages visible to `audience`. */
  pagesForAudience(audience: Audience): DocsPage[];
  /** Sections visible to `audience`, sorted by order. */
  sectionsForAudience(audience: Audience): DocsSection[];
  /** Full nav tree filtered for `audience`. */
  buildNavigation(audience: Audience): DocsNavTree;
  /** Related pages for `slug` that are visible to `audience`. */
  relatedFor(slug: string, audience: Audience): DocsPage[];
  /** True when `audience` may view `page`. */
  canView(page: DocsPage, audience: Audience): boolean;
}
