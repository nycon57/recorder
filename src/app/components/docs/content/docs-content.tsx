import Link from 'next/link';
import parse from 'html-react-parser';

import type { DocsPage } from '@/lib/docs';

interface DocsContentProps {
  page: DocsPage;
  bodyHtml: string;
  related: DocsPage[];
}

const AUDIENCE_LABEL: Record<DocsPage['audience'], string> = {
  public: 'Public',
  'org-admin': 'Org Admin',
  'system-admin': 'System Admin',
};

/**
 * DocsContent — server component that renders a compiled docs page.
 *
 * SECURITY: bodyHtml is safe to render because:
 *   1. `rehype-sanitize` (with a restrictive default schema) ran at build time in
 *      `scripts/docs/build.ts`, removing all script tags, on* handlers, and
 *      unsafely-attributed elements.
 *   2. The compiled HTML is stored in the manifest JSON and Zod-validated
 *      (parseDocsPage) at every manifest load in `adapters/git.ts`.
 *   3. Authors write Markdown, not raw HTML — the pipeline never passes raw HTML
 *      directly; it compiles MD → AST → sanitised HTML.
 *
 * See plan §7 / §8 and the rehype-sanitize configuration in compile-markdown.ts.
 */
export function DocsContent({ page, bodyHtml, related }: DocsContentProps) {
  return (
    <article className="mx-auto max-w-3xl py-12 px-6">
      {/* Page header */}
      <header className="mb-10">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--docs-text-muted)]">
          <span className="text-[color:var(--docs-amber)]">§</span>{' '}
          {page.section}
          {' / '}
          <span>{AUDIENCE_LABEL[page.audience]}</span>
        </p>

        <h1 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-semibold leading-tight text-[color:var(--docs-text-primary)]">
          {page.title}
        </h1>

        {page.description && (
          <p className="text-lg leading-relaxed text-[color:var(--docs-text-secondary)]">
            {page.description}
          </p>
        )}

        {/* Metadata strip */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="font-mono text-xs text-[color:var(--docs-text-muted)]">
            Updated{' '}
            <time dateTime={page.updatedAt} className="text-[color:var(--docs-text-secondary)]">
              {page.updatedAt}
            </time>
          </span>

          {page.tags && page.tags.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {page.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm border border-[color:var(--docs-border)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--docs-text-secondary)]"
                >
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </header>

      {/* Divider */}
      <hr className="mb-10 border-[color:var(--docs-border)]" />

      {/* Body — pre-compiled and sanitised at build time */}
      {/* nosemgrep: react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      <div className="docs-prose">{parse(bodyHtml)}</div>

      {/* Related pages */}
      {related.length > 0 && (
        <footer className="mt-14 border-t border-[color:var(--docs-border)] pt-8">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--docs-text-muted)]">
            <span className="text-[color:var(--docs-amber)]">§</span> Related
          </p>
          <ul className="space-y-2">
            {related.map((rel) => (
              <li key={rel.slug}>
                <Link
                  href={`/docs/${rel.slug}`}
                  className="group flex items-start gap-3 rounded-md border border-[color:var(--docs-border)] bg-[color:var(--docs-surface)] px-4 py-3 transition-colors hover:border-[color:var(--docs-amber)]/40 hover:bg-[color:var(--docs-surface-hover)]"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] text-[color:var(--docs-text-muted)] transition-colors group-hover:text-[color:var(--docs-amber)]">
                    →
                  </span>
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[color:var(--docs-text-primary)] transition-colors group-hover:text-[color:var(--docs-amber)]">
                      {rel.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--docs-text-secondary)]">
                      {rel.description}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}
