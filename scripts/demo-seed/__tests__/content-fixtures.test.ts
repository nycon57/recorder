/* global describe, expect, it */

/**
 * @jest-environment node
 *
 * Tests for TRIB-148 content fixture loading.
 *
 * Validates:
 * - All 30 transcript markdown files exist and are non-empty
 * - All 12 wiki-page markdown files exist and are non-empty
 * - All 8 imported-doc markdown files exist and are non-empty
 * - loadRecordingFixtures() returns 30 items with correct authorship counts
 * - loadWikiPageFixtures() returns 12 items with correct published/unpublished split
 * - loadImportedDocFixtures() returns 8 items
 * - Deterministic IDs are unique across their entity type
 * - Author roster: 18 lead + 10 agent + 2 admin = 30
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  loadRecordingFixtures,
  loadWikiPageFixtures,
  loadImportedDocFixtures,
  KNOWLEDGE_GAP_FIXTURES,
  TAG_FIXTURES,
  buildShareFixtures,
  ZERO_VECTOR_1536,
} from '../content-fixtures';
import {
  DEMO_RECORDING_SLUGS,
  DEMO_WIKI_PAGE_SLUGS,
  DEMO_IMPORTED_DOC_SLUGS,
  DEMO_USER_IDS,
  DEMO_WIKI_PAGE_IDS,
} from '../fixtures';

const CONTENT_DIR = path.join(__dirname, '..', 'content');

// ─── Markdown file presence ───────────────────────────────────────────────────

describe('transcript markdown files', () => {
  it.each([...DEMO_RECORDING_SLUGS])('exists: %s.md', (slug) => {
    const p = path.join(CONTENT_DIR, 'transcripts', `${slug}.md`);
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.readFileSync(p, 'utf-8').trim().length).toBeGreaterThan(50);
  });
});

describe('wiki-page markdown files', () => {
  it.each([...DEMO_WIKI_PAGE_SLUGS])('exists: %s.md', (slug) => {
    const p = path.join(CONTENT_DIR, 'wiki-pages', `${slug}.md`);
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.readFileSync(p, 'utf-8').trim().length).toBeGreaterThan(50);
  });
});

describe('imported-doc markdown files', () => {
  it.each([...DEMO_IMPORTED_DOC_SLUGS])('exists: %s.md', (slug) => {
    const p = path.join(CONTENT_DIR, 'imported-docs', `${slug}.md`);
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.readFileSync(p, 'utf-8').trim().length).toBeGreaterThan(50);
  });
});

// ─── Recording fixtures ───────────────────────────────────────────────────────

describe('loadRecordingFixtures()', () => {
  const fixtures = loadRecordingFixtures();

  it('returns 30 recordings', () => {
    expect(fixtures).toHaveLength(30);
  });

  it('all IDs are valid UUIDs', () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const f of fixtures) {
      expect(f.id).toMatch(UUID_RE);
      expect(f.documentId).toMatch(UUID_RE);
      expect(f.summaryId).toMatch(UUID_RE);
      expect(f.transcriptId).toMatch(UUID_RE);
    }
  });

  it('all IDs are unique within their entity type', () => {
    const ids = fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(30);

    const docIds = fixtures.map((f) => f.documentId);
    expect(new Set(docIds).size).toBe(30);
  });

  it('no entity uses the same ID across type boundaries', () => {
    const recordingIds = new Set(fixtures.map((f) => f.id));
    const documentIds = new Set(fixtures.map((f) => f.documentId));
    const summaryIds = new Set(fixtures.map((f) => f.summaryId));
    const transcriptIds = new Set(fixtures.map((f) => f.transcriptId));

    // No overlap between recording IDs and document IDs
    for (const id of recordingIds) {
      expect(documentIds.has(id)).toBe(false);
    }
    for (const id of recordingIds) {
      expect(summaryIds.has(id)).toBe(false);
    }
    for (const id of recordingIds) {
      expect(transcriptIds.has(id)).toBe(false);
    }
  });

  it('authorship: 18 lead, 10 agent, 2 admin, 0 owner/reader', () => {
    const counts: Record<string, number> = {};
    for (const f of fixtures) {
      const role = Object.entries(DEMO_USER_IDS).find(([, id]) => id === f.createdBy)?.[0] ?? 'unknown';
      counts[role] = (counts[role] ?? 0) + 1;
    }
    expect(counts['lead']).toBe(18);
    expect(counts['agent']).toBe(10);
    expect(counts['admin']).toBe(2);
    expect(counts['owner'] ?? 0).toBe(0);
    expect(counts['reader'] ?? 0).toBe(0);
  });

  it('all transcripts are non-empty', () => {
    for (const f of fixtures) {
      expect(f.transcriptText.trim().length).toBeGreaterThan(50);
    }
  });

  it('all documents are non-empty markdown', () => {
    for (const f of fixtures) {
      expect(f.documentMarkdown).toContain('#');
      expect(f.documentMarkdown.trim().length).toBeGreaterThan(50);
    }
  });

  it('all durations are between 180 and 720 seconds', () => {
    for (const f of fixtures) {
      expect(f.durationSec).toBeGreaterThanOrEqual(180);
      expect(f.durationSec).toBeLessThanOrEqual(720);
    }
  });

  it('all tags are valid names', () => {
    const valid = new Set(['refund', 'onboarding', 'integration', 'zendesk', 'hubspot', 'jira']);
    for (const f of fixtures) {
      for (const tag of f.tagNames) {
        expect(valid.has(tag)).toBe(true);
      }
    }
  });
});

// ─── Wiki page fixtures ───────────────────────────────────────────────────────

describe('loadWikiPageFixtures()', () => {
  const fixtures = loadWikiPageFixtures();

  it('returns 12 wiki pages', () => {
    expect(fixtures).toHaveLength(12);
  });

  it('8 published, 4 unpublished', () => {
    const published = fixtures.filter((f) => f.isPublished).length;
    const unpublished = fixtures.filter((f) => !f.isPublished).length;
    expect(published).toBe(8);
    expect(unpublished).toBe(4);
  });

  it('confidence range is 0.55–0.91', () => {
    for (const f of fixtures) {
      expect(f.confidence).toBeGreaterThanOrEqual(0.55);
      expect(f.confidence).toBeLessThanOrEqual(0.91);
    }
  });

  it('all IDs are unique', () => {
    const ids = fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(12);
  });

  it('all have at least one source recording', () => {
    for (const f of fixtures) {
      expect(f.sourceRecordingIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('topic extracted from first heading', () => {
    for (const f of fixtures) {
      expect(f.topic.trim().length).toBeGreaterThan(5);
    }
  });
});

// ─── Imported doc fixtures ────────────────────────────────────────────────────

describe('loadImportedDocFixtures()', () => {
  const fixtures = loadImportedDocFixtures();

  it('returns 8 imported docs', () => {
    expect(fixtures).toHaveLength(8);
  });

  it('all IDs are unique', () => {
    const ids = fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('all external IDs are unique', () => {
    const extIds = fixtures.map((f) => f.externalId);
    expect(new Set(extIds).size).toBe(8);
  });

  it('all content is non-empty', () => {
    for (const f of fixtures) {
      expect(f.content.trim().length).toBeGreaterThan(50);
    }
  });

  it('all share the same connector ID', () => {
    const connectorIds = new Set(fixtures.map((f) => f.connectorId));
    expect(connectorIds.size).toBe(1);
  });
});

// ─── Knowledge gap fixtures ───────────────────────────────────────────────────

describe('KNOWLEDGE_GAP_FIXTURES', () => {
  it('returns 4 knowledge gaps', () => {
    expect(KNOWLEDGE_GAP_FIXTURES).toHaveLength(4);
  });

  it('status distribution: 2 open, 1 in_progress, 1 resolved', () => {
    const statuses = KNOWLEDGE_GAP_FIXTURES.map((g) => g.status);
    expect(statuses.filter((s) => s === 'open')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'in_progress')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'resolved')).toHaveLength(1);
  });

  it('all IDs are unique UUIDs', () => {
    const ids = KNOWLEDGE_GAP_FIXTURES.map((g) => g.id);
    expect(new Set(ids).size).toBe(4);
  });
});

// ─── Tag fixtures ─────────────────────────────────────────────────────────────

describe('TAG_FIXTURES', () => {
  it('returns 6 tags', () => {
    expect(TAG_FIXTURES).toHaveLength(6);
  });

  it('all IDs are unique', () => {
    const ids = TAG_FIXTURES.map((t) => t.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('all names match expected list', () => {
    const names = new Set(TAG_FIXTURES.map((t) => t.name));
    for (const n of ['refund', 'onboarding', 'integration', 'zendesk', 'hubspot', 'jira']) {
      expect(names.has(n)).toBe(true);
    }
  });
});

// ─── Share fixtures ───────────────────────────────────────────────────────────

describe('buildShareFixtures()', () => {
  const shares = buildShareFixtures();

  it('returns 3 shares', () => {
    expect(shares).toHaveLength(3);
  });

  it('all target IDs are valid wiki page IDs', () => {
    const wikiIds = new Set(Object.values(DEMO_WIKI_PAGE_IDS));
    for (const s of shares) {
      expect(wikiIds.has(s.targetId)).toBe(true);
    }
  });

  it('all share tokens are deterministic strings', () => {
    const tokens = shares.map((s) => s.shareToken);
    // deterministic — same every run
    expect(tokens).toEqual(buildShareFixtures().map((s) => s.shareToken));
  });
});

// ─── Zero vector ─────────────────────────────────────────────────────────────

describe('ZERO_VECTOR_1536', () => {
  it('has 1536 comma-separated elements', () => {
    const parts = ZERO_VECTOR_1536.slice(1, -1).split(',');
    expect(parts).toHaveLength(1536);
  });

  it('all elements are 0', () => {
    const parts = ZERO_VECTOR_1536.slice(1, -1).split(',');
    expect(parts.every((p) => p === '0')).toBe(true);
  });

  it('is wrapped in brackets', () => {
    expect(ZERO_VECTOR_1536.startsWith('[')).toBe(true);
    expect(ZERO_VECTOR_1536.endsWith(']')).toBe(true);
  });
});
