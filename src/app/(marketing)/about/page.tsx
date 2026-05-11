import type { Metadata } from 'next';

import AboutClient from './about-client';

export const metadata: Metadata = {
  title: 'About | Tribora',
  description:
    'Learn about Tribora and our mission to turn team expertise into durable, searchable knowledge.',
};

export default function AboutPage() {
  return <AboutClient />;
}
