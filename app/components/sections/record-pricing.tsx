'use client';

import { SignUpButton } from '@clerk/nextjs';
import { Check } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

type PricingPlan = {
  name: string;
  price: number | string;
  period?: string;
  description: string;
  features: string[];
  ctaLabel?: string;
  highlighted?: boolean;
  href?: string;
};

export type RecordPricingProps = {
  tagline?: string;
  title?: string;
  description?: string;
  plans?: PricingPlan[];
};

const DEFAULT_PLANS: PricingPlan[] = [
  {
    name: 'Free',
    price: 0,
    period: '/month',
    description: 'Perfect for individuals and small teams getting started',
    features: [
      '5 recordings per month',
      'Basic transcription',
      '1GB storage',
      'Community support',
      '7-day retention',
    ],
    ctaLabel: 'Get Started',
  },
  {
    name: 'Pro',
    price: 29,
    period: '/month',
    description: 'For teams that need advanced AI features and collaboration',
    features: [
      'Unlimited recordings',
      'AI-powered documentation',
      'Semantic search',
      'AI assistant (RAG chat)',
      'Unlimited storage',
      'Priority support',
      'Team collaboration',
      'Custom branding',
    ],
    ctaLabel: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations with advanced needs',
    features: [
      'Everything in Pro',
      'SSO & advanced security',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantees',
      'On-premise deployment',
      'Custom AI models',
      'Unlimited users',
    ],
    ctaLabel: 'Contact Sales',
    href: '/contact',
  },
];

export default function RecordPricing({
  tagline = 'Pricing',
  title = 'Simple, Transparent Pricing',
  description =
    'Choose the plan that fits your needs. Start free and upgrade as you grow.',
  plans = DEFAULT_PLANS,
}: RecordPricingProps) {
  return (
    <section className="bg-muted px-6 py-10 lg:py-24">
      <div className="container">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center text-center">
          <span className="text-body-sm-medium text-primary">
            {tagline}
          </span>
          <h2 className="text-foreground text-heading-1 mt-4 max-w-[616px] tracking-tight lg:text-[52px]">
            {title}
          </h2>
          <p className="text-body-md sm:text-body-lg mt-4 max-w-[516px] text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:mt-16 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const isHighlighted = !!plan.highlighted;
            const isCustom = typeof plan.price === 'string';
            return (
              <div
                key={i}
                className={cn(
                  'rounded-2xl border p-2 shadow-sm transition-all',
                  isHighlighted
                    ? 'bg-gradient-to-br from-primary to-secondary border-primary text-primary-foreground scale-105 shadow-xl'
                    : 'bg-card border-border hover:shadow-lg'
                )}
              >
                <div className="p-4">
                  {isHighlighted && (
                    <div className="mb-4 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                      Most Popular
                    </div>
                  )}

                  <h3
                    className={cn(
                      'text-heading-3',
                      isHighlighted ? 'text-white' : 'text-foreground'
                    )}
                  >
                    {plan.name}
                  </h3>

                  <div className="mt-4 flex items-baseline gap-2">
                    {!isCustom && (
                      <span className="text-[48px] font-bold leading-none tracking-tight">
                        ${plan.price}
                      </span>
                    )}
                    {isCustom && (
                      <span className="text-[48px] font-bold leading-none tracking-tight">
                        {plan.price}
                      </span>
                    )}
                    {plan.period && !isCustom && (
                      <span
                        className={cn(
                          'text-body-sm',
                          isHighlighted ? 'text-white/80' : 'text-muted-foreground'
                        )}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      'text-body-sm mt-3',
                      isHighlighted ? 'text-white/90' : 'text-muted-foreground'
                    )}
                  >
                    {plan.description}
                  </p>

                  <div className="mt-6">
                    {plan.href ? (
                      <Button
                        asChild
                        className={cn(
                          'w-full',
                          isHighlighted && 'bg-white text-foreground hover:bg-white/90'
                        )}
                        variant={isHighlighted ? 'default' : 'secondary'}
                      >
                        <Link href={plan.href}>
                          {plan.ctaLabel ?? 'Get Started'}
                        </Link>
                      </Button>
                    ) : (
                      <SignUpButton mode="modal">
                        <Button
                          className={cn(
                            'w-full',
                            isHighlighted &&
                              'bg-white text-foreground hover:bg-white/90'
                          )}
                          variant={isHighlighted ? 'default' : 'secondary'}
                        >
                          {plan.ctaLabel ?? 'Get Started'}
                        </Button>
                      </SignUpButton>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    'mt-6 rounded-xl border p-6',
                    isHighlighted
                      ? 'bg-white/10 border-white/20'
                      : 'bg-muted border-border'
                  )}
                >
                  <p
                    className={cn(
                      'text-body-sm-medium mb-4',
                      isHighlighted ? 'text-white/95' : 'text-muted-foreground'
                    )}
                  >
                    Features included:
                  </p>
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className={cn(
                          'text-body-sm flex items-start gap-3',
                          isHighlighted ? 'text-white/90' : 'text-foreground'
                        )}
                      >
                        <Check
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            isHighlighted ? 'text-white' : 'text-primary'
                          )}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
