/**
 * Database-backed docs adapter.
 *
 * Stub — TRIB-154 lands the real implementation.
 * That ticket creates the `docs_pages` migration and wires up the
 * Supabase admin client query + `parseDocsPage` validation here.
 *
 * Returns an empty array until TRIB-154 is merged.
 */
import type { DocsPage } from '../types';

export async function loadDbPages(): Promise<DocsPage[]> {
  return [];
}
