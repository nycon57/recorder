import {
  ModernHero,
  ModernFeatures,
  ModernPricing,
  ModernCTA,
  RecordTestimonials,
} from '@/app/components/sections';

export default function HomePage() {
  return (
    <>
      <ModernHero />
      <ModernFeatures />
      <RecordTestimonials />
      <ModernPricing />
      <ModernCTA />
    </>
  );
}
