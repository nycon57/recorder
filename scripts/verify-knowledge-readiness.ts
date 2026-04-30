import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  runKnowledgeContractVerification,
  type ContractCheck,
} from './verify-knowledge-contracts';

type CheckStatus = 'pass' | 'fail';

export interface ReadinessCheck {
  name: string;
  status: CheckStatus;
  details: string;
}

interface FixtureIds {
  orgId: string;
  userId: string;
  contentId: string;
  transcriptId: string;
  documentId: string;
  docJobId: string;
  compileJobId: string;
  wikiPageId: string;
  wikiSourceId: string;
  relationshipId: string;
}

interface ContentRow {
  id: string;
  org_id: string;
  created_by: string;
  title: string;
  status: string;
  content_type: 'text';
}

interface TranscriptRow {
  id: string;
  content_id: string;
  text: string;
  provider: 'user_input';
}

interface DocumentRow {
  id: string;
  content_id: string;
  org_id: string;
  title: string;
  content: string;
}

interface JobRow {
  id: string;
  type: 'doc_generate' | 'compile_wiki';
  status: 'pending' | 'processing' | 'completed';
  content_id: string;
  payload: Record<string, string>;
  dedupe_key: string;
}

interface WikiPageRow {
  id: string;
  org_id: string;
  topic: string;
  content: string;
  status: 'active';
}

interface WikiPageSourceRow {
  id: string;
  wiki_page_id: string;
  source_id: string;
  source_type: 'content';
  contribution_summary: string;
}

interface WikiRelationshipRow {
  id: string;
  org_id: string;
  source_page_id: string;
  target_page_id: string;
  relationship_type: 'supports';
  summary: string;
}

interface Citation {
  sourceId: string;
  title: string;
  layer: 'customer';
}

interface RecallResult {
  answer: string;
  citations: Citation[];
}

interface ReadinessStore {
  content: ContentRow[];
  transcripts: TranscriptRow[];
  documents: DocumentRow[];
  jobs: JobRow[];
  orgWikiPages: WikiPageRow[];
  wikiPageSources: WikiPageSourceRow[];
  wikiRelationships: WikiRelationshipRow[];
}

export interface KnowledgeReadinessArtifact {
  ok: boolean;
  generatedAt: string;
  mode: 'deterministic-no-provider';
  fixture: FixtureIds;
  checks: ReadinessCheck[];
  contractChecks: ContractCheck[];
  tableCounts: Record<keyof ReadinessStore, number>;
  recall: RecallResult;
}

interface RunOptions {
  root?: string;
  artifactPath?: string;
  now?: Date;
  writeArtifact?: boolean;
}

const FIXTURE: FixtureIds = {
  orgId: 'org_readiness_001',
  userId: 'user_readiness_owner_001',
  contentId: 'content_readiness_text_001',
  transcriptId: 'transcript_readiness_001',
  documentId: 'document_readiness_001',
  docJobId: 'job_readiness_doc_generate_001',
  compileJobId: 'job_readiness_compile_wiki_001',
  wikiPageId: 'wiki_page_readiness_001',
  wikiSourceId: 'wiki_source_readiness_001',
  relationshipId: 'wiki_relationship_readiness_001',
};

const FIXTURE_TEXT = [
  'Acme Support must route enterprise billing escalations to the Priority Revenue desk.',
  'The required escalation code is PRD-42 and the customer success owner must be copied.',
].join(' ');

function createEmptyStore(): ReadinessStore {
  return {
    content: [],
    transcripts: [],
    documents: [],
    jobs: [],
    orgWikiPages: [],
    wikiPageSources: [],
    wikiRelationships: [],
  };
}

function createFirstPartyTextNote(store: ReadinessStore): void {
  store.content.push({
    id: FIXTURE.contentId,
    org_id: FIXTURE.orgId,
    created_by: FIXTURE.userId,
    title: 'Readiness billing escalation note',
    status: 'document_generating',
    content_type: 'text',
  });

  store.transcripts.push({
    id: FIXTURE.transcriptId,
    content_id: FIXTURE.contentId,
    text: FIXTURE_TEXT,
    provider: 'user_input',
  });

  store.jobs.push({
    id: FIXTURE.docJobId,
    type: 'doc_generate',
    status: 'pending',
    content_id: FIXTURE.contentId,
    payload: {
      recordingId: FIXTURE.contentId,
      transcriptId: FIXTURE.transcriptId,
      orgId: FIXTURE.orgId,
      contentType: 'text',
    },
    dedupe_key: `doc_generate:${FIXTURE.contentId}`,
  });
}

