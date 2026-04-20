import type { DocsPage } from '@/lib/docs';

interface DocsPlaceholderProps {
  page: DocsPage;
}

/**
 * Placeholder rendered for all docs pages until TRIB-150 ships real content.
 * Displays page metadata and a clear "coming soon" note in tribora styling.
 */
export function DocsPlaceholder({ page }: DocsPlaceholderProps) {
  return (
    <article className="mx-auto max-w-3xl py-12 px-6">
      {/* Page identity */}
      <header className="mb-10">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--docs-text-muted)]">
          {page.section} / {page.audience}
        </p>
        <h1 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-[color:var(--docs-text-primary)]">
          {page.title}
        </h1>
        {page.description && (
          <p className="text-lg leading-relaxed text-[color:var(--docs-text-secondary)]">
            {page.description}
          </p>
        )}
      </header>

      {/* Pipeline note */}
      <div className="rounded-md border border-[color:var(--docs-amber)]/30 bg-[color:var(--docs-amber)]/5 px-5 py-4">
        <p className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[color:var(--docs-amber)]">
          Content pipeline — TRIB-150
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[color:var(--docs-text-secondary)]">
          This page is registered and access-gated. Full content arrives when
          the documentation pipeline (TRIB-150) lands. Check back after that
          milestone ships.
        </p>
      </div>

      {/* Metadata strip */}
      <footer className="mt-10 border-t border-[color:var(--docs-border)] pt-6">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 font-mono text-xs text-[color:var(--docs-text-muted)] sm:grid-cols-3">
          <div>
            <dt className="uppercase tracking-[0.08em]">Slug</dt>
            <dd className="mt-0.5 text-[color:var(--docs-text-secondary)]">{page.slug}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.08em]">Updated</dt>
            <dd className="mt-0.5 text-[color:var(--docs-text-secondary)]">{page.updatedAt}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.08em]">Source</dt>
            <dd className="mt-0.5 text-[color:var(--docs-text-secondary)]">{page.source}</dd>
          </div>
          {page.tags && page.tags.length > 0 && (
            <div className="col-span-full">
              <dt className="uppercase tracking-[0.08em]">Tags</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1.5">
                {page.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-sm border border-[color:var(--docs-border)] px-1.5 py-0.5 text-[color:var(--docs-text-secondary)]"
                  >
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </footer>
    </article>
  );
}
