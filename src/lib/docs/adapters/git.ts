/**
 * Git-backed docs adapter.
 *
 * Stub — TRIB-150 lands the real implementation.
 * That ticket writes `src/lib/docs/generated/manifest.json` at build time
 * (via `git log --follow` per file) and this adapter will import + parse it
 * with `parseDocsPage` from `../schema`.
 *
 * Returns an empty array until TRIB-150 is merged.
 */
import type { DocsPage } from '../types';

export async function loadGitPages(): Promise<DocsPage[]> {
  return [];
}
