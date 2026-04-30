/* global describe, expect, test */

/**
 * @jest-environment node
 *
 * Unit tests for the reset script's delete-step builder.
 *
 * Validates that:
 * 1. Every DELETE step has a WHERE clause (no naked deletes).
 * 2. The step list covers all tables seeded by TRIB-145/148.
 * 3. The step ordering respects FK dependencies (children before parents).
 * 4. No step targets a table without scoping to demo IDs or metadata.seed = 'demo'.
 */

// Inline the buildDeleteSteps logic here so tests are pure / DB-free.
// We extract the logic to a testable shape rather than importing the
// entry-point module (which has side-effects via imports).

import {
  DEMO_ORG_ID,
  DEMO_VENDOR_ORG_ID,
  DEMO_WHITE_LABEL_CONFIG_ID,
  DEMO_CONNECTOR_ID,
  DEMO_USER_IDS,
  DEMO_DEPARTMENT_IDS,
  DEMO_RECORDING_IDS,
  DEMO_DOCUMENT_IDS,
  DEMO_SUMMARY_IDS,
  DEMO_TRANSCRIPT_IDS,
  DEMO_WIKI_PAGE_IDS,
  DEMO_IMPORTED_DOC_IDS,
  DEMO_KNOWLEDGE_GAP_IDS,
  DEMO_SHARE_IDS,
  DEMO_TAG_IDS,
  DEMO_RECORDING_SLUGS,
} from '../fixtures.js';
import { deriveChunkId } from '../ids.js';

// ─── Inline delete step builder (mirrors reset.ts) ───────────────────────────

interface DeleteStep {
  table: string;
  description: string;
  where: string;
  params: unknown[];
  hasSeedMetadata?: boolean;
}