function runDocGenerateWorkerOnce(store: ReadinessStore): void {
  const job = store.jobs.find((candidate) => candidate.id === FIXTURE.docJobId);
  const transcript = store.transcripts.find(
    (candidate) => candidate.id === FIXTURE.transcriptId,
  );

  if (!job || !transcript) {
    throw new Error('Readiness fixture is missing the doc_generate job or transcript.');
  }

  job.status = 'processing';
  store.documents.push({
    id: FIXTURE.documentId,
    content_id: FIXTURE.contentId,
    org_id: FIXTURE.orgId,
    title: 'Readiness billing escalation note',
    content: `# Billing Escalation\n\n${transcript.text}`,
  });
  job.status = 'completed';

  store.jobs.push({
    id: FIXTURE.compileJobId,
    type: 'compile_wiki',
    status: 'pending',
    content_id: FIXTURE.contentId,
    payload: {
      recordingId: FIXTURE.contentId,
      contentId: FIXTURE.contentId,
      orgId: FIXTURE.orgId,
      sourceType: 'text',
    },
    dedupe_key: `compile_wiki:${FIXTURE.contentId}`,
  });
}

function runCompileWikiWorkerOnce(store: ReadinessStore): void {
  const job = store.jobs.find((candidate) => candidate.id === FIXTURE.compileJobId);
  const document = store.documents.find(
    (candidate) => candidate.id === FIXTURE.documentId,
  );

  if (!job || !document) {
    throw new Error('Readiness fixture is missing the compile_wiki job or document.');
  }

  job.status = 'processing';
  store.orgWikiPages.push({
    id: FIXTURE.wikiPageId,
    org_id: FIXTURE.orgId,
    topic: 'Enterprise billing escalation',
    content: document.content,
    status: 'active',
  });
  store.wikiPageSources.push({
    id: FIXTURE.wikiSourceId,
    wiki_page_id: FIXTURE.wikiPageId,
    source_id: FIXTURE.contentId,
    source_type: 'content',
    contribution_summary: 'Seed text note produced the billing escalation Wiki page.',
  });
  store.wikiRelationships.push({
    id: FIXTURE.relationshipId,
    org_id: FIXTURE.orgId,
    source_page_id: FIXTURE.wikiPageId,
    target_page_id: FIXTURE.wikiPageId,
    relationship_type: 'supports',
    summary: 'The source note supports the compiled billing escalation page.',
  });
  job.status = 'completed';
}

function recallFromCompiledWiki(store: ReadinessStore, question: string): RecallResult {
  const normalizedQuestion = question.toLowerCase();
  const page = store.orgWikiPages.find(
    (candidate) =>
      candidate.org_id === FIXTURE.orgId &&
      candidate.status === 'active' &&
      (candidate.content.toLowerCase().includes('prd-42') ||
        normalizedQuestion.includes('billing')),
  );

  if (!page) {
    return { answer: 'No matching customer knowledge found.', citations: [] };
  }

  return {
    answer:
      'Enterprise billing escalations route to the Priority Revenue desk with code PRD-42.',
    citations: [
      {
        sourceId: page.id,
        title: page.topic,
        layer: 'customer',
      },
    ],
  };
}

function pass(name: string, details: string): ReadinessCheck {
  return { name, details, status: 'pass' };
}

function fail(name: string, details: string): ReadinessCheck {
  return { name, details, status: 'fail' };
}

function expectOne(
  name: string,
  details: string,
  rows: unknown[],
): ReadinessCheck {
  return rows.length === 1
    ? pass(name, details)
    : fail(name, `Expected one row, found ${rows.length}.`);
}

