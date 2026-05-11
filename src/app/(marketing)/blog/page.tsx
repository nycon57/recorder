import type { Metadata } from 'next';

import BlogIndexClient from './blog-index-client';

export const metadata: Metadata = {
  title: 'Blog | Tribora',
  description:
    'Read Tribora product thinking, knowledge operations guidance, and AI documentation practices.',
};

export default function BlogPage() {
  return <BlogIndexClient />;
}
