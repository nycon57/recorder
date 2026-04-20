/**
 * Content fixtures for TRIB-148 demo seed.
 *
 * Reads markdown files from scripts/demo-seed/content/ and composes typed
 * arrays for recordings, wiki pages, imported docs, knowledge gaps, tags, and shares.
 *
 * All IDs are derived deterministically from DEMO_SEED_NAMESPACE.
 * All authored fields map to the TRIB-145 user roster.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import {
  DEMO_USER_IDS,
  DEMO_RECORDING_SLUGS,
  DEMO_RECORDING_IDS,
  DEMO_DOCUMENT_IDS,
  DEMO_SUMMARY_IDS,
  DEMO_TRANSCRIPT_IDS,
  DEMO_WIKI_PAGE_SLUGS,
  DEMO_WIKI_PAGE_IDS,
  DEMO_IMPORTED_DOC_SLUGS,
  DEMO_IMPORTED_DOC_IDS,
  DEMO_KNOWLEDGE_GAP_IDS,
  DEMO_TAG_NAMES,
  DEMO_TAG_IDS,
  DEMO_SHARE_SLUGS,
  DEMO_SHARE_IDS,
  DEMO_CONNECTOR_ID,
} from './fixtures';

// __dirname works in both CJS (Jest transform) and tsx (runtime via ts-node/tsx).
// Do not use import.meta.url here — Jest does not support it in CJS transform mode.
const CONTENT_DIR = path.join(__dirname, 'content');

function readContent(subdir: string, filename: string): string {
  const filePath = path.join(CONTENT_DIR, subdir, filename);
  return fs.readFileSync(filePath, 'utf-8').trim();
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ─── Recording authorship ─────────────────────────────────────────────────────
// Total: 18 Marcus (lead) + 10 Sofía (agent) + 2 Priya (admin) = 30

const RECORDING_AUTHORS: Record<string, string> = {
  'onboarding-zendesk-01': DEMO_USER_IDS.lead,
  'onboarding-zendesk-02': DEMO_USER_IDS.agent,
  'onboarding-zendesk-03': DEMO_USER_IDS.lead,
  'onboarding-zendesk-04': DEMO_USER_IDS.lead,
  'onboarding-zendesk-05': DEMO_USER_IDS.lead,
  'onboarding-zendesk-06': DEMO_USER_IDS.agent,
  'onboarding-zendesk-07': DEMO_USER_IDS.lead,
  'onboarding-zendesk-08': DEMO_USER_IDS.lead,
  'onboarding-zendesk-09': DEMO_USER_IDS.lead,
  'onboarding-zendesk-10': DEMO_USER_IDS.lead,
  'refund-playbook-hubspot-01': DEMO_USER_IDS.lead,
  'refund-playbook-hubspot-02': DEMO_USER_IDS.lead,
  'refund-playbook-hubspot-03': DEMO_USER_IDS.lead,
  'refund-playbook-hubspot-04': DEMO_USER_IDS.lead,
  'refund-playbook-hubspot-05': DEMO_USER_IDS.agent,
  'refund-playbook-hubspot-06': DEMO_USER_IDS.agent,
  'refund-playbook-hubspot-07': DEMO_USER_IDS.lead,
  'refund-playbook-hubspot-08': DEMO_USER_IDS.lead,
  'refund-playbook-hubspot-09': DEMO_USER_IDS.agent,
  'refund-playbook-hubspot-10': DEMO_USER_IDS.lead,
  'integrations-jira-01': DEMO_USER_IDS.agent,
  'integrations-jira-02': DEMO_USER_IDS.lead,
  'integrations-jira-03': DEMO_USER_IDS.lead,
  'integrations-jira-04': DEMO_USER_IDS.agent,
  'integrations-jira-05': DEMO_USER_IDS.agent,
  'integrations-jira-06': DEMO_USER_IDS.lead,
  'integrations-jira-07': DEMO_USER_IDS.agent,
  'integrations-jira-08': DEMO_USER_IDS.admin,
  'integrations-jira-09': DEMO_USER_IDS.admin,
  'integrations-jira-10': DEMO_USER_IDS.agent,
};

// Spread recordings across ~90 days: 2026-01-15 to 2026-04-15
function recordingCreatedAt(idx: number): string {
  const start = new Date('2026-01-15T09:00:00.000Z');
  const daySpread = Math.floor((90 / 30) * idx);
  const date = new Date(start.getTime() + daySpread * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

// Duration varies 180–720 seconds (3–12 min)
const DURATIONS = [
  342, 480, 390, 510, 285, 420, 360, 540, 300, 456,
  480, 390, 330, 510, 270, 420, 360, 600, 315, 720,
  390, 450, 285, 510, 360, 420, 480, 330, 540, 180,
] as const;

export interface RecordingFixture {
  slug: string;
  id: string;
  documentId: string;
  summaryId: string;
  transcriptId: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
  durationSec: number;
  transcriptText: string;
  transcriptHash: string;
  documentMarkdown: string;
  summaryText: string;
  tagNames: string[];
}

function slugToTitle(slug: string): string {
  if (slug.startsWith('onboarding-zendesk-')) {
    const num = slug.split('-').pop()!;
    const titles: Record<string, string> = {
      '01': 'Onboarding: Setting Up a New Tier-1 Agent in Zendesk',
      '02': 'Onboarding: SLA and Business Hours Configuration',
      '03': 'Onboarding: Configuring Agent Views',
      '04': 'Onboarding: Macros for Tier-1 Agents',
      '05': 'Onboarding: Zendesk Ticket Tagging Conventions',
      '06': 'Onboarding: Zendesk Talk Voice Setup',
      '07': 'Onboarding: Ticket Merging Procedures',
      '08': 'Onboarding: End-of-Shift Handoff Procedures',
      '09': 'Onboarding: Using Zendesk Explore for Performance Dashboards',
      '10': 'Onboarding: CSAT Survey Configuration',
    };
    return titles[num] ?? `Zendesk Onboarding ${num}`;
  }
  if (slug.startsWith('refund-playbook-hubspot-')) {
    const num = slug.split('-').pop()!;
    const titles: Record<string, string> = {
      '01': 'Refund Playbook: Partial Refund Flow in HubSpot',
      '02': 'Refund Playbook: Stripe Reconciliation Against HubSpot',
      '03': 'Refund Playbook: Full Refund Approval Process',
      '04': 'Refund Playbook: HubSpot Deal Refund Properties Setup',
      '05': 'Refund Playbook: Goodwill Refund Guidelines',
      '06': 'Refund Playbook: Subscription Cancellation Refunds',
      '07': 'Refund Playbook: Duplicate Charge Refunds',
      '08': 'Refund Playbook: Monthly Refund Report Preparation',
      '09': 'Refund Playbook: Handling Disputes and Chargebacks',
      '10': 'Refund Playbook: Preventing Refunds Through Proactive Billing',
    };
    return titles[num] ?? `Refund Playbook HubSpot ${num}`;
  }
  if (slug.startsWith('integrations-jira-')) {
    const num = slug.split('-').pop()!;
    const titles: Record<string, string> = {
      '01': 'Integrations: Creating a Jira Bug from a Zendesk Escalation',
      '02': 'Integrations: Jira Sprint Handoff and Link Count Priority',
      '03': 'Integrations: Setting Up Jira-Zendesk Integration for New Agents',
      '04': 'Integrations: Jira Triage Labels and Severity Guidelines',
      '05': 'Integrations: Atlassian Rovo Integration for Support Workflows',
      '06': 'Integrations: Weekly Support-Engineering Sync Process',
      '07': 'Integrations: Jira Automations for Customer Status Updates',
      '08': 'Integrations: Integration Health Monitoring',
      '09': 'Integrations: Jira SUP Project Configuration Review',
      '10': 'Integrations: Quarterly Jira Audit Process',
    };
    return titles[num] ?? `Jira Integration ${num}`;
  }
  return slug;
}

function slugToTags(slug: string): string[] {
  if (slug.startsWith('onboarding-zendesk')) return ['onboarding', 'zendesk'];
  if (slug.startsWith('refund-playbook-hubspot')) return ['refund', 'hubspot'];
  if (slug.startsWith('integrations-jira')) return ['integration', 'jira'];
  return [];
}

function makeDocumentMarkdown(title: string, transcript: string): string {
  const paragraphs = transcript.split('\n\n').filter(Boolean);
  const summary = paragraphs[0]?.slice(0, 200) + '...';
  const steps = paragraphs.slice(1, 4).join('\n\n');
  return `# ${title}\n\n## Summary\n\n${summary}\n\n## Details\n\n${steps}\n\n## References\n\n*Generated from recording transcript by demo-seed.*`;
}

export function loadRecordingFixtures(): RecordingFixture[] {
  return DEMO_RECORDING_SLUGS.map((slug, idx) => {
    const filename = `${slug}.md`;
    const transcriptText = readContent('transcripts', filename);
    const title = slugToTitle(slug);
    const documentMarkdown = makeDocumentMarkdown(title, transcriptText);
    const summaryText = transcriptText.split('.')[0] + '.';

    return {
      slug,
      id: DEMO_RECORDING_IDS[slug],
      documentId: DEMO_DOCUMENT_IDS[slug],
      summaryId: DEMO_SUMMARY_IDS[slug],
      transcriptId: DEMO_TRANSCRIPT_IDS[slug],
      title,
      description: `Training recording: ${title}`,
      createdBy: RECORDING_AUTHORS[slug] ?? DEMO_USER_IDS.lead,
      createdAt: recordingCreatedAt(idx),
      durationSec: DURATIONS[idx] ?? 360,
      transcriptText,
      transcriptHash: sha256(transcriptText),
      documentMarkdown,
      summaryText,
      tagNames: slugToTags(slug),
    };
  });
}

// ─── Wiki page fixtures ───────────────────────────────────────────────────────

const WIKI_PAGE_CONFIDENCES: Record<string, number> = {
  'zendesk-onboarding-new-agent': 0.91,
  'zendesk-sla-business-hours': 0.87,
  'zendesk-macros-views-setup': 0.85,
  'zendesk-talk-voice-integration': 0.82,
  'hubspot-partial-refund-playbook': 0.88,
  'hubspot-stripe-reconciliation': 0.86,
  'hubspot-dual-approval-workflow': 0.84,
  'hubspot-deal-refund-properties': 0.72,
  'jira-bug-from-zendesk': 0.89,
  'jira-triage-labels': 0.85,
  'jira-rovo-integration': 0.72,
  'jira-sprint-handoff': 0.55,
};

const WIKI_PAGE_APPS: Record<string, string> = {
  'zendesk-onboarding-new-agent': 'Zendesk',
  'zendesk-sla-business-hours': 'Zendesk',
  'zendesk-macros-views-setup': 'Zendesk',
  'zendesk-talk-voice-integration': 'Zendesk',
  'hubspot-partial-refund-playbook': 'HubSpot',
  'hubspot-stripe-reconciliation': 'HubSpot',
  'hubspot-dual-approval-workflow': 'HubSpot',
  'hubspot-deal-refund-properties': 'HubSpot',
  'jira-bug-from-zendesk': 'Jira',
  'jira-triage-labels': 'Jira',
  'jira-rovo-integration': 'Jira',
  'jira-sprint-handoff': 'Jira',
};

// 8 published (high confidence), 4 unpublished (lower confidence)
const UNPUBLISHED_WIKI_SLUGS = new Set([
  'hubspot-deal-refund-properties',
  'jira-rovo-integration',
  'jira-sprint-handoff',
  'zendesk-talk-voice-integration',
]);

// Contributing recordings per wiki page
const WIKI_SOURCE_RECORDINGS: Record<string, string[]> = {
  'zendesk-onboarding-new-agent': ['onboarding-zendesk-01', 'onboarding-zendesk-04'],
  'zendesk-sla-business-hours': ['onboarding-zendesk-02'],
  'zendesk-macros-views-setup': ['onboarding-zendesk-03', 'onboarding-zendesk-05'],
  'zendesk-talk-voice-integration': ['onboarding-zendesk-06'],
  'hubspot-partial-refund-playbook': ['refund-playbook-hubspot-01', 'refund-playbook-hubspot-04'],
  'hubspot-stripe-reconciliation': ['refund-playbook-hubspot-02'],
  'hubspot-dual-approval-workflow': ['refund-playbook-hubspot-01', 'refund-playbook-hubspot-03'],
  'hubspot-deal-refund-properties': ['refund-playbook-hubspot-04'],
  'jira-bug-from-zendesk': ['integrations-jira-01'],
  'jira-triage-labels': ['integrations-jira-04'],
  'jira-rovo-integration': ['integrations-jira-05'],
  'jira-sprint-handoff': ['integrations-jira-02', 'integrations-jira-06'],
};

export interface WikiPageFixture {
  slug: string;
  id: string;
  app: string;
  topic: string;
  content: string;
  confidence: number;
  isPublished: boolean;
  sourceRecordingIds: string[];
  sourceRecordingSlugs: string[];
}

export function loadWikiPageFixtures(): WikiPageFixture[] {
  return DEMO_WIKI_PAGE_SLUGS.map((slug) => {
    const filename = `${slug}.md`;
    const content = readContent('wiki-pages', filename);
    const lines = content.split('\n');
    const topic = (lines[0] ?? '').replace(/^#\s*/, '').trim();

    const sourceRecordingSlugs = WIKI_SOURCE_RECORDINGS[slug] ?? [];
    const sourceRecordingIds = sourceRecordingSlugs.map(
      (s) => DEMO_RECORDING_IDS[s as keyof typeof DEMO_RECORDING_IDS]
    );

    return {
      slug,
      id: DEMO_WIKI_PAGE_IDS[slug],
      app: WIKI_PAGE_APPS[slug] ?? 'General',
      topic,
      content,
      confidence: WIKI_PAGE_CONFIDENCES[slug] ?? 0.75,
      isPublished: !UNPUBLISHED_WIKI_SLUGS.has(slug),
      sourceRecordingIds,
      sourceRecordingSlugs,
    };
  });
}

