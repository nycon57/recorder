/**
 * @jest-environment node
 *
 * Unit tests for the smoke verification assertion logic.
 *
 * Tests the assertion functions as pure logic by mocking the DB client.
 * No live DB required.
 *
 * Uses `@jest-environment node` because smoke.ts imports `pg` which uses
 * Node.js crypto APIs (TextEncoder) not available in jsdom.
 *
 * Each assertion function in smoke.ts accepts a PoolClient and returns
 * an AssertionResult. We mock the client's query() method to return
 * controlled rows and verify the pass/fail logic is correct.
 */

import type pg from 'pg';

import {
  DEMO_ORG_ID,
  DEMO_VENDOR_ORG_ID,
  DEMO_WHITE_LABEL_CONFIG_ID,
  DEMO_USER_IDS,
  DEMO_USERS,
} from '../fixtures.js';
import {
  assertDemoOrgExists,
  assertUsersExistWithRoles,
  assertRecordingCountsByUser,
  assertTranscriptChunkCount,
  assertWikiPageCounts,
  assertVendorDemoOrgExists,
  assertDepartmentFKResolution,
  assertSeedMetadataPresent,
  assertForceReseedFKSafety,
} from '../smoke.js';

// ─── Mock client helper ───────────────────────────────────────────────────────

type QueryResult = { rows: Record<string, unknown>[]; rowCount?: number };

function makeMockClient(
  queryMap: Array<{ match: (sql: string) => boolean; result: QueryResult }>
): pg.PoolClient {
  return {
    query: jest.fn(async (sql: string) => {
      for (const { match, result } of queryMap) {
        if (match(sql)) return result;
      }
      // Default: empty result
      return { rows: [], rowCount: 0 };
    }),
  } as unknown as pg.PoolClient;
}

// ─── assertDemoOrgExists ─────────────────────────────────────────────────────

describe('assertDemoOrgExists', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes when org row exists', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('FROM organizations WHERE id'),
        result: { rows: [{ id: DEMO_ORG_ID, name: 'Acme Support Demo' }], rowCount: 1 },
      },
    ]);
    const result = await assertDemoOrgExists(client);
    expect(result.passed).toBe(true);
  });

  test('fails when org row is missing', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('FROM organizations WHERE id'),
        result: { rows: [], rowCount: 0 },
      },
    ]);
    const result = await assertDemoOrgExists(client);
    expect(result.passed).toBe(false);
    expect(result.actual).toBe('not found');
  });
});

// ─── assertUsersExistWithRoles ────────────────────────────────────────────────

describe('assertUsersExistWithRoles', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes when all 5 users present with correct roles', async () => {
    const userRows = DEMO_USERS.map((u) => ({
      id: u.id,
      role: u.role,
      email: u.email,
    }));
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('FROM users WHERE id = ANY'),
        result: { rows: userRows, rowCount: userRows.length },
      },
    ]);
    const result = await assertUsersExistWithRoles(client);
    expect(result.passed).toBe(true);
  });

  test('fails when a user has wrong role', async () => {
    const userRows = DEMO_USERS.map((u) => ({
      id: u.id,
      role: u.email === 'owner@demo.tribora.test' ? 'reader' : u.role, // corrupt owner role
      email: u.email,
    }));
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('FROM users WHERE id = ANY'),
        result: { rows: userRows, rowCount: userRows.length },
      },
    ]);
    const result = await assertUsersExistWithRoles(client);
    expect(result.passed).toBe(false);
  });

  test('fails when fewer than 5 users returned', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('FROM users WHERE id = ANY'),
        result: { rows: [{ id: DEMO_USER_IDS.owner, role: 'owner', email: 'owner@demo.tribora.test' }], rowCount: 1 },
      },
    ]);
    const result = await assertUsersExistWithRoles(client);
    expect(result.passed).toBe(false);
  });
});

// ─── assertRecordingCountsByUser ─────────────────────────────────────────────

