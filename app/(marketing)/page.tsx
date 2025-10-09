import {
  RecordHero,
  RecordFeatures,
  RecordTestimonials,
  RecordPricing,
  RecordCTA,
} from '@/app/components/sections';

export default function HomePage() {
  return (
    <>
      <RecordHero />
      <RecordFeatures />
      <RecordTestimonials />
      <RecordPricing />
      <RecordCTA />
    </>
  );
}