// ─── Imported doc fixtures ────────────────────────────────────────────────────

const IMPORTED_DOC_TITLES: Record<string, string> = {
  'zendesk-admin-guide': 'Zendesk Administrator Guide — Acme Support Edition',
  'hubspot-billing-sop': 'HubSpot Billing Standard Operating Procedure',
  'stripe-refund-policy': 'Stripe Refund Policy — Internal Reference',
  'jira-escalation-protocol': 'Jira Escalation Protocol for Support Teams',
  'support-onboarding-checklist': 'Support Agent Onboarding Checklist',
  'quality-assurance-framework': 'Support Quality Assurance Framework',
  'customer-communication-guidelines': 'Customer Communication Guidelines',
  'escalation-matrix': 'Escalation Matrix',
};

const IMPORTED_DOC_FILE_TYPES: Record<string, string> = {
  'zendesk-admin-guide': 'markdown',
  'hubspot-billing-sop': 'markdown',
  'stripe-refund-policy': 'markdown',
  'jira-escalation-protocol': 'markdown',
  'support-onboarding-checklist': 'markdown',
  'quality-assurance-framework': 'markdown',
  'customer-communication-guidelines': 'markdown',
  'escalation-matrix': 'markdown',
};

export interface ImportedDocFixture {
  slug: string;
  id: string;
  externalId: string;
  title: string;
  content: string;
  fileType: string;
  fileSize: number;
  connectorId: string;
}

