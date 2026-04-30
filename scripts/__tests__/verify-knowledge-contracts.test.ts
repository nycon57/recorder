import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { runKnowledgeContractVerification } from '../verify-knowledge-contracts';

function writeFixture(root: string, relativePath: string, content: string): void {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function createCompleteFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'knowledge-contracts-'));

  writeFixture(
    root,
    'src/lib/types/database.ts',
    [
      'content: {',
      'jobs: {',
      'org_wiki_pages: {',
      'wiki_page_sources: {',
      'wiki_relationships: {',
      'active_org_wiki_pages: {',
    ].join('\n'),
  );

  writeFixture(
    root,
    'supabase/migrations/20260424010000_claim.sql',
    [
      'create or replace function public.claim_pending_jobs',
      'for update of j skip locked',
      'revoke all on function public.claim_pending_jobs(integer, timestamptz) from public, anon, authenticated;',
      'grant execute on function public.claim_pending_jobs(integer, timestamptz) to service_role;',
    ].join('\n'),
  );

  writeFixture(
    root,
    'supabase/migrations/20260430011000_contracts.sql',
    [
      'duplicate non-null jobs.dedupe_key values exist',
      'create unique index if not exists jobs_dedupe_key_unique',
      'create or replace function public.supersede_org_wiki_page',
      'revoke all on function public.supersede_org_wiki_page(uuid, uuid, text, text, text, text, double precision, uuid, jsonb, timestamptz) from public, anon, authenticated;',
      'grant execute on function public.supersede_org_wiki_page(uuid, uuid, text, text, text, text, double precision, uuid, jsonb, timestamptz) to service_role;',
    ].join('\n'),
  );

  writeFixture(
    root,
    'src/lib/workers/job-processor.ts',
    ".eq('status', 'processing' as JobStatus)\nTimed out; retry disabled because the original handler may still be running",
  );
  writeFixture(
    root,
    'src/lib/workers/streaming-job-executor.ts',
    ".eq('status', 'processing' as JobStatus)\nhasStringPayloadValue(payload, 'documentId')",
  );
  writeFixture(root, 'src/lib/workers/job-enqueue.ts', 'Cannot enqueue unique');
  writeFixture(
    root,
    'src/lib/workers/handlers/compile-wiki.ts',
    "rpc('supersede_org_wiki_page'",
  );

  writeFixture(
    root,
    'src/app/api/recordings/upload/init/__tests__/route.test.ts',
    'reader',
  );
  writeFixture(
    root,
    'src/app/api/recordings/[id]/metadata/__tests__/route.test.ts',
    'another user',
  );
  writeFixture(
    root,
    'src/app/api/recordings/[id]/finalize/__tests__/route.test.ts',
    'another user',
  );
  writeFixture(
    root,
    'src/app/api/library/upload/__tests__/route.test.ts',
    'Content-Length',
  );
  writeFixture(
    root,
    'src/app/api/library/text/__tests__/route.test.ts',
    'reader',
  );

  return root;
}

describe('knowledge contract verification', () => {
  it('passes when all static knowledge ingestion contracts are present', () => {
    const result = runKnowledgeContractVerification(createCompleteFixture());

    expect(result.ok).toBe(true);
    expect(result.checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('fails closed when the Wiki supersede RPC is not service-role restricted', () => {
    const root = createCompleteFixture();
    writeFixture(
      root,
      'supabase/migrations/20260430011000_contracts.sql',
      [
        'duplicate non-null jobs.dedupe_key values exist',
        'create unique index if not exists jobs_dedupe_key_unique',
        'create or replace function public.supersede_org_wiki_page',
      ].join('\n'),
    );

    const result = runKnowledgeContractVerification(root);

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        name: 'Wiki supersede RPC is service-role restricted',
        status: 'fail',
      }),
    );
  });

  it('fails closed when a later migration grants a protected RPC to normal clients', () => {
    const root = createCompleteFixture();
    writeFixture(
      root,
      'supabase/migrations/20260430012000_bad_grant.sql',
      'grant execute on function public.supersede_org_wiki_page(uuid, uuid, text, text, text, text, double precision, uuid, jsonb, timestamptz) to authenticated;',
    );

    const result = runKnowledgeContractVerification(root);

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        name: 'Wiki supersede RPC has no normal-client execute grant',
        status: 'fail',
      }),
    );
  });
});
