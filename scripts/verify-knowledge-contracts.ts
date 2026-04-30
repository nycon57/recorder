import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

type CheckStatus = 'pass' | 'fail';

export interface ContractCheck {
  name: string;
  status: CheckStatus;
  details: string;
}

export interface ContractVerificationResult {
  ok: boolean;
  checks: ContractCheck[];
}

type RequiredSnippet = {
  name: string;
  snippet: string | RegExp;
  details: string;
};

const REQUIRED_SCHEMA_SNIPPETS: RequiredSnippet[] = [
  {
    name: 'content table is typed',
    snippet: 'content: {',
    details: 'Generated database types expose the first-party content table.',
  },
  {
    name: 'jobs table is typed',
    snippet: 'jobs: {',
    details: 'Generated database types expose worker jobs and payload fields.',
  },
  {
    name: 'org_wiki_pages table is typed',
    snippet: 'org_wiki_pages: {',
    details: 'Generated database types expose compiled Wiki pages.',
  },
  {
    name: 'wiki_page_sources table is typed',
    snippet: 'wiki_page_sources: {',
    details: 'Generated database types expose Wiki source links.',
  },
  {
    name: 'wiki_relationships table is typed',
    snippet: 'wiki_relationships: {',
    details: 'Generated database types expose compiled Wiki graph edges.',
  },
  {
    name: 'active_org_wiki_pages view is typed',
    snippet: 'active_org_wiki_pages: {',
    details: 'Generated database types expose the active compiled Wiki view.',
  },
];

const REQUIRED_MIGRATION_SNIPPETS: RequiredSnippet[] = [
  {
    name: 'atomic job claim RPC exists',
    snippet: 'create or replace function public.claim_pending_jobs',
    details: 'Workers claim pending jobs through the database-owned RPC.',
  },
  {
    name: 'job claim uses skip locked',
    snippet: /for update of j skip locked/i,
    details: 'Concurrent workers cannot claim the same pending row.',
  },
  {
    name: 'job claim RPC is service-role restricted',
    snippet: /revoke all on function public\.claim_pending_jobs[\s\S]*grant execute on function public\.claim_pending_jobs[\s\S]*to service_role/i,
    details: 'The security-definer job claim RPC is not executable by normal clients.',
  },
  {
    name: 'job dedupe key unique index exists',
    snippet: 'create unique index if not exists jobs_dedupe_key_unique',
    details: 'Non-null worker dedupe keys have a database uniqueness contract.',
  },
  {
    name: 'dedupe migration fails clearly on existing duplicates',
    snippet: 'duplicate non-null jobs.dedupe_key values exist',
    details: 'The dedupe uniqueness migration refuses ambiguous existing data.',
  },
  {
    name: 'atomic Wiki supersede RPC exists',
    snippet: 'create or replace function public.supersede_org_wiki_page',
    details: 'Compiled Wiki contradiction auto-apply uses a database transaction boundary.',
  },
  {
    name: 'Wiki supersede RPC is service-role restricted',
    snippet: /revoke all on function public\.supersede_org_wiki_page[\s\S]*grant execute on function public\.supersede_org_wiki_page[\s\S]*to service_role/i,
    details: 'The security-definer Wiki supersede RPC is not executable by normal clients.',
  },
];

const PROHIBITED_RPC_GRANTS = [
  {
    name: 'job claim RPC has no normal-client execute grant',
    rpcName: 'claim_pending_jobs',
    details: 'No migration grants claim_pending_jobs execution to public, anon, or authenticated.',
  },
  {
    name: 'Wiki supersede RPC has no normal-client execute grant',
    rpcName: 'supersede_org_wiki_page',
    details: 'No migration grants supersede_org_wiki_page execution to public, anon, or authenticated.',
  },
];

const REQUIRED_CODE_SNIPPETS: Array<RequiredSnippet & { file: string }> = [
  {
    file: 'src/lib/workers/job-processor.ts',
    name: 'normal worker completion is claim-owned',
    snippet: ".eq('status', 'processing' as JobStatus)",
    details: 'Normal worker completion/retry/failure writes are guarded by processing status.',
  },
  {
    file: 'src/lib/workers/job-processor.ts',
    name: 'timeout retry suppression is encoded',
    snippet: 'Timed out; retry disabled because the original handler may still be running',
    details: 'Timeouts do not automatically put a job back into the retry pool.',
  },
  {
    file: 'src/lib/workers/streaming-job-executor.ts',
    name: 'streaming executor completion is claim-owned',
    snippet: ".eq('status', 'processing' as JobStatus)",
    details: 'Streaming executor state transitions use the same ownership guard.',
  },
  {
    file: 'src/lib/workers/job-enqueue.ts',
    name: 'unique enqueue helper requires dedupe keys',
    snippet: 'Cannot enqueue unique',
    details: 'Shared enqueue helper fails closed when callers omit dedupe keys.',
  },
  {
    file: 'src/lib/workers/streaming-job-executor.ts',
    name: 'embeddings require documentId',
    snippet: "hasStringPayloadValue(payload, 'documentId')",
    details: 'Legacy/early embeddings jobs are not runnable until documentId is present.',
  },
  {
    file: 'src/lib/workers/handlers/compile-wiki.ts',
    name: 'compile Wiki uses atomic supersede RPC',
    snippet: "rpc('supersede_org_wiki_page'",
    details: 'Auto-applied contradictions use the database supersede contract.',
  },
];

