import Link from 'next/link';

import type { Audience, DocsSection } from '@/lib/docs';

interface DocsLandingProps {
  audience: Audience;
  sections: DocsSection[];
}

/**
 * Landing page for the bare /docs route.
 * Audience-aware: shows only sections the caller can access.
 */
export function DocsLanding({ audience, sections }: DocsLandingProps) {
  const isElevated = audience === 'org-admin' || audience === 'system-admin';

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Hero */}
      <header className="mb-12">
        <h1 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-4xl font-semibold tracking-tight text-[color:var(--docs-text-primary)]">
          Tribora Documentation
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-[color:var(--docs-text-secondary)]">
          {isElevated
            ? 'Full documentation for administrators — platform guides, runbooks, and organization management.'
            : 'Install, configure, and master Tribora — the knowledge intelligence layer for your team.'}
        </p>
      </header>

      {/* Section cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={`/docs/${section.id}`}
            className="group rounded-md border border-[color:var(--docs-border)] bg-[color:var(--docs-surface)] p-5 transition-colors hover:border-[color:var(--docs-amber)]/40 hover:bg-[color:var(--docs-surface-hover)]"
          >
            <h2 className="mb-1.5 font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[color:var(--docs-text-primary)] transition-colors group-hover:text-[color:var(--docs-amber)]">
              {section.title}
            </h2>
            {section.description && (
              <p className="text-sm leading-relaxed text-[color:var(--docs-text-secondary)]">
                {section.description}
              </p>
            )}
          </Link>
        ))}
      </div>

      {/* Elevated-audience note */}
      {audience === 'system-admin' && (
        <aside className="mt-10 rounded-md border border-[color:var(--docs-amber)]/30 bg-[color:var(--docs-amber)]/5 px-5 py-4">
          <p className="text-sm text-[color:var(--docs-text-secondary)]">
            You are viewing as{' '}
            <span className="font-mono font-semibold text-[color:var(--docs-amber)]">
              system-admin
            </span>
            . All sections, including platform runbooks and security operations,
            are visible to you.
          </p>
        </aside>
      )}
    </div>
  );
}
