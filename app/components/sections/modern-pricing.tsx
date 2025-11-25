'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  Sparkles,
  ArrowRight,
  Zap,
  Shield,
  Users,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

type PricingFeature = {
  name: string;
  free: boolean;
  pro: boolean;
  enterprise: boolean | string;
};

type PricingPlan = {
  id: string;
  name: string;
  tagline: string;
  icon: React.ElementType<{ className?: string }>;
  monthlyPrice: number | string;
  yearlyPrice: number | string;
  description: string;
  features: string[];
  ctaLabel: string;
  popular?: boolean;
  href?: string;
};

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Get Started',
    icon: Sparkles,
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Perfect for individuals exploring knowledge management',
    features: [
      '5 recordings per month',
      'Basic transcription',
      '1GB storage',
      'Community support',
      '7-day retention',
      'Basic search',
    ],
    ctaLabel: 'Get Started Free',
  },
  {
    id: 'pro',
    name: 'Professional',
    tagline: 'Most Popular',
    icon: Zap,
    monthlyPrice: 29,
    yearlyPrice: 24, // $24/mo billed annually ($288/year)
    description: 'For teams that need advanced AI features and collaboration',
    features: [
      'Unlimited recordings',
      'AI-powered transcription',
      'Semantic search',
      'AI RAG assistant',
      'Auto documentation',
      'Unlimited storage',
      'Team collaboration',
      'Priority support',
      'Custom branding',
      'Advanced analytics',
    ],
    ctaLabel: 'Start Free Trial',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom Solutions',
    icon: Shield,
    monthlyPrice: 'Custom',
    yearlyPrice: 'Custom',
    description: 'For large organizations with advanced security needs',
    features: [
      'Everything in Pro',
      'SSO & SAML',
      'Advanced security',
      'Dedicated account manager',
      'Custom integrations',
      '99.9% SLA',
      'On-premise deployment',
      'Custom AI models',
      'Unlimited users',
      'White-label solution',
      'Advanced compliance',
    ],
    ctaLabel: 'Contact Sales',
    href: '/contact',
  },
];

const FEATURE_COMPARISON: PricingFeature[] = [
  { name: 'Monthly recordings', free: true, pro: true, enterprise: true },
  { name: 'Transcription quality', free: true, pro: true, enterprise: true },
  { name: 'Storage', free: true, pro: true, enterprise: true },
  { name: 'Semantic search', free: false, pro: true, enterprise: true },
  { name: 'AI assistant (RAG)', free: false, pro: true, enterprise: true },
  { name: 'Auto documentation', free: false, pro: true, enterprise: true },
  { name: 'Team collaboration', free: false, pro: true, enterprise: true },
  { name: 'Priority support', free: false, pro: true, enterprise: true },
  { name: 'SSO/SAML', free: false, pro: false, enterprise: true },
  { name: 'On-premise', free: false, pro: false, enterprise: true },
];

export type ModernPricingProps = {
  title?: string;
  subtitle?: string;
  description?: string;
  showComparison?: boolean;
};

