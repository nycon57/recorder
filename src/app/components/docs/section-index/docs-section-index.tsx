import Link from 'next/link';

import type { DocsSection, DocsPage } from '@/lib/docs';

interface DocsSectionIndexProps {
  section: DocsSection;
  pages: DocsPage[];
}

/**
 * Section index — shown when the slug matches a SectionId directly.
 * Lists all pages in the section visible to the current audience.
 */
export function DocsSectionIndex({ section, pages }: DocsSectionIndexProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--docs-text-muted)]">
          {section.id}
        </p>
        <h1 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold text-[color:var(--docs-text-primary)]">
          {section.title}
        </h1>
        {section.description && (
          <p className="text-base leading-relaxed text-[color:var(--docs-text-secondary)]">
            {section.description}
          </p>
        )}
      </header>

      {pages.length === 0 ? (
        <p className="text-sm text-[color:var(--docs-text-muted)]">
          No pages available in this section yet.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--docs-border)]">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/docs/${page.slug}`}
                className="group flex items-start justify-between gap-6 py-4 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[color:var(--docs-text-primary)] transition-colors group-hover:text-[color:var(--docs-amber)]">
                    {page.title}
                  </p>
                  {page.description && (
                    <p className="mt-0.5 truncate text-sm text-[color:var(--docs-text-secondary)]">
                      {page.description}
                    </p>
                  )}
                </div>
                <time
                  dateTime={page.updatedAt}
                  className="shrink-0 font-mono text-[11px] text-[color:var(--docs-text-muted)]"
                >
                  {page.updatedAt}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
