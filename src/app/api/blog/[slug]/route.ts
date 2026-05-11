import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { BlogPost } from '@/lib/types/database';

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
 * GET /api/blog/[slug]
 *
 * Fetch a single blog post by its slug.
 * Only returns published posts (RLS enforced).
 * View counts are recorded by POST /api/blog/[slug].
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Fetch the blog post by slug
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json(
          { error: 'Blog post not found' },
          { status: 404 },
        );
      }
      console.error('[Blog API] Error fetching post:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blog post' },
        { status: 500 },
      );
    }

    if (!post) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 },
      );
    }

    // Fetch related posts (same category, excluding current)
    const { data: relatedPosts } = await supabase
      .from('blog_posts')
      .select(
        `
        id,
        title,
        slug,
        excerpt,
        featured_image_url,
        category,
        author_name,
        reading_time_minutes,
        published_at
      `,
      )
      .eq('status', 'published')
      .eq('category', post.category)
      .neq('id', post.id)
      .order('published_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      post: post as BlogPost,
      relatedPosts: relatedPosts || [],
    });
  } catch (error) {
    console.error('[Blog API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('id, view_count')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !post) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 },
      );
    }

    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq('id', post.id);

    if (updateError) {
      console.error('[Blog API] Failed to update view count:', updateError);
      return NextResponse.json(
        { error: 'Failed to record view' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Blog API] Unexpected view-count error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
