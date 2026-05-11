import { headers } from 'next/headers';

import { Footer } from '@/app/components/layout';
import { resolveDocsAudience, getDocsRegistry } from '@/lib/docs';
import { DocsNav } from '@/app/components/docs/nav/docs-nav';
import { DocsHeader } from '@/app/components/docs/shell/docs-header';
import { DocsSearchProvider } from '@/app/components/docs/search/docs-search-context';
import { DocsSearch } from '@/app/components/docs/search/docs-search';
import '@/app/components/docs/docs.css';

// Gating is page-level. Layout never redirects or 404s.
export const dynamic = 'force-dynamic';

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const [{ audience }, registry] = await Promise.all([
    resolveDocsAudience(reqHeaders),
    getDocsRegistry(),
  ]);
  const navTree = registry.buildNavigation(audience);

  return (
    <DocsSearchProvider audience={audience}>
      <div className="docs flex min-h-screen flex-col bg-[color:var(--docs-surface)] text-[color:var(--docs-text-primary)]">
        <div className="flex flex-1">
          {/* Sidebar — hidden on small screens */}
          <aside className="hidden lg:flex lg:shrink-0">
            <DocsNav tree={navTree} audience={audience} />
          </aside>

          {/* Main content area */}
          <div className="flex min-w-0 flex-1 flex-col">
            <DocsHeader audience={audience} />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>

        <Footer showNewsletter={false} />

        {/* ⌘K search dialog — client component, rendered once per layout */}
        <DocsSearch />
      </div>
    </DocsSearchProvider>
  );
}