export function loadImportedDocFixtures(): ImportedDocFixture[] {
  return DEMO_IMPORTED_DOC_SLUGS.map((slug) => {
    const filename = `${slug}.md`;
    const content = readContent('imported-docs', filename);
    return {
      slug,
      id: DEMO_IMPORTED_DOC_IDS[slug],
      externalId: `demo-ext-${slug}`,
      title: IMPORTED_DOC_TITLES[slug] ?? slug,
      content,
      fileType: IMPORTED_DOC_FILE_TYPES[slug] ?? 'markdown',
      fileSize: Buffer.byteLength(content, 'utf-8'),
      connectorId: DEMO_CONNECTOR_ID,
    };
  });
}

// ─── Knowledge gap fixtures ───────────────────────────────────────────────────

export interface KnowledgeGapFixture {
  slug: string;
  id: string;
  topic: string;
  description: string;
  severity: string;
  impactScore: number;
  searchCount: number;
  status: string;
  suggestedAction: string;
}

export const KNOWLEDGE_GAP_FIXTURES: KnowledgeGapFixture[] = [
  {
    slug: 'stripe-webhook-retry-handling',
    id: DEMO_KNOWLEDGE_GAP_IDS['stripe-webhook-retry-handling'],
    topic: 'How to handle Stripe webhook retry failures',
    description:
      'Agents are unclear on what to do when Stripe webhooks fail to deliver to HubSpot. No documented retry or recovery process exists.',
    severity: 'high',
    impactScore: 0.82,
    searchCount: 14,
    status: 'open',
    suggestedAction: 'Record walkthrough of Stripe webhook retry panel and manual backfill process.',
  },
  {
    slug: 'zendesk-csat-survey-setup',
    id: DEMO_KNOWLEDGE_GAP_IDS['zendesk-csat-survey-setup'],
    topic: 'Configuring custom CSAT survey questions in Zendesk',
    description:
      'Standard CSAT configuration is documented but agents ask regularly about customizing survey questions beyond the default rating.',
    severity: 'medium',
    impactScore: 0.54,
    searchCount: 8,
    status: 'in_progress',
    suggestedAction: 'Add CSAT customization section to zendesk-sla-business-hours wiki page.',
  },
  {
    slug: 'hubspot-subscription-cancellation',
    id: DEMO_KNOWLEDGE_GAP_IDS['hubspot-subscription-cancellation'],
    topic: 'Annual subscription cancellation before halfway mark — refund eligibility',
    description:
      'Agents are unsure whether to apply proration or goodwill for annual customers who cancel before 6 months. Policy exists but is not findable via search.',
    severity: 'high',
    impactScore: 0.76,
    searchCount: 11,
    status: 'open',
    suggestedAction: 'Update hubspot-partial-refund-playbook wiki page with annual plan cancellation table.',
  },
  {
    slug: 'jira-automation-triggers',
    id: DEMO_KNOWLEDGE_GAP_IDS['jira-automation-triggers'],
    topic: 'Which Jira automations fire on SUP project status changes',
    description:
      'Agents know status changes trigger Zendesk notifications but do not know the full list of automations or how to verify they fired correctly.',
    severity: 'low',
    impactScore: 0.38,
    searchCount: 5,
    status: 'resolved',
    suggestedAction: 'Add automation inventory table to jira-sprint-handoff wiki page.',
  },
];

