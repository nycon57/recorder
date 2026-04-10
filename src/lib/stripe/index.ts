import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Lazy Stripe client — prevents Railway/Vercel builds from crashing when
// STRIPE_SECRET_KEY is not set at import time.
// ---------------------------------------------------------------------------
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

/**
 * Proxy re-export so existing code that does `stripe.xyz` keeps working
 * while still using lazy initialisation under the hood.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ---------------------------------------------------------------------------
// Plan definitions — mirrors Tribora's pricing page
// ---------------------------------------------------------------------------
export const PLANS = {
  free: {
    name: "Starter",
    price: 0,
    priceId: "",
    seats: 1,
    storage: "1GB",
    recordings: 5,
  },
  pro: {
    name: "Pro",
    price: 2900, // $29/mo in cents
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    seats: 10,
    storage: "50GB",
    recordings: -1, // unlimited
  },
  enterprise: {
    name: "Enterprise",
    price: 9900, // $99/mo in cents
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    seats: 999,
    storage: "Unlimited",
    recordings: -1, // unlimited
    custom: true,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
