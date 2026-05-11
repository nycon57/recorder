import type { Metadata } from 'next';

import BlogPostClient from './blog-post-client';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .flatMap((__item, __index, __array) =>
      __item
        ? [__item.charAt(0).toUpperCase() + __item.slice(1)]
        : [],
    )
    .join(' ');
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = titleFromSlug(slug);

  return {
    title: `${title} | Tribora Blog`,
    description:
      'Read a Tribora article about knowledge operations, AI documentation, and team intelligence.',
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  return <BlogPostClient slug={slug} />;
}