export default function ModernPricing({
  title = "Pricing That Scales With You",
  subtitle = "Simple Pricing",
  description = "Start free and upgrade as you grow. Annual plans save 20%.",
  showComparison = true,
}: ModernPricingProps) {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30" />

      <div className="relative z-10 container px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 text-sm font-medium text-primary backdrop-blur-sm mb-4">
              <Star className="h-4 w-4" />
              {subtitle}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-heading-2 mb-4"
          >
            {title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            {description}
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-3 mt-8"
          >
            <span className={cn(
              "text-sm font-medium transition-colors",
              billingPeriod === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
            )}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-14 h-7 rounded-full bg-muted border-2 border-border transition-colors hover:border-primary"
              aria-label="Toggle billing period"
            >
              <motion.div
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-primary shadow-lg"
                animate={{ x: billingPeriod === 'yearly' ? 26 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={cn(
              "text-sm font-medium transition-colors",
              billingPeriod === 'yearly' ? 'text-foreground' : 'text-muted-foreground'
            )}>
              Yearly
            </span>
            {billingPeriod === 'yearly' && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                <Sparkles className="h-3 w-3" />
                Save 20%
              </motion.span>
            )}
          </motion.div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-16">
          {PLANS.map((plan, index) => {
            const Icon = plan.icon;
            const isCustom = typeof plan.monthlyPrice === 'string';
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={cn(
                  "relative rounded-2xl border p-8 transition-all duration-300",
                  plan.popular
                    ? "bg-primary text-primary-foreground shadow-2xl scale-105 border-primary"
                    : "bg-card border-border hover:border-primary/50 hover:shadow-xl"
                )}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white text-primary px-4 py-1 text-sm font-semibold shadow-lg">
                      <Star className="h-4 w-4 fill-current" />
                      {plan.tagline}
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-6",
                  plan.popular ? "bg-white/20" : "bg-primary/10"
                )}>
                  <Icon className={cn(
                    "h-6 w-6",
                    plan.popular ? "text-white" : "text-primary"
                  )} />
                </div>

                {/* Plan Name */}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                {!plan.popular && (
                  <p className="text-sm text-muted-foreground mb-6">{plan.tagline}</p>
                )}

                {/* Price */}
                <div className="mb-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${plan.id}-${billingPeriod}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {isCustom ? (
                        <div className="text-4xl font-bold">{price}</div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold">${typeof price === 'number' ? price : 0}</span>
                          <span className={cn(
                            "text-sm",
                            plan.popular ? "text-white/80" : "text-muted-foreground"
                          )}>
                            /month
                          </span>
                        </div>
                      )}
                      {billingPeriod === 'yearly' && !isCustom && (
                        <p className={cn(
                          "text-sm mt-1",
                          plan.popular ? "text-white/80" : "text-muted-foreground"
                        )}>
                          Billed ${typeof price === 'number' ? price * 12 : 0} annually
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Description */}
                <p className={cn(
                  "text-sm mb-6",
                  plan.popular ? "text-white/90" : "text-muted-foreground"
                )}>
                  {plan.description}
                </p>

                {/* CTA Button */}
                {plan.href ? (
                  <Link href={plan.href}>
                    <Button
                      size="lg"
                      variant={plan.popular ? "secondary" : "default"}
                      className="w-full group"
                    >
                      {plan.ctaLabel}
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/sign-up">
                    <Button
                      size="lg"
                      variant={plan.popular ? "secondary" : "default"}
                      className="w-full group"
                    >
                      {plan.ctaLabel}
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                )}

                {/* Features */}
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className={cn(
                        "h-5 w-5 flex-shrink-0 mt-0.5",
                        plan.popular ? "text-white" : "text-primary"
                      )} />
                      <span className={cn(
                        "text-sm",
                        plan.popular ? "text-white/90" : "text-foreground/90"
                      )}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        {showComparison && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-5xl mx-auto"
          >
            <h3 className="text-2xl font-bold text-center mb-8">Compare Plans</h3>
            <div className="border border-border rounded-2xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-4 font-semibold text-sm">Feature</th>
                      <th className="text-center p-4 font-semibold text-sm">Free</th>
                      <th className="text-center p-4 font-semibold text-sm bg-primary/10">Pro</th>
                      <th className="text-center p-4 font-semibold text-sm">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_COMPARISON.map((feature, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="p-4 text-sm">{feature.name}</td>
                        <td className="p-4 text-center">
                          {typeof feature.free === 'boolean' ? (
                            feature.free ? (
                              <Check className="h-5 w-5 text-primary mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-sm text-muted-foreground">{feature.free}</span>
                          )}
                        </td>
                        <td className="p-4 text-center bg-primary/5">
                          {typeof feature.pro === 'boolean' ? (
                            feature.pro ? (
                              <Check className="h-5 w-5 text-primary mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-sm text-muted-foreground">{feature.pro}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof feature.enterprise === 'boolean' ? (
                            feature.enterprise ? (
                              <Check className="h-5 w-5 text-primary mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-sm text-muted-foreground">{feature.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