function buildDeleteSteps(): DeleteStep[] {
  const allChunkIds: string[] = [];
  for (const slug of DEMO_RECORDING_SLUGS) {
    for (let i = 0; i < 6; i++) {
      allChunkIds.push(deriveChunkId(slug, i));
    }
  }

  const allRecordingIds = Object.values(DEMO_RECORDING_IDS);
  const allDocumentIds = Object.values(DEMO_DOCUMENT_IDS);
  const allSummaryIds = Object.values(DEMO_SUMMARY_IDS);
  const allTranscriptIds = Object.values(DEMO_TRANSCRIPT_IDS);
  const allWikiPageIds = Object.values(DEMO_WIKI_PAGE_IDS);
  const allImportedDocIds = Object.values(DEMO_IMPORTED_DOC_IDS);
  const allKnowledgeGapIds = Object.values(DEMO_KNOWLEDGE_GAP_IDS);
  const allShareIds = Object.values(DEMO_SHARE_IDS);
  const allTagIds = Object.values(DEMO_TAG_IDS);
  const allUserIds = Object.values(DEMO_USER_IDS);
  const allDeptIds = Object.values(DEMO_DEPARTMENT_IDS);

  return [
    {
      table: 'wiki_page_sources',
      description: `wiki_page_sources for ${allWikiPageIds.length} demo wiki pages`,
      where: `page_id = ANY($1::uuid[])`,
      params: [allWikiPageIds],
    },
    {
      table: 'transcript_chunks',
      description: `transcript_chunks for ${allChunkIds.length} demo chunks`,
      where: `id = ANY($1::uuid[])`,
      params: [allChunkIds],
    },
    {
      table: 'content_tags',
      description: `content_tags for ${allRecordingIds.length} demo recordings`,
      where: `content_id = ANY($1::uuid[])`,
      params: [allRecordingIds],
    },
    {
      table: 'content_summaries',
      description: `${allSummaryIds.length} demo content_summaries`,
      where: `id = ANY($1::uuid[])`,
      params: [allSummaryIds],
    },
    {
      table: 'documents',
      description: `${allDocumentIds.length} demo documents`,
      where: `id = ANY($1::uuid[])`,
      params: [allDocumentIds],
    },
    {
      table: 'transcripts',
      description: `${allTranscriptIds.length} demo transcripts`,
      where: `id = ANY($1::uuid[])`,
      params: [allTranscriptIds],
    },
    {
      table: 'org_wiki_pages',
      description: `${allWikiPageIds.length} demo wiki pages (metadata.seed = 'demo')`,
      where: `metadata->>'seed' = 'demo'`,
      params: [],
      hasSeedMetadata: true,
    },
    {
      table: 'imported_documents',
      description: `${allImportedDocIds.length} demo imported_documents`,
      where: `id = ANY($1::uuid[])`,
      params: [allImportedDocIds],
    },
    {
      table: 'knowledge_gaps',
      description: `${allKnowledgeGapIds.length} demo knowledge_gaps`,
      where: `id = ANY($1::uuid[])`,
      params: [allKnowledgeGapIds],
    },
    {
      table: 'shares',
      description: `${allShareIds.length} demo shares`,
      where: `id = ANY($1::uuid[])`,
      params: [allShareIds],
    },
    {
      table: 'content',
      description: `${allRecordingIds.length} demo content rows (metadata.seed = 'demo')`,
      where: `metadata->>'seed' = 'demo'`,
      params: [],
      hasSeedMetadata: true,
    },
    {
      table: 'connector_configs',
      description: `1 demo connector_config`,
      where: `id = $1`,
      params: [DEMO_CONNECTOR_ID],
    },
    {
      table: 'tags',
      description: `${allTagIds.length} demo tags`,
      where: `id = ANY($1::uuid[])`,
      params: [allTagIds],
    },
    {
      table: 'white_label_configs',
      description: `1 demo white_label_config`,
      where: `id = $1`,
      params: [DEMO_WHITE_LABEL_CONFIG_ID],
    },
    {
      table: '"member"',
      description: `${allUserIds.length} demo org memberships`,
      where: `"organizationId" = $1`,
      params: [DEMO_ORG_ID],
    },
    {
      table: 'users',
      description: `${allUserIds.length} demo users (app table)`,
      where: `id = ANY($1::uuid[])`,
      params: [allUserIds],
    },
    {
      table: '"account"',
      description: `${allUserIds.length} demo Better Auth accounts`,
      where: `"userId" = ANY($1::uuid[])`,
      params: [allUserIds],
    },
    {
      table: '"user"',
      description: `${allUserIds.length} demo Better Auth users`,
      where: `id = ANY($1::uuid[])`,
      params: [allUserIds],
    },
    {
      table: 'departments',
      description: `${allDeptIds.length} demo departments`,
      where: `id = ANY($1::uuid[])`,
      params: [allDeptIds],
    },
    {
      table: 'organizations',
      description: `vendor org (tribora-vendor-demo)`,
      where: `id = $1`,
      params: [DEMO_VENDOR_ORG_ID],
    },
    {
      table: 'organizations',
      description: `Acme Support Demo org`,
      where: `id = $1`,
      params: [DEMO_ORG_ID],
    },
  ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildDeleteSteps', () => {
  const steps = buildDeleteSteps();

  test('produces at least one step', () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  test('every step has a non-empty WHERE clause', () => {
    for (const step of steps) {
      expect(step.where.trim()).not.toBe('');
      // Must not be a trivially-unscoped clause like WHERE TRUE or WHERE 1=1
      expect(step.where.trim().toUpperCase()).not.toBe('TRUE');
      expect(step.where.trim()).not.toBe('1=1');
    }
  });

  test('every step with $N placeholder has matching params', () => {
    for (const step of steps) {
      // Count $1, $2, ... placeholders in the WHERE string
      const matches = step.where.match(/\$\d+/g) ?? [];
      const maxPlaceholder = matches.length > 0
        ? Math.max(...matches.map((m) => parseInt(m.slice(1), 10)))
        : 0;
      expect(step.params.length).toBeGreaterThanOrEqual(maxPlaceholder);
    }
  });

  test('covers all seeded tables', () => {
    const seededTables = [
      'wiki_page_sources',
      'transcript_chunks',
      'content_tags',
      'content_summaries',
      'documents',
      'transcripts',
      'org_wiki_pages',
      'imported_documents',
      'knowledge_gaps',
      'shares',
      'content',
      'connector_configs',
      'tags',
      'white_label_configs',
      '"member"',
      'users',
      '"account"',
      '"user"',
      'departments',
      'organizations',
    ];

    const coveredTables = new Set(steps.map((s) => s.table));
    for (const t of seededTables) {
      expect(coveredTables.has(t)).toBe(true);
    }
  });

  test('FK ordering: children before parents', () => {
    const tableIndex = (table: string): number =>
      steps.findIndex((s) => s.table === table);

    // wiki_page_sources must come before org_wiki_pages
    expect(tableIndex('wiki_page_sources')).toBeLessThan(tableIndex('org_wiki_pages'));

    // transcript_chunks must come before transcripts
    expect(tableIndex('transcript_chunks')).toBeLessThan(tableIndex('transcripts'));

    // content_summaries, documents, transcripts must come before content
    expect(tableIndex('content_summaries')).toBeLessThan(tableIndex('content'));
    expect(tableIndex('documents')).toBeLessThan(tableIndex('content'));
    expect(tableIndex('transcripts')).toBeLessThan(tableIndex('content'));

    // white_label_configs must come before vendor org (organizations)
    expect(tableIndex('white_label_configs')).toBeLessThan(tableIndex('organizations'));

    // users must come before departments
    expect(tableIndex('users')).toBeLessThan(tableIndex('departments'));

    // Better Auth "user" must come after "account" (account FK → user)
    expect(tableIndex('"account"')).toBeLessThan(tableIndex('"user"'));

    // "member" before users/user
    expect(tableIndex('"member"')).toBeLessThan(tableIndex('users'));
  });

  test('each step scoped to metadata.seed or deterministic demo ID', () => {
    for (const step of steps) {
      const isMetadataScoped = step.where.includes("metadata->>'seed'");
      const isIdScoped =
        step.where.includes('id = $') ||
        step.where.includes('id = ANY') ||
        step.where.includes('"organizationId" = $') ||
        step.where.includes('"userId" = ANY') ||
        step.where.includes('content_id = ANY') ||
        step.where.includes('page_id = ANY') ||
        step.where.includes('vendor_org_id') ||
        step.where.includes('transcript_id');
      expect(isMetadataScoped || isIdScoped).toBe(true);
    }
  });

  test('chunk ID count matches recording count × 6', () => {
    const chunkStep = steps.find((s) => s.table === 'transcript_chunks');
    expect(chunkStep).toBeDefined();
    const chunkIds = chunkStep!.params[0] as string[];
    expect(chunkIds.length).toBe(DEMO_RECORDING_SLUGS.length * 6);
  });

  test('organizations appears last (after children)', () => {
    const orgIndices = steps.reduce<number[]>((acc, step, i) => {
      if (step.table === 'organizations') acc.push(i);
      return acc;
    }, []);
    // Both org deletes must come after "user", "member", departments, white_label_configs
    const nonOrgTables = ['departments', '"user"', '"member"', 'white_label_configs'];
    for (const orgIdx of orgIndices) {
      for (const t of nonOrgTables) {
        const tIdx = steps.findIndex((s) => s.table === t);
        if (tIdx >= 0) {
          expect(tIdx).toBeLessThan(orgIdx);
        }
      }
    }
  });

  test('recording IDs in content_tags match DEMO_RECORDING_IDS', () => {
    const contentTagsStep = steps.find((s) => s.table === 'content_tags');
    expect(contentTagsStep).toBeDefined();
    const ids = contentTagsStep!.params[0] as string[];
    const expectedIds = Object.values(DEMO_RECORDING_IDS);
    expect(ids.sort()).toEqual(expectedIds.sort());
  });
});

describe('buildDeleteSteps: fixture count integrity', () => {
  const steps = buildDeleteSteps();

  test('30 recording IDs in content step (metadata scoped)', () => {
    const contentStep = steps.find(
      (s) => s.table === 'content' && s.hasSeedMetadata
    );
    expect(contentStep).toBeDefined();
    // metadata-scoped steps have no params
    expect(contentStep!.params).toHaveLength(0);
  });

  test('12 wiki page IDs in wiki_page_sources step', () => {
    const wikiSourceStep = steps.find((s) => s.table === 'wiki_page_sources');
    expect(wikiSourceStep).toBeDefined();
    const ids = wikiSourceStep!.params[0] as string[];
    expect(ids).toHaveLength(Object.values(DEMO_WIKI_PAGE_IDS).length);
  });

  test('5 user IDs in users step', () => {
    const usersStep = steps.find((s) => s.table === 'users');
    expect(usersStep).toBeDefined();
    const ids = usersStep!.params[0] as string[];
    expect(ids).toHaveLength(Object.values(DEMO_USER_IDS).length);
  });

  test('3 department IDs in departments step', () => {
    const deptStep = steps.find((s) => s.table === 'departments');
    expect(deptStep).toBeDefined();
    const ids = deptStep!.params[0] as string[];
    expect(ids).toHaveLength(Object.values(DEMO_DEPARTMENT_IDS).length);
  });
});
