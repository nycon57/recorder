import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type CheckStatus = 'pass' | 'fail';

interface QuarantineCheck {
  name: string;
  status: CheckStatus;
  details: string;
}

interface QuarantineVerificationResult {
  ok: boolean;
  checks: QuarantineCheck[];
}

const PRODUCTION_ANSWER_RECALL_FILES = [
  'src/app/api/chat/route.ts',
  'src/app/api/chat/stream/route.ts',
  'src/app/api/extension/query/route.ts',
  'src/lib/mcp/handlers.ts',
  'src/lib/mcp/server.ts',
  'src/lib/services/chat-tools.ts',
];

const PRODUCTION_ENTRYPOINT_ROOTS = [
  'src/app/api',
  'src/app/components/content',
  'src/lib/mcp',
  'src/lib/services/chat-tools.ts',
];

const RAW_EVIDENCE_ALLOWLIST: Record<string, string> = {
  'src/app/api/search/route.ts':
    'Dedicated raw-evidence search endpoint; not used as canonical answer context.',
  'src/app/api/recordings/[id]/search/route.ts':
    'Recording-local exact evidence search endpoint.',
  'src/app/components/content/RelatedContent.tsx':
    'Related-content fallback surface; not chat answer context.',
};

const PROHIBITED_RECALL_IMPORTS = [
  '@/lib/services/rag',
  '@/lib/services/rag-google',
  '@/lib/services/chat-rag-integration',
  '@/lib/services/agentic-retrieval',
  '@/lib/services/vector-search',
  '@/lib/services/vector-search-google',
  './rag',
  './rag-google',
  './chat-rag-integration',
  './agentic-retrieval',
  './vector-search',
  './vector-search-google',
  '../rag',
  '../rag-google',
  '../chat-rag-integration',
  '../agentic-retrieval',
  '../vector-search',
  '../vector-search-google',
];

const REQUIRED_CANONICAL_SNIPPETS = [
  {
    file: 'src/app/api/chat/route.ts',
    snippet: 'resolveCompiledMemoryAnswerContext',
    details: 'Dashboard chat resolves answer context through compiled memory.',
  },
  {
    file: 'src/app/api/chat/stream/route.ts',
    snippet: 'generateCompiledMemoryGroundedAnswer',
    details: 'Legacy streaming chat answers from compiled-memory context.',
  },
  {
    file: 'src/app/api/extension/query/route.ts',
    snippet: 'resolveCompiledMemoryAnswerContext',
    details: 'Extension query remains on compiled memory.',
  },
  {
    file: 'src/lib/mcp/handlers.ts',
    snippet: 'searchCompiledOrgWikiPages',
    details: 'MCP knowledge search uses compiled Wiki pages.',
  },
  {
    file: 'src/lib/services/chat-tools.ts',
    snippet: 'searchCompiledOrgWikiPages',
    details: 'Dashboard chat discovery tool uses compiled Wiki pages.',
  },
];

function pass(name: string, details: string): QuarantineCheck {
  return { name, status: 'pass', details };
}

function fail(name: string, details: string): QuarantineCheck {
  return { name, status: 'fail', details };
}

