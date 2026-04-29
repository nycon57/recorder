#!/usr/bin/env tsx

import { resolve } from 'path';

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

import { generateOrgWikiPageEmbeddingBestEffort } from '@/lib/services/org-wiki-embedding';

config({ path: resolve(process.cwd(), '.env.local') });

interface Args {
  write: boolean;
  force: boolean;
  orgId: string | null;
  limit: number;
  concurrency: number;
}

interface OrgWikiPageForBackfill {
  id: string;
  org_id: string;
  topic: string | null;
  embedding: unknown | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    write: false,
    force: false,
    orgId: null,
    limit: 100,
    concurrency: 2,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--dry-run') {
      args.write = false;
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg === '--org-id' && next) {
      args.orgId = next;
      index += 1;
    } else if (arg.startsWith('--org-id=')) {
      args.orgId = arg.slice('--org-id='.length);
    } else if (arg === '--limit' && next) {
      args.limit = Number(next);
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      args.limit = Number(arg.slice('--limit='.length));
    } else if (arg === '--concurrency' && next) {
      args.concurrency = Number(next);
      index += 1;
    } else if (arg.startsWith('--concurrency=')) {
      args.concurrency = Number(arg.slice('--concurrency='.length));
    }
  }

  args.limit = Number.isFinite(args.limit) && args.limit > 0
    ? Math.min(Math.floor(args.limit), 1000)
    : 100;
  args.concurrency = Number.isFinite(args.concurrency) && args.concurrency > 0
    ? Math.min(Math.floor(args.concurrency), 5)
    : 2;

  return args;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<boolean>
): Promise<{ ok: number; failed: number }> {
  let cursor = 0;
  let ok = 0;
  let failed = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const success = await worker(items[index], index);
      if (success) {
        ok += 1;
      } else {
        failed += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runNext())
  );

  return { ok, failed };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let query = supabase
    .from('org_wiki_pages')
    .select('id, org_id, topic, embedding')
    .is('valid_until', null)
    .order('updated_at', { ascending: false })
    .limit(args.limit);

  if (args.orgId) {
    query = query.eq('org_id', args.orgId);
  }

  if (!args.force) {
    query = query.is('embedding', null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load org_wiki_pages rows: ${error.message}`);
  }

  const pages = (data ?? []) as OrgWikiPageForBackfill[];
  const mode = args.write ? 'write' : 'dry-run';
  console.log(
    `Org wiki embedding backfill (${mode}): ${pages.length} active page(s), ` +
      `force=${args.force}, limit=${args.limit}, concurrency=${args.concurrency}`
  );

  if (!args.write) {
    for (const page of pages) {
      console.log(
        `[dry-run] Would ${args.force ? 'regenerate' : 'generate'} embedding for ` +
          `${page.id} (${page.org_id}, ${page.topic ?? 'untitled'})`
      );
    }
    return;
  }

  const result = await runWithConcurrency(
    pages,
    args.concurrency,
    async (page, index) => {
      console.log(
        `[${index + 1}/${pages.length}] Generating embedding for ${page.id} ` +
          `(${page.topic ?? 'untitled'})`
      );
      return generateOrgWikiPageEmbeddingBestEffort(page.id, {
        source: 'script.backfill-org-wiki-embeddings',
        orgId: page.org_id,
        topic: page.topic,
        force: args.force,
      });
    }
  );

  console.log(`Backfill complete: ${result.ok} succeeded, ${result.failed} failed`);
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