describe('assertRecordingCountsByUser', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes with correct 18/10/2 distribution', async () => {
    const rows = [
      { created_by: DEMO_USER_IDS.lead, cnt: '18' },
      { created_by: DEMO_USER_IDS.agent, cnt: '10' },
      { created_by: DEMO_USER_IDS.admin, cnt: '2' },
    ];
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('FROM content WHERE metadata'),
        result: { rows, rowCount: rows.length },
      },
    ]);
    const result = await assertRecordingCountsByUser(client);
    expect(result.passed).toBe(true);
  });

  test('fails if lead count is wrong', async () => {
    const rows = [
      { created_by: DEMO_USER_IDS.lead, cnt: '15' }, // wrong
      { created_by: DEMO_USER_IDS.agent, cnt: '10' },
      { created_by: DEMO_USER_IDS.admin, cnt: '2' },
    ];
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('FROM content WHERE metadata'),
        result: { rows, rowCount: rows.length },
      },
    ]);
    const result = await assertRecordingCountsByUser(client);
    expect(result.passed).toBe(false);
    expect(result.actual).toContain('Marcus Chen');
  });

  test('fails if reader has recordings', async () => {
    const rows = [
      { created_by: DEMO_USER_IDS.lead, cnt: '18' },
      { created_by: DEMO_USER_IDS.agent, cnt: '10' },
      { created_by: DEMO_USER_IDS.admin, cnt: '2' },
      { created_by: DEMO_USER_IDS.reader, cnt: '1' }, // should be 0
    ];
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('FROM content WHERE metadata'),
        result: { rows, rowCount: rows.length },
      },
    ]);
    const result = await assertRecordingCountsByUser(client);
    expect(result.passed).toBe(false);
  });
});

// ─── assertTranscriptChunkCount ──────────────────────────────────────────────

describe('assertTranscriptChunkCount', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes with 180 chunks', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('transcript_chunks'),
        result: { rows: [{ cnt: '180' }], rowCount: 1 },
      },
    ]);
    const result = await assertTranscriptChunkCount(client);
    expect(result.passed).toBe(true);
  });

  test('passes with 150 chunks (lower bound)', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('transcript_chunks'),
        result: { rows: [{ cnt: '150' }], rowCount: 1 },
      },
    ]);
    const result = await assertTranscriptChunkCount(client);
    expect(result.passed).toBe(true);
  });

  test('passes with 210 chunks (upper bound)', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('transcript_chunks'),
        result: { rows: [{ cnt: '210' }], rowCount: 1 },
      },
    ]);
    const result = await assertTranscriptChunkCount(client);
    expect(result.passed).toBe(true);
  });

  test('fails with 50 chunks (too few)', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('transcript_chunks'),
        result: { rows: [{ cnt: '50' }], rowCount: 1 },
      },
    ]);
    const result = await assertTranscriptChunkCount(client);
    expect(result.passed).toBe(false);
  });

  test('fails with 0 chunks', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('transcript_chunks'),
        result: { rows: [{ cnt: '0' }], rowCount: 1 },
      },
    ]);
    const result = await assertTranscriptChunkCount(client);
    expect(result.passed).toBe(false);
  });
});

// ─── assertWikiPageCounts ─────────────────────────────────────────────────────

describe('assertWikiPageCounts', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes with 12 total, 8 published, 4 draft', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('org_wiki_pages'),
        result: {
          rows: [{ total: '12', published: '8', draft: '4' }],
          rowCount: 1,
        },
      },
    ]);
    const result = await assertWikiPageCounts(client);
    expect(result.passed).toBe(true);
  });

  test('fails if total is wrong', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('org_wiki_pages'),
        result: {
          rows: [{ total: '10', published: '8', draft: '2' }],
          rowCount: 1,
        },
      },
    ]);
    const result = await assertWikiPageCounts(client);
    expect(result.passed).toBe(false);
  });

  test('fails if published count is wrong', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('org_wiki_pages'),
        result: {
          rows: [{ total: '12', published: '12', draft: '0' }],
          rowCount: 1,
        },
      },
    ]);
    const result = await assertWikiPageCounts(client);
    expect(result.passed).toBe(false);
  });
});

// ─── assertVendorDemoOrgExists ────────────────────────────────────────────────

describe('assertVendorDemoOrgExists', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes when all three conditions met', async () => {
    let callCount = 0;
    const client = {
      query: jest.fn(async (sql: string) => {
        callCount++;
        if (sql.includes('FROM organizations WHERE id = $1') && callCount === 1) {
          return {
            rows: [{ id: DEMO_ORG_ID, vendor_org_id: DEMO_VENDOR_ORG_ID }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM white_label_configs')) {
          return {
            rows: [{ id: DEMO_WHITE_LABEL_CONFIG_ID }],
            rowCount: 1,
          };
        }
        if (sql.includes('vendor_org_id::text FROM organizations')) {
          return {
            rows: [{ vendor_org_id: DEMO_VENDOR_ORG_ID }],
            rowCount: 1,
          };
        }
        return { rows: [{ id: DEMO_VENDOR_ORG_ID }], rowCount: 1 };
      }),
    } as unknown as pg.PoolClient;

    const result = await assertVendorDemoOrgExists(client);
    expect(result.passed).toBe(true);
  });

  test('fails when white_label_config missing', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM white_label_configs')) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [{ id: DEMO_ORG_ID, vendor_org_id: DEMO_VENDOR_ORG_ID, vendor_org_id2: DEMO_VENDOR_ORG_ID }],
          rowCount: 1,
        };
      }),
    } as unknown as pg.PoolClient;

    const result = await assertVendorDemoOrgExists(client);
    expect(result.passed).toBe(false);
  });
});

