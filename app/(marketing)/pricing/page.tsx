import { ModernPricing, RecordFAQ, ModernCTA } from '@/app/components/sections';

export default function PricingPage() {
  return (
    <>
      <ModernPricing showComparison={true} />
      <RecordFAQ softBg />
      <ModernCTA />
    </>
  );
}