function readRequiredFile(root: string, relativePath: string): string {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function walkProductionFiles(root: string, relativePath: string): string[] {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  if (statSync(absolutePath).isFile()) {
    return [relativePath];
  }

  return readdirSync(absolutePath).flatMap((entry) => {
    if (entry === '__tests__' || entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) {
      return [];
    }

    const childRelativePath = path.join(relativePath, entry);
    const childAbsolutePath = path.join(root, childRelativePath);
    if (statSync(childAbsolutePath).isDirectory()) {
      return walkProductionFiles(root, childRelativePath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [childRelativePath] : [];
  });
}

function importPattern(importPath: string): RegExp {
  return new RegExp(
    String.raw`from\s+['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
  );
}

function checkNoLegacyImport(root: string, relativePath: string): QuarantineCheck {
  const text = readRequiredFile(root, relativePath);
  const prohibited = PROHIBITED_RECALL_IMPORTS.find((importPath) =>
    importPattern(importPath).test(text),
  );

  return prohibited
    ? fail(
        `${relativePath} has no legacy recall import`,
        `Found prohibited production recall import: ${prohibited}`,
      )
    : pass(
        `${relativePath} has no legacy recall import`,
        'Production recall file does not import legacy RAG/vector recall modules.',
      );
}

function findLegacyImport(text: string): string | undefined {
  return PROHIBITED_RECALL_IMPORTS.find((importPath) =>
    importPattern(importPath).test(text),
  );
}

function checkLegacyProductionImportsRegistered(root: string): QuarantineCheck {
  const files = Array.from(
    new Set(
      PRODUCTION_ENTRYPOINT_ROOTS.flatMap((entrypoint) =>
        walkProductionFiles(root, entrypoint),
      ),
    ),
  );

  const unregisteredImports = files.flatMap((file) => {
    const absolutePath = path.join(root, file);
    const text = readFileSync(absolutePath, 'utf8');
    const prohibited = findLegacyImport(text);

    if (!prohibited || PRODUCTION_ANSWER_RECALL_FILES.includes(file)) {
      return [];
    }

    return RAW_EVIDENCE_ALLOWLIST[file] == null
      ? [`${file} -> ${prohibited}`]
      : [];
  });

  return unregisteredImports.length > 0
    ? fail(
        'production legacy recall imports are registered',
        `Found unregistered production legacy imports: ${unregisteredImports.join(', ')}`,
      )
    : pass(
        'production legacy recall imports are registered',
        'All remaining production legacy imports are explicit raw-evidence/compatibility allowlist entries.',
      );
}

function checkRawEvidenceAllowlistDocumented(root: string): QuarantineCheck {
  const missingEntries = Object.keys(RAW_EVIDENCE_ALLOWLIST).filter(
    (file) => !existsSync(path.join(root, file)),
  );

  return missingEntries.length > 0
    ? fail(
        'raw-evidence allowlist is documented',
        `Allowlist references missing production file(s): ${missingEntries.join(', ')}`,
      )
    : pass(
        'raw-evidence allowlist is documented',
        `${Object.keys(RAW_EVIDENCE_ALLOWLIST).length} raw-evidence/compatibility production entries are documented separately from answer recall.`,
      );
}

function checkRequiredSnippet(
  root: string,
  required: (typeof REQUIRED_CANONICAL_SNIPPETS)[number],
): QuarantineCheck {
  const text = readRequiredFile(root, required.file);
  return text.includes(required.snippet)
    ? pass(`${required.file} uses canonical recall`, required.details)
    : fail(
        `${required.file} uses canonical recall`,
        `Missing canonical snippet "${required.snippet}".`,
      );
}

export function runLegacyRecallQuarantineVerification(
  root = process.cwd(),
): QuarantineVerificationResult {
  const checks = [
    ...PRODUCTION_ANSWER_RECALL_FILES.map((file) =>
      checkNoLegacyImport(root, file),
    ),
    ...REQUIRED_CANONICAL_SNIPPETS.map((required) =>
      checkRequiredSnippet(root, required),
    ),
    checkLegacyProductionImportsRegistered(root),
    checkRawEvidenceAllowlistDocumented(root),
  ];

  return {
    ok: checks.every((check) => check.status === 'pass'),
    checks,
  };
}

function printResult(result: QuarantineVerificationResult): void {
  for (const check of result.checks) {
    const marker = check.status === 'pass' ? 'PASS' : 'FAIL';
    console.log(`${marker} ${check.name} - ${check.details}`);
  }

  const passed = result.checks.filter((check) => check.status === 'pass').length;
  console.log(`\n${passed}/${result.checks.length} legacy recall quarantine checks passed.`);
}

if (require.main === module) {
  const result = runLegacyRecallQuarantineVerification();
  printResult(result);

  if (!result.ok) {
    process.exitCode = 1;
  }
}
