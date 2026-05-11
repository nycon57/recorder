import type { PoolClient } from 'pg';

import { seedOrganization } from './seeders/organization.js';
import { seedDepartments } from './seeders/departments.js';
import { seedUsers } from './seeders/users.js';
import { seedMembers } from './seeders/members.js';
import { seedTags } from './seeders/tags.js';
import { seedConnector } from './seeders/connector.js';
import { seedRecordings } from './seeders/recordings.js';
import { seedWiki } from './seeders/wiki.js';
import { seedImportedDocs } from './seeders/imported-docs.js';
import { seedKnowledgeGaps } from './seeders/knowledge-gaps.js';
import { seedShares } from './seeders/shares.js';
import { seedVendorOrg } from './seeders/vendor-org.js';
import { seedOrgSettings } from './seeders/org-settings.js';
import {
  DEMO_DEPARTMENTS,
  DEMO_IMPORTED_DOC_SLUGS,
  DEMO_ORG,
  DEMO_RECORDING_SLUGS,
  DEMO_TAG_NAMES,
  DEMO_USERS,
  DEMO_WIKI_PAGE_SLUGS,
} from './fixtures.js';

type SeedStep = () => Promise<unknown>;

function runSeedSteps(steps: SeedStep[]): Promise<void> {
  return steps
    .reduce<
      Promise<unknown>
    >((chain, step) => chain.then(() => step()), Promise.resolve())
    .then(() => undefined);
}

export async function seed(
  client: PoolClient,
  opts: { dryRun: boolean; forceReseed: boolean },
): Promise<void> {
  const { dryRun, forceReseed } = opts;

  if (dryRun) {
    // Dry-run path: log planned writes, no mutations.
    await runSeedSteps([
      () => seedOrganization(client, { dryRun: true, forceReseed }),
      () => seedDepartments(client, { dryRun: true }),
      () => seedUsers(client, { dryRun: true, forceReseed, departmentMap: {} }),
      () => seedMembers(client, { dryRun: true }),
      () => seedTags(client, { dryRun: true }),
      () => seedConnector(client, { dryRun: true }),
      () => seedRecordings(client, { dryRun: true, forceReseed }),
      () => seedWiki(client, { dryRun: true }),
      () => seedImportedDocs(client, { dryRun: true }),
      () => seedKnowledgeGaps(client, { dryRun: true, forceReseed }),
      () => seedShares(client, { dryRun: true, forceReseed }),
      () => seedVendorOrg(client, { dryRun: true }),
      () => seedOrgSettings(client, { dryRun: true }),
    ]);
    return;
  }

  // §11 ordering: org -> departments -> users -> members -> tags -> recordings
  // -> wiki (refs recordings) -> connector -> imported-docs -> knowledge-gaps
  // -> shares -> vendor-org -> org-settings
  await client.query('BEGIN');

  try {
    let departmentMap: Awaited<ReturnType<typeof seedDepartments>> = {};
    await runSeedSteps([
      () => seedOrganization(client, { dryRun: false, forceReseed }),
      () =>
        seedDepartments(client, { dryRun: false }).then((result) => {
          departmentMap = result;
        }),
      () => seedUsers(client, { dryRun: false, forceReseed, departmentMap }),
      () => seedMembers(client, { dryRun: false }),
      () => seedTags(client, { dryRun: false }),
      () => seedRecordings(client, { dryRun: false, forceReseed }),
      () => seedWiki(client, { dryRun: false }),
      () => seedConnector(client, { dryRun: false }),
      () => seedImportedDocs(client, { dryRun: false }),
      () => seedKnowledgeGaps(client, { dryRun: false, forceReseed }),
      () => seedShares(client, { dryRun: false, forceReseed }),
      () => seedVendorOrg(client, { dryRun: false }),
      () => seedOrgSettings(client, { dryRun: false }),
    ]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[demo-seed] ROLLBACK - transaction failed:', err);
    throw err;
  }

  console.log('\n[demo-seed] Seed complete.');
  console.log(`  Organization:   ${DEMO_ORG.name}`);
  console.log(`  Departments:    ${DEMO_DEPARTMENTS.length}`);
  console.log(`  Users:          ${DEMO_USERS.length}`);
  console.log(`  Tags:           ${DEMO_TAG_NAMES.length}`);
  console.log(`  Recordings:     ${DEMO_RECORDING_SLUGS.length}`);
  console.log(`  Wiki pages:     ${DEMO_WIKI_PAGE_SLUGS.length}`);
  console.log(`  Imported docs:  ${DEMO_IMPORTED_DOC_SLUGS.length}`);
  console.log(`\n  Roster:`);
  for (const u of DEMO_USERS) {
    console.log(`    ${u.role.padEnd(12)} ${u.name} <${u.email}>`);
  }
  console.log('');
  console.log('  Note: Embeddings are zero-vector placeholders.');
  console.log(
    '        Run `npm run demo:reembed` (follow-up ticket) for real vectors.',
  );
  console.log('        R2 paths are DB-only - playback 404s are expected.');
}
