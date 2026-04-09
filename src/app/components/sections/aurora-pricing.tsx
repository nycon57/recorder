'use client';

import * as motion from 'motion/react-client';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, SparklesIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Switch } from '@/app/components/ui/switch';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

/**
 * AuroraPricing - Premium pricing section with aurora gradient backgrounds
 *
 * Design inspired by Railway, Reflect, Wope with Tribora brand identity.
 * Features:
 * - Flowing aurora background that connects from testimonials
 * - Glass-effect pricing cards with glow highlights
 * - Monthly/Annual toggle with savings indicator
 * - Featured tier with accent styling
 */

interface PricingTier {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  cta: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    description: 'Perfect for individuals exploring AI-powered recording',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      '5 recordings per month',
      'AI transcription (Whisper)',
      'Basic search',
      'Personal workspace',
      '1GB storage',
    ],
    cta: 'Get Started Free',
  },
  {
    name: 'Pro',
    description: 'For teams that need advanced AI capabilities',
    monthlyPrice: 29,
    annualPrice: 290,
    features: [
      'Unlimited recordings',
      'AI transcription (95%+ accuracy)',
      'Semantic search',
      'Auto documentation',
      'Team sharing (up to 10)',
      '50GB storage',
      'Knowledge graph',
      'Priority support',
    ],
    highlighted: true,
    badge: 'Most Popular',
    cta: 'Start Pro Trial',
  },
  {
    name: 'Enterprise',
    description: 'Advanced features for large organizations',
    monthlyPrice: 99,
    annualPrice: 990,
    features: [
      'Everything in Pro',
      'RAG Assistant with citations',
      'Unlimited team members',
      'Advanced RBAC',
      'SSO & SAML',
      'Bidirectional sync',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
  },
];

const AuroraPricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section className="relative py-20 sm:py-28 lg:py-32 overflow-hidden">
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top gradient connecting from testimonials */}
        <div
          className="absolute inset-x-0 top-0 h-48
            bg-gradient-to-b from-background to-transparent"
        />

        {/* Flowing aurora orbs */}
        <div
          className="absolute top-[30%] right-[5%] w-[600px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.1)_0%,transparent_70%)]
            blur-[100px] animate-float"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.08)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '2s' }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,223,130,0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,223,130,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* === CONTENT === */}
      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp}>
            <Badge
              variant="outline"
              className="mb-6 px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm
                border-accent/30"
            >
              <span className="text-sm font-medium text-accent">
                Simple Pricing
              </span>
            </Badge>
          </motion.div>

          <motion.h2
            className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
              leading-tight tracking-tight mb-4 sm:mb-6"
            variants={fadeInUp}
          >
            Choose your{' '}
            <span
              className="bg-gradient-to-r from-accent via-secondary to-primary
                bg-clip-text text-transparent"
            >
              knowledge plan
            </span>
          </motion.h2>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground font-light max-w-2xl mx-auto mb-8"
            variants={fadeInUp}
          >
            Scale from solo to enterprise with AI-powered knowledge management
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            className="flex items-center justify-center gap-4"
            variants={fadeInUp}
          >
            <span
              className={cn(
                'text-sm font-medium transition-colors',
                !isAnnual ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              Monthly
            </span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              className="data-[state=checked]:bg-accent"
            />
            <span
              className={cn(
                'text-sm font-medium transition-colors',
                isAnnual ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              Annual
            </span>
            {isAnnual && (
              <Badge
                variant="outline"
                className="ml-2 px-2 py-0.5 text-xs
                  bg-accent/10 border-accent/30 text-accent"
              >
                Save 20%
              </Badge>
            )}
          </motion.div>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          {PRICING_TIERS.map((tier, index) => {
            const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
            const isHighlighted = tier.highlighted;

            return (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ y: -8, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                className={cn(
                  'group relative rounded-2xl overflow-hidden',
                  'bg-card/50 backdrop-blur-sm',
                  'border transition-all duration-500 ease-smooth',
                  isHighlighted
                    ? 'border-accent/50 shadow-[0_0_40px_rgba(0,223,130,0.15)]'
                    : 'border-border/50 hover:border-accent/30',
                  'hover:shadow-[0_0_50px_rgba(0,223,130,0.1)]'
                )}
              >
                {/* Highlighted tier badge */}
                {tier.badge && (
                  <div className="absolute top-0 left-0 right-0 flex justify-center">
                    <div
                      className="px-4 py-1 text-xs font-medium
                        bg-gradient-to-r from-accent to-secondary
                        text-accent-foreground
                        rounded-b-lg"
                    >
                      {tier.badge}
                    </div>
                  </div>
                )}

                {/* Card gradient background */}
                <div
                  className={cn(
                    'absolute inset-0 opacity-0',
                    'transition-opacity duration-500',
                    'bg-gradient-to-br from-accent/5 via-transparent to-secondary/5',
                    isHighlighted
                      ? 'opacity-100'
                      : 'group-hover:opacity-100'
                  )}
                />

                {/* Content */}
                <div className="relative z-10 p-6 sm:p-8">
                  {/* Tier Name */}
                  <h3 className="font-outfit text-xl font-medium mb-2">
                    {tier.name}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-6">
                    {tier.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-light text-foreground">
                        ${price}
                      </span>
                      {price > 0 && (
                        <span className="text-muted-foreground text-sm">
                          /{isAnnual ? 'year' : 'month'}
                        </span>
                      )}
                    </div>
                    {price === 0 && (
                      <span className="text-sm text-muted-foreground">
                        Free forever
                      </span>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Link href={tier.name === 'Enterprise' ? '/contact' : '/sign-up'}>
                    <Button
                      className={cn(
                        'w-full rounded-full group/btn',
                        'transition-all duration-300',
                        isHighlighted
                          ? 'bg-gradient-to-r from-accent to-secondary text-accent-foreground hover:shadow-[0_0_30px_rgba(0,223,130,0.4)]'
                          : 'bg-card hover:bg-accent/10 border border-border/50 hover:border-accent/30'
                      )}
                    >
                      {tier.cta}
                      <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-2 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </Link>

                  {/* Features List */}
                  <ul className="mt-8 space-y-3">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <div
                          className={cn(
                            'shrink-0 mt-0.5 w-5 h-5 rounded-full',
                            'flex items-center justify-center',
                            'bg-accent/10'
                          )}
                        >
                          <HugeiconsIcon icon={Tick02Icon} size={12} className="text-accent" />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom glow line for highlighted tier */}
                {isHighlighted && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-px
                      bg-gradient-to-r from-transparent via-accent/50 to-transparent"
                  />
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Trust Note */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <HugeiconsIcon icon={SparklesIcon} size={16} className="text-accent" />
            <span>No credit card required • 14-day free trial on paid plans</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export { AuroraPricing };
