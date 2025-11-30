import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { BlogPost, BlogPostCard, BlogPostCategory } from '@/lib/types/database';

// Create a public Supabase client for blog queries (uses anon key, respects RLS)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * GET /api/blog
 *
 * Fetch published blog posts with optional filtering.
 *
 * Query Parameters:
 * - category: Filter by category (product, insights, tutorials, general)
 * - tag: Filter by tag
 * - featured: If 'true', only return featured posts
 * - limit: Number of posts to return (default: 20)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') as BlogPostCategory | null;
    const tag = searchParams.get('tag');
    const featured = searchParams.get('featured') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    // Build query for card data (subset of fields for list display)
    let query = supabase
      .from('blog_posts')
      .select(
        `
        id,
        title,
        slug,
        excerpt,
        featured_image_url,
        category,
        tags,
        author_name,
        author_role,
        is_featured,
        reading_time_minutes,
        published_at
      `
      )
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply optional filters
    if (category) {
      query = query.eq('category', category);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (featured) {
      query = query.eq('is_featured', true);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[Blog API] Error fetching posts:', error);
      return NextResponse.json({ error: 'Failed to fetch blog posts' }, { status: 500 });
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    return NextResponse.json({
      posts: data as BlogPostCard[],
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: (totalCount || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('[Blog API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
