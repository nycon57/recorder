import {
  RegistryHero,
  RegistryFeatures,
  RegistryPricing,
  ModernCTA,
  RecordTestimonials,
} from '@/app/components/sections';

export default function HomePage() {
  return (
    <>
      <RegistryHero />
      <RegistryFeatures />
      <RecordTestimonials />
      <RegistryPricing />
      <ModernCTA />
    </>
  );
}
