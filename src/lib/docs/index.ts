/**
 * Public surface of the docs library.
 *
 * Downstream consumers (TRIB-147, TRIB-150, TRIB-153, TRIB-154, TRIB-155)
 * should import exclusively from this barrel — never from sub-modules directly.
 */

// Types
export type {
  Audience,
  DocsPage,
  DocsSection,
  SectionId,
  DocsSource,
  DocsNavTree,
  DocsAudienceContext,
  DocsRegistry,
} from './types';

// Schema / validation
export { parseDocsPage } from './schema';

// Sections (static data)
export { SECTIONS } from './sections';

// Audience resolver
export { resolveDocsAudience } from './audience';

// Registry
export { getDocsRegistry } from './registry';

// Access control
export { resolveAccess } from './access';
export type { AccessDecision } from './access';

// Git adapter — page body lookup for rendering
export { findGitPageBody, clearGitPageCache } from './adapters/git';
export type { DocsPageWithBody } from './adapters/git';

// DB adapter — page body lookup for DB-backed pages
export { findDbPageBody } from './adapters/db';
export type { DbPageBody } from './adapters/db';
