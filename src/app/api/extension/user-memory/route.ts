/**
 * GET  /api/extension/user-memory
 * DELETE /api/extension/user-memory
 *
 * TRIB-50: User-level memory — tracks which wiki topics the user has been
 * exposed to via the extension's fusion query.
 *
 * GET returns the topics (page topics, not full content) the user has been
 * exposed to, for display in the extension popup or settings page.
 *
 * DELETE clears all interaction history for the authenticated user in their
 * current org.
 *
 * Auth: requireOrg() (session-based).
 * Runtime: nodejs (NOT edge).
 */

import { NextResponse } from 'next/server';

import { requireOrg, errors, successResponse } from '@/lib/utils/api';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UserMemoryTopic {
  pageId: string;
  topic: string;
  app: string | null;
  screen: string | null;
  lastInteraction: string;
  interactionCount: number;
}

export async function GET() {
  let userId: string;
  let orgId: string;
  try {
    const ctx = await requireOrg();
    userId = ctx.userId;
    orgId = ctx.orgId;
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errors.unauthorized();
    }
    return errors.forbidden();
  }

  try {
    const supabase = createAdminClient();

    // Aggregate interactions per wiki page: count + most recent timestamp
    const { data: interactions, error: queryError } = await supabase
      .from('user_wiki_interactions')
      .select('wiki_page_id, created_at')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[user-memory] query error:', queryError);
      return errors.badRequest('Failed to fetch user memory');
    }

    const rows = (interactions ?? []) as {
      wiki_page_id: string;
      created_at: string;
    }[];

    if (rows.length === 0) {
      return successResponse({ topics: [] });
    }

    // Aggregate: group by wiki_page_id
    const pageMap = new Map<
      string,
      { lastInteraction: string; interactionCount: number }
    >();
    for (const row of rows) {
      const existing = pageMap.get(row.wiki_page_id);
      if (existing) {
        existing.interactionCount += 1;
        // Keep the most recent (already sorted desc)
      } else {
        pageMap.set(row.wiki_page_id, {
          lastInteraction: row.created_at,
          interactionCount: 1,
        });
      }
    }

    // Fetch page details for all referenced pages
    const pageIds = Array.from(pageMap.keys());
    const { data: pages, error: pagesError } = await supabase
      .from('org_wiki_pages')
      .select('id, topic, app, screen')
      .in('id', pageIds);

    if (pagesError) {
      console.error('[user-memory] pages lookup error:', pagesError);
      return errors.badRequest('Failed to fetch page details');
    }

    const pageRows = (pages ?? []) as {
      id: string;
      topic: string;
      app: string | null;
      screen: string | null;
    }[];

    const topics: UserMemoryTopic[] = pageRows.map((page) => {
      const stats = pageMap.get(page.id)!;
      return {
        pageId: page.id,
        topic: page.topic,
        app: page.app,
        screen: page.screen,
        lastInteraction: stats.lastInteraction,
        interactionCount: stats.interactionCount,
      };
    });

    // Sort by most recent interaction first
    topics.sort(
      (a, b) =>
        new Date(b.lastInteraction).getTime() -
        new Date(a.lastInteraction).getTime()
    );

    return successResponse({ topics });
  } catch (error) {
    console.error('[user-memory] unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch user memory' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  let userId: string;
  let orgId: string;
  try {
    const ctx = await requireOrg();
    userId = ctx.userId;
    orgId = ctx.orgId;
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errors.unauthorized();
    }
    return errors.forbidden();
  }

  try {
    const supabase = createAdminClient();

    const { error: deleteError } = await supabase
      .from('user_wiki_interactions')
      .delete()
      .eq('user_id', userId)
      .eq('org_id', orgId);

    if (deleteError) {
      console.error('[user-memory] delete error:', deleteError);
      return errors.badRequest('Failed to clear user memory');
    }

    return successResponse({ cleared: true });
  } catch (error) {
    console.error('[user-memory] unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to clear user memory' },
      { status: 500 }
    );
  }
}
