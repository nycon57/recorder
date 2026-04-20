import type { DocsSection } from './types';

/**
 * Static section registry.
 * Frozen at module-evaluation time — mutating callers get a runtime TypeError.
 * Sections are ordered by `order` ascending; nav builders should sort on this field.
 */
export const SECTIONS: ReadonlyArray<DocsSection> = Object.freeze([
  // ── Public sections ────────────────────────────────────────────────────────
  {
    id: 'getting-started',
    title: 'Getting started',
    audience: 'public',
    order: 10,
    description: 'Install, first recording, and what Tribora is.',
  },
  {
    id: 'product',
    title: 'Product guide',
    audience: 'public',
    order: 20,
    description: 'Feature walkthroughs for day-to-day users.',
  },
  {
    id: 'integrations',
    title: 'Integrations',
    audience: 'public',
    order: 30,
    description: 'Extension, SDK widget, embeddable recorder, white-label.',
  },
  {
    id: 'reference',
    title: 'Reference',
    audience: 'public',
    order: 40,
    description: 'Public API, webhook payloads, data model summaries.',
  },
  {
    id: 'policies',
    title: 'Policies',
    audience: 'public',
    order: 50,
    description: 'Security, privacy, and compliance posture.',
  },

  // ── Org admin sections ─────────────────────────────────────────────────────
  {
    id: 'knowledge-ops',
    title: 'Knowledge operations',
    audience: 'org-admin',
    order: 60,
    description: 'Wiki review, contradictions, digest config, onboarding plans.',
  },
  {
    id: 'org-admin',
    title: 'Organization administration',
    audience: 'org-admin',
    order: 70,
    description: 'Members, roles, departments, SSO, billing, quotas, white-label.',
  },
  {
    id: 'observability',
    title: 'Observability',
    audience: 'org-admin',
    order: 80,
    description: 'Org-scoped analytics, storage, and cost dashboards.',
  },

  // ── System admin sections ──────────────────────────────────────────────────
  {
    id: 'platform-runbooks',
    title: 'Platform runbooks',
    audience: 'system-admin',
    order: 90,
    description: 'Deploys, worker ops, job queue.',
  },
  {
    id: 'vendor-sources',
    title: 'Vendor source runbooks',
    audience: 'system-admin',
    order: 100,
    description: 'Ingest playbooks, vendor corpus management.',
  },
  {
    id: 'system-admin',
    title: 'System administration',
    audience: 'system-admin',
    order: 110,
    description:
      'Flags, cost management, global quotas, storage health, debug. Mirrors src/app/(dashboard)/admin/**.',
  },
  {
    id: 'security',
    title: 'Security operations',
    audience: 'system-admin',
    order: 120,
    description: 'Incident response, abuse, log access.',
  },
] satisfies DocsSection[]);
