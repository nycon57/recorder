/**
 * Single source of truth for all demo tenant fixtures.
 *
 * Import DEMO_ORG_ID and DEMO_USER_IDS from here in downstream consumers
 * (TRIB-148 content seed, TRIB-151 reset hook).
 *
 * DO NOT modify the ID derivation inputs — they are frozen.
 */

import {
  deriveAccountId,
  deriveDepartmentId,
  deriveMemberId,
  deriveOrgId,
  deriveUserId,
  deriveRecordingId,
  deriveDocumentId,
  deriveSummaryId,
  deriveTranscriptId,
  deriveWikiPageId,
  deriveImportedDocId,
  deriveKnowledgeGapId,
  deriveShareId,
  deriveTagId,
  deriveVendorOrgId,
  deriveWhiteLabelConfigId,
  deriveConnectorId,
} from './ids.js';

// ─── Organization ────────────────────────────────────────────────────────────

// DO NOT ROTATE DEMO_SEED_NAMESPACE — see scripts/demo-seed/ids.ts
export const DEMO_ORG_SLUG = 'acme-support-demo';

export const DEMO_ORG_ID = deriveOrgId(DEMO_ORG_SLUG);

export const DEMO_ORG = {
  id: DEMO_ORG_ID,
  name: 'Acme Support Demo',
  slug: DEMO_ORG_SLUG,
  plan: 'pro' as const,
  billing_email: 'billing@demo.tribora.test',
  metadata: JSON.stringify({ seed: 'demo', generated_by: 'scripts/demo-seed' }),
  created_at: '2026-01-01T00:00:00.000Z',
  onboarded_at: '2026-01-01T00:00:00.000Z',
} as const;

// ─── Departments ─────────────────────────────────────────────────────────────

export const DEMO_DEPARTMENT_SLUGS = {
  executive: 'executive',
  supportOps: 'support-ops',
  support: 'support',
} as const;

export const DEMO_DEPARTMENT_IDS = {
  executive: deriveDepartmentId(DEMO_ORG_ID, DEMO_DEPARTMENT_SLUGS.executive),
  supportOps: deriveDepartmentId(DEMO_ORG_ID, DEMO_DEPARTMENT_SLUGS.supportOps),
  support: deriveDepartmentId(DEMO_ORG_ID, DEMO_DEPARTMENT_SLUGS.support),
} as const;

export const DEMO_DEPARTMENTS = [
  {
    id: DEMO_DEPARTMENT_IDS.executive,
    org_id: DEMO_ORG_ID,
    name: 'Executive',
    slug: DEMO_DEPARTMENT_SLUGS.executive,
    description: 'Executive leadership',
    default_visibility: 'org' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: DEMO_DEPARTMENT_IDS.supportOps,
    org_id: DEMO_ORG_ID,
    name: 'Support Ops',
    slug: DEMO_DEPARTMENT_SLUGS.supportOps,
    description: 'Support operations and quality',
    default_visibility: 'department' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: DEMO_DEPARTMENT_IDS.support,
    org_id: DEMO_ORG_ID,
    name: 'Support',
    slug: DEMO_DEPARTMENT_SLUGS.support,
    description: 'Customer support team',
    default_visibility: 'department' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  },
] as const;

// ─── Users ───────────────────────────────────────────────────────────────────

export interface DemoUser {
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'contributor' | 'reader';
  title: string;
  departmentSlug: keyof typeof DEMO_DEPARTMENT_SLUGS;
  // Derived at build time:
  id: string;
  accountId: string;
  memberId: string;
}

const SEED_CREATED_AT = '2026-01-01T00:00:00.000Z';

function makeUser(
  email: string,
  name: string,
  role: DemoUser['role'],
  title: string,
  departmentSlug: DemoUser['departmentSlug']
): DemoUser {
  const id = deriveUserId(email);
  return {
    email,
    name,
    role,
    title,
    departmentSlug,
    id,
    accountId: deriveAccountId(id),
    memberId: deriveMemberId(DEMO_ORG_ID, id),
  };
}

