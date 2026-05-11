import type { Metadata } from 'next';

import PricingClient from './pricing-client';

export const metadata: Metadata = {
  title: 'Pricing | Tribora',
  description:
    'Choose the Tribora plan that fits your team, from shared knowledge capture to governed enterprise intelligence.',
};

export default function PricingPage() {
  return <PricingClient />;
}
