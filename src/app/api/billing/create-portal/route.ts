import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/utils/api';
import { getStripe } from '@/lib/stripe';

export async function POST() {
  try {
    const { userId } = await requireAuth();

    const stripe = getStripe();

    // In production, you'd fetch the customer ID from your database
    // For now, this is a placeholder
    const customerId = `cus_${userId}`;

    // Create Stripe customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