// ─── Tag fixtures ─────────────────────────────────────────────────────────────

export interface TagFixture {
  name: string;
  id: string;
  color: string;
  description: string;
}

const TAG_COLORS: Record<string, string> = {
  refund: '#ef4444',
  onboarding: '#3b82f6',
  integration: '#8b5cf6',
  zendesk: '#f59e0b',
  hubspot: '#f97316',
  jira: '#06b6d4',
};

const TAG_DESCRIPTIONS: Record<string, string> = {
  refund: 'Refund-related recordings and procedures',
  onboarding: 'Agent and customer onboarding content',
  integration: 'Third-party integration setup and maintenance',
  zendesk: 'Zendesk platform content',
  hubspot: 'HubSpot CRM content',
  jira: 'Jira / engineering escalation content',
};

export const TAG_FIXTURES: TagFixture[] = DEMO_TAG_NAMES.map((name) => ({
  name,
  id: DEMO_TAG_IDS[name],
  color: TAG_COLORS[name] ?? '#3b82f6',
  description: TAG_DESCRIPTIONS[name] ?? '',
}));

// ─── Share fixtures ───────────────────────────────────────────────────────────

export interface ShareFixture {
  slug: string;
  id: string;
  targetType: string;
  targetId: string;
  shareToken: string;
  createdBy: string;
  expiresAt: string | null;
}