const REQUIRED_ROUTE_TEST_SNIPPETS: Array<RequiredSnippet & { file: string }> = [
  {
    file: 'src/app/api/recordings/upload/init/__tests__/route.test.ts',
    name: 'upload init rejects reader before mutation',
    snippet: 'reader',
    details: 'Upload init has a negative permission test for read-only users.',
  },
  {
    file: 'src/app/api/recordings/[id]/metadata/__tests__/route.test.ts',
    name: 'metadata rejects non-owner contributor',
    snippet: 'another user',
    details: 'Metadata submission tests creator/admin/owner scoping.',
  },
  {
    file: 'src/app/api/recordings/[id]/finalize/__tests__/route.test.ts',
    name: 'finalize rejects non-owner contributor',
    snippet: 'another user',
    details: 'Finalize tests creator/admin/owner scoping.',
  },
  {
    file: 'src/app/api/library/upload/__tests__/route.test.ts',
    name: 'library upload bounds request size before parsing',
    snippet: /content-length/i,
    details: 'Library upload tests server-side request size gates before multipart parsing.',
  },
  {
    file: 'src/app/api/library/text/__tests__/route.test.ts',
    name: 'library text rejects reader before mutation',
    snippet: 'reader',
    details: 'Text-note creation has a negative permission test for read-only users.',
  },
];

function readText(root: string, relativePath: string): string {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function checkSnippet(text: string, required: RequiredSnippet): ContractCheck {
  const found =
    typeof required.snippet === 'string'
      ? text.includes(required.snippet)
      : required.snippet.test(text);

  return {
    name: required.name,
    status: found ? 'pass' : 'fail',
    details: found ? required.details : `Missing contract: ${required.details}`,
  };
}

function checkSnippetSet(text: string, snippets: RequiredSnippet[]): ContractCheck[] {
  return snippets.map((snippet) => checkSnippet(text, snippet));
}

function checkNoProhibitedRpcGrant(
  migrationsText: string,
  grant: (typeof PROHIBITED_RPC_GRANTS)[number],
): ContractCheck {
  const prohibitedGrant = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${grant.rpcName}\\s*\\([^;]*\\)\\s+to\\s+(public|anon|authenticated)\\b`,
    'i',
  );
  const found = prohibitedGrant.test(migrationsText);

  return {
    name: grant.name,
    status: found ? 'fail' : 'pass',
    details: found
      ? `Found prohibited execute grant for ${grant.rpcName}.`
      : grant.details,
  };
}

function readMigrations(root: string): string {
  const migrationsDir = path.join(root, 'supabase/migrations');
  if (!existsSync(migrationsDir)) {
    throw new Error('Missing required directory: supabase/migrations');
  }

  return readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort()
    .map((filename) => readFileSync(path.join(migrationsDir, filename), 'utf8'))
    .join('\n\n');
}

export function runKnowledgeContractVerification(
  root = process.cwd(),
): ContractVerificationResult {
  const checks: ContractCheck[] = [];

  checks.push(
    ...checkSnippetSet(
      readText(root, 'src/lib/types/database.ts'),
      REQUIRED_SCHEMA_SNIPPETS,
    ),
  );

  const migrationsText = readMigrations(root);
  checks.push(...checkSnippetSet(migrationsText, REQUIRED_MIGRATION_SNIPPETS));
  checks.push(
    ...PROHIBITED_RPC_GRANTS.map((grant) =>
      checkNoProhibitedRpcGrant(migrationsText, grant),
    ),
  );

  for (const required of [...REQUIRED_CODE_SNIPPETS, ...REQUIRED_ROUTE_TEST_SNIPPETS]) {
    checks.push(checkSnippet(readText(root, required.file), required));
  }

  return {
    ok: checks.every((check) => check.status === 'pass'),
    checks,
  };
}

function printResult(result: ContractVerificationResult): void {
  for (const check of result.checks) {
    const marker = check.status === 'pass' ? 'PASS' : 'FAIL';
    console.log(`${marker} ${check.name} - ${check.details}`);
  }

  const passed = result.checks.filter((check) => check.status === 'pass').length;
  console.log(`\n${passed}/${result.checks.length} knowledge ingestion contract checks passed.`);
}

if (require.main === module) {
  const result = runKnowledgeContractVerification();
  printResult(result);

  if (!result.ok) {
    process.exitCode = 1;
  }
}
