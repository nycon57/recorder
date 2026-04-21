import { unstable_cache } from 'next/cache';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';

import { resolveDocsAudience, getDocsRegistry, resolveAccess, findGitPageBody } from '@/lib/docs';
import type { SectionId } from '@/lib/docs';
import { findDbPageBody } from '@/lib/docs/adapters/db';
import { DocsLanding } from '@/app/components/docs/landing/docs-landing';
import { DocsPlaceholder } from '@/app/components/docs/placeholder/docs-placeholder';
import { DocsContent } from '@/app/components/docs/content/docs-content';
import { DocsSectionIndex } from '@/app/components/docs/section-index/docs-section-index';

// Prevent stale access decisions being served from cache.
export const dynamic = 'force-dynamic';

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug: slugParts } = await params;

  const reqHeaders = await headers();
  const { audience } = await resolveDocsAudience(reqHeaders);

  const registry = await getDocsRegistry();

  // ── /docs (bare root) ────────────────────────────────────────────────────────
  if (!slugParts || slugParts.length === 0) {
    const sections = registry.sectionsForAudience(audience);
    return <DocsLanding audience={audience} sections={sections} />;
  }

  const joinedSlug = slugParts.join('/');

  // ── Exact page match ──────────────────────────────────────────────────────────
  const page = registry.findPage(joinedSlug);
  if (page) {
    const decision = resolveAccess(audience, page.audience, joinedSlug);

    if (decision.kind === 'redirect') {
      redirect(decision.to);
    }
    if (decision.kind === 'notFound') {
      notFound();
    }

    // kind === 'render' — resolve body HTML from git or DB adapter
    let bodyHtml: string | undefined;

    if (page.source === 'db') {
      // DB-backed page: per-slug cached body fetch
      const getCachedDbBody = unstable_cache(
        () => findDbPageBody(page.slug),
        [`docs-db-body-${page.slug}`],
        { revalidate: 3600, tags: [`docs:db:body:${page.slug}`, 'docs:db'] },
      );
      const dbBody = await getCachedDbBody();
      bodyHtml = dbBody?.bodyHtml;
    } else {
      bodyHtml = findGitPageBody(page.slug);
    }

    if (bodyHtml) {
      const related = registry.relatedFor(page.slug, audience);
      return <DocsContent page={page} bodyHtml={bodyHtml} related={related} />;
    }

    // Registered page but no compiled body (not yet authored or compile pending)
    return <DocsPlaceholder page={page} />;
  }

  // ── Section index match ───────────────────────────────────────────────────────
  // A single slug segment that exactly matches a SectionId renders the section index.
  if (slugParts.length === 1) {
    const sectionId = slugParts[0] as SectionId;
    const section = registry.sections.find((s) => s.id === sectionId);

    if (section) {
      // Apply the same access rules to the section itself.
      const decision = resolveAccess(audience, section.audience, joinedSlug);

      if (decision.kind === 'redirect') {
        redirect(decision.to);
      }
      if (decision.kind === 'notFound') {
        notFound();
      }

      // Filter pages visible to this audience within the section.
      const sectionPages = registry.pagesForAudience(audience).filter(
        (p) => p.section === section.id && !p.unlisted,
      );

      return <DocsSectionIndex section={section} pages={sectionPages} />;
    }
  }

  // ── No match ─────────────────────────────────────────────────────────────────
  notFound();
}