export function buildShareFixtures(): ShareFixture[] {
  const slugMap: Record<string, { targetType: string; targetId: string }> = {
    'share-onboarding-zendesk': {
      targetType: 'wiki_page',
      targetId: DEMO_WIKI_PAGE_IDS['zendesk-onboarding-new-agent'],
    },
    'share-refund-playbook': {
      targetType: 'wiki_page',
      targetId: DEMO_WIKI_PAGE_IDS['hubspot-partial-refund-playbook'],
    },
    'share-jira-integration': {
      targetType: 'wiki_page',
      targetId: DEMO_WIKI_PAGE_IDS['jira-bug-from-zendesk'],
    },
  };

  return DEMO_SHARE_SLUGS.map((slug) => ({
    slug,
    id: DEMO_SHARE_IDS[slug],
    targetType: slugMap[slug]!.targetType,
    targetId: slugMap[slug]!.targetId,
    // Deterministic share token derived from the share ID (truncated base64url-like)
    shareToken: `demo-${DEMO_SHARE_IDS[slug].slice(0, 16)}`,
    createdBy: DEMO_USER_IDS.lead,
    expiresAt: null,
  }));
}

// ─── Zero vector helper ───────────────────────────────────────────────────────

/** Returns a SQL literal for a zero-vector of dimension 1536. */
export const ZERO_VECTOR_1536 = `[${Array(1536).fill(0).join(',')}]`;
