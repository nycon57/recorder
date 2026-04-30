import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { runLegacyRecallQuarantineVerification } from '../verify-legacy-recall-quarantine';

const FILES = [
  'src/app/api/chat/route.ts',
  'src/app/api/chat/stream/route.ts',
  'src/app/api/extension/query/route.ts',
  'src/lib/mcp/handlers.ts',
  'src/lib/mcp/server.ts',
  'src/lib/services/chat-tools.ts',
  'src/app/api/search/route.ts',
  'src/app/api/recordings/[id]/search/route.ts',
  'src/app/components/content/RelatedContent.tsx',
];

function writeFixture(root: string, relativePath: string, content: string): void {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function createCompleteFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'legacy-recall-quarantine-'));

  for (const file of FILES) {
    writeFixture(root, file, 'export const ok = true;');
  }

  writeFixture(
    root,
    'src/app/api/chat/route.ts',
    'import { resolveCompiledMemoryAnswerContext } from "@/lib/services/compiled-memory-answer-context";',
  );
  writeFixture(
    root,
    'src/app/api/chat/stream/route.ts',
    'import { generateCompiledMemoryGroundedAnswer } from "@/lib/services/compiled-memory-answer";',
  );
  writeFixture(
    root,
    'src/app/api/extension/query/route.ts',
    'import { resolveCompiledMemoryAnswerContext } from "@/lib/services/compiled-memory-answer-context";',
  );
  writeFixture(
    root,
    'src/lib/mcp/handlers.ts',
    'import { searchCompiledOrgWikiPages } from "@/lib/services/wiki-search";',
  );
  writeFixture(
    root,
    'src/lib/services/chat-tools.ts',
    'import { searchCompiledOrgWikiPages } from "./wiki-search";',
  );

  return root;
}

describe('legacy recall quarantine verification', () => {
  it('passes when production recall files use compiled memory/wiki services', () => {
    const result = runLegacyRecallQuarantineVerification(createCompleteFixture());

    expect(result.ok).toBe(true);
    expect(result.checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('fails when a production recall file imports legacy RAG/vector modules', () => {
    const root = createCompleteFixture();
    writeFixture(
      root,
      'src/app/api/chat/route.ts',
      [
        'import { retrieveContext } from "@/lib/services/rag-google";',
        'import { resolveCompiledMemoryAnswerContext } from "@/lib/services/compiled-memory-answer-context";',
      ].join('\n'),
    );

    const result = runLegacyRecallQuarantineVerification(root);

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        name: 'src/app/api/chat/route.ts has no legacy recall import',
        status: 'fail',
      }),
    );
  });

  it('fails when an unregistered production entrypoint imports legacy RAG/vector modules', () => {
    const root = createCompleteFixture();
    writeFixture(
      root,
      'src/app/api/unregistered/route.ts',
      'import { vectorSearch } from "@/lib/services/vector-search-google";',
    );

    const result = runLegacyRecallQuarantineVerification(root);

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        name: 'production legacy recall imports are registered',
        status: 'fail',
      }),
    );
  });
});