// ─── assertDepartmentFKResolution ─────────────────────────────────────────────

describe('assertDepartmentFKResolution', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes when all users have correct depts', async () => {
    const rows = DEMO_USERS.map((u) => ({
      dept_name: u.departmentSlug === 'executive'
        ? 'Executive'
        : u.departmentSlug === 'supportOps'
        ? 'Support Ops'
        : 'Support',
      user_email: u.email,
    }));
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('JOIN departments'),
        result: { rows, rowCount: rows.length },
      },
    ]);
    const result = await assertDepartmentFKResolution(client);
    expect(result.passed).toBe(true);
  });

  test('fails when fewer users than expected', async () => {
    const client = makeMockClient([
      {
        match: (sql) => sql.includes('JOIN departments'),
        result: {
          rows: [{ dept_name: 'Support', user_email: 'lead@demo.tribora.test' }],
          rowCount: 1,
        },
      },
    ]);
    const result = await assertDepartmentFKResolution(client);
    expect(result.passed).toBe(false);
  });
});

// ─── assertSeedMetadataPresent ────────────────────────────────────────────────

describe('assertSeedMetadataPresent', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes when content and wiki counts match', async () => {
    // Returns different counts based on SQL content
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("metadata->>'seed' = 'demo'") && sql.includes('content')) {
          return { rows: [{ cnt: '30' }], rowCount: 1 };
        }
        if (sql.includes("metadata->>'seed' = 'demo'") && sql.includes('org_wiki_pages')) {
          return { rows: [{ cnt: '12' }], rowCount: 1 };
        }
        if (sql.includes("metadata->>'seed' = 'demo'") && sql.includes('organizations')) {
          return { rows: [{ cnt: '2' }], rowCount: 1 };
        }
        // Total queries
        return { rows: [{ cnt: '100' }], rowCount: 1 };
      }),
    } as unknown as pg.PoolClient;

    const result = await assertSeedMetadataPresent(client);
    expect(result.passed).toBe(true);
  });

  test('fails when content seed count is too low', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("metadata->>'seed' = 'demo'") && sql.includes('content')) {
          return { rows: [{ cnt: '5' }], rowCount: 1 }; // wrong
        }
        if (sql.includes("metadata->>'seed' = 'demo'") && sql.includes('org_wiki_pages')) {
          return { rows: [{ cnt: '12' }], rowCount: 1 };
        }
        if (sql.includes("metadata->>'seed' = 'demo'") && sql.includes('organizations')) {
          return { rows: [{ cnt: '2' }], rowCount: 1 };
        }
        return { rows: [{ cnt: '100' }], rowCount: 1 };
      }),
    } as unknown as pg.PoolClient;

    const result = await assertSeedMetadataPresent(client);
    expect(result.passed).toBe(false);
  });
});

// ─── assertForceReseedFKSafety ────────────────────────────────────────────────

describe('assertForceReseedFKSafety', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes (false alarm) when org_id is nullable', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [{ is_nullable: 'YES', constraint_type: null }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM organizations WHERE id = $1')) {
          return { rows: [{ exists: false }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as pg.PoolClient;

    const result = await assertForceReseedFKSafety(client);
    expect(result.passed).toBe(true);
    expect(result.advisory).toContain('NULLABLE');
    expect(result.advisory).toContain('false alarm');
  });

  test('fails (bug confirmed) when org_id is NOT NULL and placeholder not a valid org', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [{ is_nullable: 'NO', constraint_type: 'FOREIGN KEY' }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM organizations WHERE id = $1')) {
          return { rows: [{ exists: false }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as pg.PoolClient;

    const result = await assertForceReseedFKSafety(client);
    expect(result.passed).toBe(false);
    expect(result.advisory).toContain('BUG CONFIRMED');
  });

  test('passes (coincidence flag) when org_id NOT NULL but placeholder is coincidentally a valid org', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [{ is_nullable: 'NO', constraint_type: 'FOREIGN KEY' }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM organizations WHERE id = $1')) {
          // Simulate: placeholder UUID coincidentally matches an org
          return { rows: [{ exists: true }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as pg.PoolClient;

    const result = await assertForceReseedFKSafety(client);
    expect(result.passed).toBe(true);
    expect(result.advisory).toContain('coincidentally');
  });
});
