import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  getAllFeatureIds,
  getFeature,
  type FeatureId,
} from '@/lib/data/features';

import FeatureDetailClient from './feature-detail-client';

interface FeaturePageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getAllFeatureIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: FeaturePageProps): Promise<Metadata> {
  const { id } = await params;
  const feature = getFeature(id);

  if (!feature) {
    return {
      title: 'Feature | Tribora',
      description: 'Explore Tribora product features.',
    };
  }

  return {
    title: feature.meta.title,
    description: feature.meta.description,
    keywords: feature.meta.keywords,
  };
}

export default async function FeaturePage({ params }: FeaturePageProps) {
  const { id } = await params;
  const feature = getFeature(id);

  if (!feature) {
    notFound();
  }

  return <FeatureDetailClient id={id as FeatureId} />;
}
