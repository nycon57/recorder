/**
 * POST /api/admin/docs/[slug]/revalidate
 *
 * Busts the Next.js cache for a specific DB-backed docs page.
 * Invalidates both the per-slug body cache and the global DB pages list.
 *
 * System-admin only. Called after an in-database hot-patch to make the
 * updated content visible without a full deploy.
 *
 * TRIB-154.
 */

import { revalidateTag } from 'next/cache';

import { apiHandler, requireSystemAdmin } from '@/lib/utils/api';

export const POST = apiHandler(async (_req, context) => {
  await requireSystemAdmin();

  const { slug } = await context.params;

  if (!slug || typeof slug !== 'string') {
    return Response.json({ ok: false, error: 'Missing slug' }, { status: 400 });
  }

  revalidateTag('docs:db', 'everything');
  revalidateTag(`docs:db:body:${slug}`, 'everything');

  return Response.json({ ok: true, slug, revalidated: ['docs:db', `docs:db:body:${slug}`] });
});
