'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';

import { getFeature, getAllFeatureIds, type FeatureId } from '@/lib/data/features';
import {
  FeatureHero,
  FeatureProblem,
  FeatureSolution,
  FeatureDeepDive,
  FeatureStats,
  FeatureComparison,
  FeatureTestimonials,
  FeatureFAQ,
  FeatureRelated,
} from '@/app/components/features';
import {
  AssistantDemo,
  KnowledgeGraphViz,
  RecordingDemo,
  TranscriptionDemo,
  SearchDemo,
  DocumentationDemo,
} from '@/app/components/features/bespoke';
import { AuroraCTA } from '@/app/components/sections';

interface FeaturePageProps {
  params: Promise<{ id: string }>;
}

export default function FeaturePage({ params }: FeaturePageProps) {
  const { id } = use(params);
  const feature = getFeature(id);

  if (!feature) {
    notFound();
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <FeatureHero data={feature.hero} icon={feature.icon} />

      {/* Problem Section - Emotional Hook */}
      <FeatureProblem data={feature.problem} />

      {/* Solution Section - Tabbed Breakdown */}
      <FeatureSolution data={feature.solution} />

      {/* Bespoke Interactive Demos - Show real features in action */}
      {feature.id === 'recording' && <RecordingDemo />}
      {feature.id === 'transcription' && <TranscriptionDemo />}
      {feature.id === 'search' && <SearchDemo />}
      {feature.id === 'assistant' && <AssistantDemo />}
      {feature.id === 'documentation' && <DocumentationDemo />}
      {feature.id === 'collaboration' && <KnowledgeGraphViz />}

      {/* Deep Dive - Bento Grid */}
      <FeatureDeepDive data={feature.deepDive} />

      {/* Stats Section */}
      <FeatureStats stats={feature.stats} />

      {/* Comparison Section (optional) */}
      {feature.comparison && (
        <FeatureComparison data={feature.comparison} />
      )}

      {/* Testimonials */}
      <FeatureTestimonials testimonials={feature.testimonials} />

      {/* FAQ */}
      <FeatureFAQ items={feature.faq} />

      {/* Related Features */}
      <FeatureRelated
        currentFeatureId={feature.id}
        relatedIds={feature.relatedFeatures}
      />

      {/* Final CTA */}
      <AuroraCTA />
    </div>
  );
}
