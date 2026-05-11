import type { Metadata } from 'next';

import {
  AuroraHero,
  AuroraValueProp,
  AuroraFeatures,
  AuroraTestimonials,
  AuroraPricing,
  AuroraCTA,
} from '@/app/components/sections';

export const metadata: Metadata = {
  title: 'Tribora | Knowledge Intelligence Layer',
  description:
    'Capture tacit expertise through recordings and turn it into structured, searchable knowledge for your team.',
};

export default function HomePage() {
  return (
    <>
      <AuroraHero />
      <AuroraValueProp />
      <AuroraFeatures />
      <AuroraTestimonials />
      <AuroraPricing />
      <AuroraCTA />
    </>
  );
}