function runScenarioChecks(
  store: ReadinessStore,
  recall: RecallResult,
): ReadinessCheck[] {
  const docJob = store.jobs.find((job) => job.id === FIXTURE.docJobId);
  const compileJob = store.jobs.find((job) => job.id === FIXTURE.compileJobId);

  return [
    expectOne(
      'disposable first-party content fixture is seeded',
      'Created one org-scoped text content row for the disposable readiness fixture.',
      store.content,
    ),
    expectOne(
      'API-boundary text note creates a transcript',
      'Created one user-input transcript linked to the text content row.',
      store.transcripts,
    ),
    docJob?.dedupe_key === `doc_generate:${FIXTURE.contentId}`
      ? pass(
          'API-boundary text note queues doc generation',
          'Queued doc_generate with the canonical first-party content dedupe key.',
        )
      : fail('API-boundary text note queues doc generation', 'Missing doc_generate job.'),
    docJob?.status === 'completed'
      ? pass('doc_generate worker completes once', 'The deterministic worker pass completed the document job.')
      : fail('doc_generate worker completes once', 'doc_generate did not complete.'),
    compileJob?.dedupe_key === `compile_wiki:${FIXTURE.contentId}`
      ? pass(
          'doc_generate queues compiled Wiki work',
          'Queued compile_wiki with the canonical first-party content dedupe key.',
        )
      : fail('doc_generate queues compiled Wiki work', 'Missing compile_wiki job.'),
    compileJob?.status === 'completed'
      ? pass('compile_wiki worker completes once', 'The deterministic worker pass completed Wiki compilation.')
      : fail('compile_wiki worker completes once', 'compile_wiki did not complete.'),
    expectOne(
      'compiled Wiki page is written',
      'Created one active org_wiki_pages row for the fixture organization.',
      store.orgWikiPages,
    ),
    expectOne(
      'compiled Wiki source link is written',
      'Created one wiki_page_sources row linking the Wiki page to first-party content.',
      store.wikiPageSources,
    ),
    expectOne(
      'compiled Wiki relationship is written',
      'Created one wiki_relationships row for graph/readiness coverage.',
      store.wikiRelationships,
    ),
    recall.citations.some(
      (citation) =>
        citation.sourceId === FIXTURE.wikiPageId && citation.layer === 'customer',
    )
      ? pass(
          'recall returns a customer citation',
          'The recall assertion returned source metadata for the seeded Wiki page.',
        )
      : fail('recall returns a customer citation', 'No customer Wiki citation returned.'),
  ];
}

function tableCounts(store: ReadinessStore): KnowledgeReadinessArtifact['tableCounts'] {
  return {
    content: store.content.length,
    transcripts: store.transcripts.length,
    documents: store.documents.length,
    jobs: store.jobs.length,
    orgWikiPages: store.orgWikiPages.length,
    wikiPageSources: store.wikiPageSources.length,
    wikiRelationships: store.wikiRelationships.length,
  };
}

function defaultArtifactPath(root: string): string {
  return path.join(root, 'tmp', 'knowledge-readiness-report.json');
}

function writeArtifact(artifactPath: string, artifact: KnowledgeReadinessArtifact): void {
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
}

export function runKnowledgeReadiness(
  options: RunOptions = {},
): KnowledgeReadinessArtifact {
  const root = options.root ?? process.cwd();
  const contractResult = runKnowledgeContractVerification(root);
  const store = createEmptyStore();

  createFirstPartyTextNote(store);
  runDocGenerateWorkerOnce(store);
  runCompileWikiWorkerOnce(store);

  const recall = recallFromCompiledWiki(
    store,
    'Where should enterprise billing escalations go?',
  );
  const checks = runScenarioChecks(store, recall);
  const artifact: KnowledgeReadinessArtifact = {
    ok: contractResult.ok && checks.every((check) => check.status === 'pass'),
    generatedAt: (options.now ?? new Date()).toISOString(),
    mode: 'deterministic-no-provider',
    fixture: FIXTURE,
    checks,
    contractChecks: contractResult.checks,
    tableCounts: tableCounts(store),
    recall,
  };

  if (options.writeArtifact !== false) {
    writeArtifact(options.artifactPath ?? defaultArtifactPath(root), artifact);
  }

  return artifact;
}

function printResult(artifact: KnowledgeReadinessArtifact, artifactPath: string): void {
  for (const check of [...artifact.contractChecks, ...artifact.checks]) {
    const marker = check.status === 'pass' ? 'PASS' : 'FAIL';
    console.log(`${marker} ${check.name} - ${check.details}`);
  }

  const passed =
    artifact.contractChecks.filter((check) => check.status === 'pass').length +
    artifact.checks.filter((check) => check.status === 'pass').length;
  const total = artifact.contractChecks.length + artifact.checks.length;

  console.log(`\n${passed}/${total} first-party knowledge readiness checks passed.`);
  console.log(`Artifact: ${artifactPath}`);
}

if (require.main === module) {
  const artifactPath = process.env.KNOWLEDGE_READINESS_ARTIFACT
    ? path.resolve(process.env.KNOWLEDGE_READINESS_ARTIFACT)
    : defaultArtifactPath(process.cwd());
  const artifact = runKnowledgeReadiness({ artifactPath });

  printResult(artifact, artifactPath);

  if (!artifact.ok) {
    process.exitCode = 1;
  }
}