export const DEMO_USERS: DemoUser[] = [
  makeUser(
    'owner@demo.tribora.test',
    'Dana Okafor',
    'owner',
    'VP Customer Experience',
    'executive'
  ),
  makeUser(
    'admin@demo.tribora.test',
    'Priya Rangan',
    'admin',
    'Head of Support Ops',
    'supportOps'
  ),
  makeUser(
    'lead@demo.tribora.test',
    'Marcus Chen',
    'contributor',
    'Senior Support Engineer',
    'support'
  ),
  makeUser(
    'agent@demo.tribora.test',
    'Sofía Alvarez',
    'contributor',
    'Support Agent',
    'support'
  ),
  makeUser(
    'reader@demo.tribora.test',
    'Jordan Blake',
    'reader',
    'New Hire — Support',
    'support'
  ),
];

// Named exports for convenient downstream imports (TRIB-148, TRIB-151).
export const DEMO_USER_IDS = {
  owner: deriveUserId('owner@demo.tribora.test'),
  admin: deriveUserId('admin@demo.tribora.test'),
  lead: deriveUserId('lead@demo.tribora.test'),
  agent: deriveUserId('agent@demo.tribora.test'),
  reader: deriveUserId('reader@demo.tribora.test'),
} as const;

export { SEED_CREATED_AT };

// ─── TRIB-148: Content IDs ────────────────────────────────────────────────────

export const DEMO_RECORDING_SLUGS = [
  // Onboarding / Zendesk campaign — 10 recordings, Marcus (lead) authors 8, Sofía 2
  'onboarding-zendesk-01',
  'onboarding-zendesk-02',
  'onboarding-zendesk-03',
  'onboarding-zendesk-04',
  'onboarding-zendesk-05',
  'onboarding-zendesk-06',
  'onboarding-zendesk-07',
  'onboarding-zendesk-08',
  'onboarding-zendesk-09',
  'onboarding-zendesk-10',
  // Refund playbook / HubSpot campaign — 10 recordings, Marcus authors 7, Sofía 3
  'refund-playbook-hubspot-01',
  'refund-playbook-hubspot-02',
  'refund-playbook-hubspot-03',
  'refund-playbook-hubspot-04',
  'refund-playbook-hubspot-05',
  'refund-playbook-hubspot-06',
  'refund-playbook-hubspot-07',
  'refund-playbook-hubspot-08',
  'refund-playbook-hubspot-09',
  'refund-playbook-hubspot-10',
  // Integrations / Jira campaign — 10 recordings, Marcus 3, Sofía 5, Priya 2
  'integrations-jira-01',
  'integrations-jira-02',
  'integrations-jira-03',
  'integrations-jira-04',
  'integrations-jira-05',
  'integrations-jira-06',
  'integrations-jira-07',
  'integrations-jira-08',
  'integrations-jira-09',
  'integrations-jira-10',
] as const;

export const DEMO_RECORDING_IDS = Object.fromEntries(
  DEMO_RECORDING_SLUGS.map((s) => [s, deriveRecordingId(s)])
) as Record<(typeof DEMO_RECORDING_SLUGS)[number], string>;

export const DEMO_DOCUMENT_IDS = Object.fromEntries(
  DEMO_RECORDING_SLUGS.map((s) => [s, deriveDocumentId(s)])
) as Record<(typeof DEMO_RECORDING_SLUGS)[number], string>;

export const DEMO_SUMMARY_IDS = Object.fromEntries(
  DEMO_RECORDING_SLUGS.map((s) => [s, deriveSummaryId(s)])
) as Record<(typeof DEMO_RECORDING_SLUGS)[number], string>;

