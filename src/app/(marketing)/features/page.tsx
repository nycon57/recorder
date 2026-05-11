import type { Metadata } from 'next';

import FeaturesClient from './features-client';

export const metadata: Metadata = {
  title: 'Features | Tribora',
  description:
    'Explore Tribora features for recording, transcription, search, documentation, collaboration, and AI assistance.',
};

export default function FeaturesPage() {
  return <FeaturesClient />;
}
