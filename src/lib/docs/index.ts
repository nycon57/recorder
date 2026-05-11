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
  DocsNavTree,
} from './types';// Audience resolver
export { resolveDocsAudience } from './audience';

// Registry
export { getDocsRegistry } from './registry';

// Access control
export { resolveAccess } from './access';
// Git adapter — page body lookup for rendering
export { findGitPageBody } from './adapters/git';