export const DEMO_TRANSCRIPT_IDS = Object.fromEntries(
  DEMO_RECORDING_SLUGS.map((s) => [s, deriveTranscriptId(s)])
) as Record<(typeof DEMO_RECORDING_SLUGS)[number], string>;

// ─── Wiki page IDs ────────────────────────────────────────────────────────────

export const DEMO_WIKI_PAGE_SLUGS = [
  'zendesk-onboarding-new-agent',
  'zendesk-sla-business-hours',
  'zendesk-macros-views-setup',
  'zendesk-talk-voice-integration',
  'hubspot-partial-refund-playbook',
  'hubspot-stripe-reconciliation',
  'hubspot-dual-approval-workflow',
  'hubspot-deal-refund-properties',
  'jira-bug-from-zendesk',
  'jira-triage-labels',
  'jira-rovo-integration',
  'jira-sprint-handoff',
] as const;

export const DEMO_WIKI_PAGE_IDS = Object.fromEntries(
  DEMO_WIKI_PAGE_SLUGS.map((s) => [s, deriveWikiPageId(s)])
) as Record<(typeof DEMO_WIKI_PAGE_SLUGS)[number], string>;

// ─── Imported doc IDs ─────────────────────────────────────────────────────────

export const DEMO_IMPORTED_DOC_SLUGS = [
  'zendesk-admin-guide',
  'hubspot-billing-sop',
  'stripe-refund-policy',
  'jira-escalation-protocol',
  'support-onboarding-checklist',
  'quality-assurance-framework',
  'customer-communication-guidelines',
  'escalation-matrix',
] as const;

export const DEMO_IMPORTED_DOC_IDS = Object.fromEntries(
  DEMO_IMPORTED_DOC_SLUGS.map((s) => [s, deriveImportedDocId(s)])
) as Record<(typeof DEMO_IMPORTED_DOC_SLUGS)[number], string>;

// ─── Knowledge gap IDs ────────────────────────────────────────────────────────

export const DEMO_KNOWLEDGE_GAP_SLUGS = [
  'stripe-webhook-retry-handling',
  'zendesk-csat-survey-setup',
  'hubspot-subscription-cancellation',
  'jira-automation-triggers',
] as const;

export const DEMO_KNOWLEDGE_GAP_IDS = Object.fromEntries(
  DEMO_KNOWLEDGE_GAP_SLUGS.map((s) => [s, deriveKnowledgeGapId(s)])
) as Record<(typeof DEMO_KNOWLEDGE_GAP_SLUGS)[number], string>;

// ─── Tag IDs ──────────────────────────────────────────────────────────────────

export const DEMO_TAG_NAMES = ['refund', 'onboarding', 'integration', 'zendesk', 'hubspot', 'jira'] as const;

export const DEMO_TAG_IDS = Object.fromEntries(
  DEMO_TAG_NAMES.map((n) => [n, deriveTagId(DEMO_ORG_ID, n)])
) as Record<(typeof DEMO_TAG_NAMES)[number], string>;

// ─── Share IDs ────────────────────────────────────────────────────────────────

export const DEMO_SHARE_SLUGS = [
  'share-onboarding-zendesk',
  'share-refund-playbook',
  'share-jira-integration',
] as const;

export const DEMO_SHARE_IDS = Object.fromEntries(
  DEMO_SHARE_SLUGS.map((s) => [s, deriveShareId(s)])
) as Record<(typeof DEMO_SHARE_SLUGS)[number], string>;

// ─── Vendor org ───────────────────────────────────────────────────────────────

export const DEMO_VENDOR_ORG_ID = deriveVendorOrgId();
export const DEMO_WHITE_LABEL_CONFIG_ID = deriveWhiteLabelConfigId(DEMO_VENDOR_ORG_ID);

// ─── Connector (for imported_documents FK) ────────────────────────────────────

export const DEMO_CONNECTOR_ID = deriveConnectorId(DEMO_ORG_ID, 'zendesk');
