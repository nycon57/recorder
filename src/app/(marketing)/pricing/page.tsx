'use client';

import * as motion from 'motion/react-client';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Tick02Icon,
  SparklesIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  MinusSignIcon,
  ZapIcon,
  HelpCircleIcon,
  SecurityCheckIcon,
} from '@hugeicons/core-free-icons';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Switch } from '@/app/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion';
import { AuroraCTA } from '@/app/components/sections';

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
};

// ============================================================================
// DATA
// ============================================================================

interface PricingTier {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  cta: string;
  ctaHref: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    description: 'Perfect for individuals exploring AI-powered knowledge capture',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      '5 recordings per month',
      'AI transcription (Whisper)',
      'Basic search',
      'Personal workspace',
      '1GB storage',
      'Community support',
    ],
    cta: 'Get Started Free',
    ctaHref: '/sign-up',
  },
  {
    name: 'Pro',
    description: 'For teams that need advanced AI capabilities at scale',
    monthlyPrice: 29,
    annualPrice: 290,
    features: [
      'Unlimited recordings',
      'AI transcription (95%+ accuracy)',
      'Semantic search',
      'Auto documentation',
      'AI RAG assistant',
      'Knowledge graph',
      'Team sharing (up to 10)',
      '50GB storage',
      'Priority support',
    ],
    highlighted: true,
    badge: 'Most Popular',
    cta: 'Start Pro Trial',
    ctaHref: '/sign-up',
  },
  {
    name: 'Enterprise',
    description: 'Advanced features for large organizations with security needs',
    monthlyPrice: 99,
    annualPrice: 990,
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Advanced RBAC',
      'SSO & SAML',
      'Bidirectional sync',
      'Custom integrations',
      'On-premise option',
      'Dedicated support',
      '99.9% SLA guarantee',
    ],
    cta: 'Contact Sales',
    ctaHref: '/contact',
  },
];

interface ComparisonRow {
  feature: string;
  category?: boolean;
  sharepoint: string | boolean;
  google: string | boolean;
  manual: string | boolean;
  tribora: string | boolean;
  triboraHighlight?: boolean;
}

const COMPARISON_DATA: ComparisonRow[] = [
  { feature: 'Knowledge Capture', category: true, sharepoint: false, google: false, manual: false, tribora: false },
  { feature: 'Visual/Screen Recording', sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: 'AI Transcription', sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: 'Workflow Extraction', sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: 'Auto Documentation', sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: 'Intelligence Layer', category: true, sharepoint: false, google: false, manual: false, tribora: false },
  { feature: 'Semantic Search', sharepoint: 'Basic', google: 'Basic', manual: false, tribora: 'Advanced AI', triboraHighlight: true },
  { feature: 'Knowledge Graph', sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: 'AI Assistant (RAG)', sharepoint: 'Copilot ($)', google: 'Gemini ($)', manual: false, tribora: 'Included', triboraHighlight: true },
  { feature: 'Cross-Source Linking', sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: 'Integration', category: true, sharepoint: false, google: false, manual: false, tribora: false },
  { feature: 'Bidirectional Sync', sharepoint: 'One-way', google: 'One-way', manual: false, tribora: 'Full sync', triboraHighlight: true },
  { feature: 'Publish Back to Source', sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
];

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: "What's included in the free plan?",
    answer: "The free plan includes 5 recordings per month, AI-powered transcription, 1GB of storage, and basic search functionality. It's perfect for individuals who want to explore how Tribora can help capture and organize their knowledge before committing to a paid plan.",
  },
  {
    id: 'faq-2',
    question: 'How does the 14-day free trial work?',
    answer: "When you sign up for Pro, you get full access to all Pro features for 14 days with no credit card required. At the end of the trial, you can choose to subscribe or continue with the free plan. All your recordings and data will be preserved either way.",
  },
  {
    id: 'faq-3',
    question: 'Can I upgrade or downgrade at any time?',
    answer: "Yes! You can upgrade your plan at any time, and the new features will be available immediately. If you downgrade, the change will take effect at the end of your current billing period. Your data is always safe and accessible regardless of plan changes.",
  },
  {
    id: 'faq-4',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and can also accommodate invoicing for Enterprise customers. All payments are processed securely through Stripe with bank-level encryption.',
  },
  {
    id: 'faq-5',
    question: 'Is my data secure?',
    answer: 'Absolutely. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We comply with SOC 2 Type II standards and are GDPR ready. Enterprise customers can also opt for on-premise deployment for complete data sovereignty.',
  },
  {
    id: 'faq-6',
    question: 'What integrations are available?',
    answer: "Tribora integrates with Google Drive, Microsoft SharePoint, OneDrive, Notion, and more. Our unique bidirectional sync allows you to publish enriched content back to your connected services—we're not just another silo.",
  },
  {
    id: 'faq-7',
    question: 'Do you offer discounts for nonprofits or education?',
    answer: 'Yes! We offer 50% off for qualifying nonprofits, educational institutions, and open source projects. Contact our sales team with proof of status to learn more about our discount programs.',
  },
];

// ============================================================================
// PRICING PAGE
// ============================================================================

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="relative overflow-hidden">
      {/* ================================================================== */}
      {/* GLOBAL BACKGROUND */}
      {/* ================================================================== */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        {/* Flowing aurora orbs */}
        <div
          className="absolute top-[10%] right-[5%] w-[600px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_70%)]
            blur-[100px] animate-float"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="absolute top-[50%] left-[5%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.06)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '3s' }}
        />
        <div
          className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(3,98,76,0.08)_0%,transparent_70%)]
            blur-[60px] animate-float"
          style={{ animationDelay: '6s' }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,223,130,0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,223,130,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      {/* ================================================================== */}
      {/* HERO SECTION */}
      {/* ================================================================== */}
      <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-24">
        <div className="container px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div variants={scaleIn}>
              <Badge
                variant="outline"
                className="mb-6 px-4 py-2 rounded-full
                  bg-accent/5 backdrop-blur-sm border-accent/30"
              >
                <HugeiconsIcon icon={SparklesIcon} size={14} className="mr-2 text-accent" />
                <span className="text-sm font-medium text-accent">
                  Simple, Transparent Pricing
                </span>
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="font-outfit text-4xl sm:text-5xl lg:text-6xl xl:text-7xl
                font-light leading-tight tracking-tight mb-6"
              variants={fadeInUp}
            >
              Choose your{' '}
              <span
                className="bg-gradient-to-r from-accent via-secondary to-primary
                  bg-clip-text text-transparent"
              >
                knowledge plan
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="text-lg sm:text-xl lg:text-2xl text-muted-foreground
                font-light max-w-2xl mx-auto mb-10"
              variants={fadeInUp}
            >
              Start free. Scale as you grow. No credit card required.
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
                  className="ml-2 px-3 py-1 text-xs font-medium
                    bg-accent/10 border-accent/30 text-accent"
                >
                  Save 20%
                </Badge>
              )}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* PRICING CARDS */}
      {/* ================================================================== */}
      <section className="relative py-8 sm:py-12">
        <div className="container px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {PRICING_TIERS.map((tier, index) => {
              const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
              const monthlyEquivalent = isAnnual && tier.annualPrice > 0
                ? Math.round(tier.annualPrice / 12)
                : tier.monthlyPrice;
              const isHighlighted = tier.highlighted;

              return (
                <motion.div
                  key={index}
                  variants={cardVariants}
                  whileHover={{ y: -8, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                  className={cn(
                    'group relative rounded-2xl overflow-hidden',
                    'bg-card/50 backdrop-blur-sm',
                    'border transition-all duration-500',
                    isHighlighted
                      ? 'border-accent/50 shadow-[0_0_50px_rgba(0,223,130,0.15)]'
                      : 'border-border/50 hover:border-accent/30',
                    'hover:shadow-[0_0_60px_rgba(0,223,130,0.12)]'
                  )}
                >
                  {/* Highlighted tier badge */}
                  {tier.badge && (
                    <div className="absolute top-0 left-0 right-0 flex justify-center">
                      <div
                        className="px-4 py-1.5 text-xs font-semibold
                          bg-gradient-to-r from-accent to-secondary
                          text-accent-foreground rounded-b-xl"
                      >
                        {tier.badge}
                      </div>
                    </div>
                  )}

                  {/* Card gradient background */}
                  <div
                    className={cn(
                      'absolute inset-0 opacity-0 transition-opacity duration-500',
                      'bg-gradient-to-br from-accent/5 via-transparent to-secondary/5',
                      isHighlighted ? 'opacity-100' : 'group-hover:opacity-100'
                    )}
                  />

                  {/* Content */}
                  <div className="relative z-10 p-6 sm:p-8">
                    {/* Tier Name */}
                    <h3 className="font-outfit text-xl font-medium mb-2">
                      {tier.name}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mb-6 min-h-[40px]">
                      {tier.description}
                    </p>

                    {/* Price */}
                    <div className="mb-6">
                      {price === 0 ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-light text-foreground">$0</span>
                          </div>
                          <span className="text-sm text-muted-foreground">Free forever</span>
                        </>
                      ) : tier.name === 'Enterprise' ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-light text-foreground">Custom</span>
                          </div>
                          <span className="text-sm text-muted-foreground">Contact for pricing</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-light text-foreground">
                              ${monthlyEquivalent}
                            </span>
                            <span className="text-muted-foreground text-sm">/month</span>
                          </div>
                          {isAnnual && (
                            <span className="text-sm text-muted-foreground">
                              ${price}/year, billed annually
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* CTA Button */}
                    <Link href={tier.ctaHref}>
                      <Button
                        className={cn(
                          'w-full rounded-full group/btn h-12',
                          'transition-all duration-300',
                          isHighlighted
                            ? 'bg-gradient-to-r from-accent to-secondary text-accent-foreground hover:shadow-[0_0_30px_rgba(0,223,130,0.4)]'
                            : 'bg-card hover:bg-accent/10 border border-border/50 hover:border-accent/30'
                        )}
                      >
                        {tier.cta}
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          size={16}
                          className="ml-2 transition-transform group-hover/btn:translate-x-1"
                        />
                      </Button>
                    </Link>

                    {/* Features List */}
                    <ul className="mt-8 space-y-3">
                      {tier.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3">
                          <div
                            className="shrink-0 mt-0.5 w-5 h-5 rounded-full
                              flex items-center justify-center bg-accent/10"
                          >
                            <HugeiconsIcon icon={Tick02Icon} size={12} className="text-accent" />
                          </div>
                          <span className="text-sm text-muted-foreground">{feature}</span>
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

          {/* Trust Badges */}
          <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <div className="inline-flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={SecurityCheckIcon} size={16} className="text-accent" />
                No credit card required
              </span>
              <span className="hidden sm:block w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={ZapIcon} size={16} className="text-accent" />
                14-day free trial
              </span>
              <span className="hidden sm:block w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={SparklesIcon} size={16} className="text-accent" />
                Cancel anytime
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* COMPARISON TABLE */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-28 lg:py-32 overflow-hidden">
        {/* Background aurora */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-0 right-0 h-px
              bg-gradient-to-r from-transparent via-accent/20 to-transparent"
          />
          <div
            className="absolute bottom-[30%] right-[5%] w-[500px] h-[500px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
              blur-[100px]"
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
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
                  bg-accent/5 backdrop-blur-sm border-accent/30"
              >
                <HugeiconsIcon icon={ZapIcon} size={14} className="mr-2 text-accent" />
                <span className="text-sm font-medium text-accent">
                  Why Tribora?
                </span>
              </Badge>
            </motion.div>

            <motion.h2
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
                leading-tight tracking-tight mb-4 sm:mb-6"
              variants={fadeInUp}
            >
              The{' '}
              <span className="bg-gradient-to-r from-accent via-secondary to-primary bg-clip-text text-transparent">
                intelligence layer
              </span>{' '}
              above your tools
            </motion.h2>

            <motion.p
              className="text-lg sm:text-xl text-muted-foreground font-light"
              variants={fadeInUp}
            >
              We don't replace your storage—we make it smarter
            </motion.p>
          </motion.div>

          {/* Comparison Table */}
          <motion.div
            className="max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="rounded-2xl overflow-hidden border border-border/50
                bg-card/30 backdrop-blur-sm"
            >
              {/* Table Header */}
              <div className="border-b border-border/50 bg-muted/20">
                <div className="grid grid-cols-5 gap-2 sm:gap-4 px-4 sm:px-6 py-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Feature
                  </div>
                  <div className="text-center text-sm font-medium text-muted-foreground hidden sm:block">
                    SharePoint
                  </div>
                  <div className="text-center text-sm font-medium text-muted-foreground hidden sm:block">
                    Google Drive
                  </div>
                  <div className="text-center text-sm font-medium text-muted-foreground hidden sm:block">
                    Manual
                  </div>
                  <div className="text-center text-sm font-semibold text-accent col-span-4 sm:col-span-1">
                    Tribora
                  </div>
                </div>
              </div>

              {/* Table Body */}
              {COMPARISON_DATA.map((row, index) => {
                if (row.category) {
                  return (
                    <div
                      key={index}
                      className="border-b border-border/30 bg-muted/10"
                    >
                      <div className="px-4 sm:px-6 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {row.feature}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={index}
                    className="group border-b border-border/30 last:border-b-0
                      transition-colors hover:bg-accent/5"
                  >
                    <div className="grid grid-cols-5 items-center gap-2 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4">
                      <div className="text-sm font-medium text-foreground col-span-4 sm:col-span-1">
                        {row.feature}
                      </div>
                      <div className="text-center hidden sm:block">
                        <CompareValue value={row.sharepoint} />
                      </div>
                      <div className="text-center hidden sm:block">
                        <CompareValue value={row.google} />
                      </div>
                      <div className="text-center hidden sm:block">
                        <CompareValue value={row.manual} />
                      </div>
                      <div
                        className={cn(
                          'text-center rounded-lg py-1.5 -mx-2 px-2',
                          row.triboraHighlight && 'bg-accent/10'
                        )}
                      >
                        <CompareValue value={row.tribora} isHighlighted={row.triboraHighlight} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table Footer */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Tribora integrates with your existing tools. Connect Google Drive, SharePoint, Notion, and more.
              </p>
              <Link href="/sign-up">
                <Button className="rounded-full px-6 group bg-gradient-to-r from-accent to-secondary text-accent-foreground hover:shadow-[0_0_30px_rgba(0,223,130,0.4)] transition-all duration-300">
                  Get started free
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={16}
                    className="ml-2 transition-transform group-hover:translate-x-1"
                  />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FAQ SECTION */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-28 lg:py-32 overflow-hidden">
        {/* Background aurora */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[20%] left-[10%] w-[400px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.05)_0%,transparent_70%)]
              blur-[80px] animate-float"
            style={{ animationDelay: '1s' }}
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
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
                  bg-accent/5 backdrop-blur-sm border-accent/30"
              >
                <HugeiconsIcon icon={HelpCircleIcon} size={14} className="mr-2 text-accent" />
                <span className="text-sm font-medium text-accent">
                  FAQ
                </span>
              </Badge>
            </motion.div>

            <motion.h2
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
                leading-tight tracking-tight mb-4 sm:mb-6"
              variants={fadeInUp}
            >
              Frequently asked{' '}
              <span className="bg-gradient-to-r from-accent via-secondary to-primary bg-clip-text text-transparent">
                questions
              </span>
            </motion.h2>

            <motion.p
              className="text-lg sm:text-xl text-muted-foreground font-light"
              variants={fadeInUp}
            >
              Everything you need to know about Tribora pricing
            </motion.p>
          </motion.div>

          {/* FAQ Accordion */}
          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Accordion type="single" collapsible className="space-y-4">
              {FAQ_ITEMS.map((item, index) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className={cn(
                    'rounded-xl overflow-hidden border border-border/50',
                    'bg-card/30 backdrop-blur-sm',
                    'transition-all duration-300',
                    'data-[state=open]:border-accent/30',
                    'data-[state=open]:shadow-[0_0_30px_rgba(0,223,130,0.08)]'
                  )}
                >
                  <AccordionTrigger
                    className="px-6 py-5 hover:no-underline group
                      text-left transition-colors hover:bg-accent/5"
                  >
                    <span className="font-medium text-base sm:text-lg pr-4 group-hover:text-accent transition-colors">
                      {item.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-5">
                    <p className="text-muted-foreground leading-relaxed">
                      {item.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Still have questions? */}
            <motion.div
              className="mt-12 text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <p className="text-muted-foreground mb-4">
                Still have questions? We're here to help.
              </p>
              <Link href="/contact">
                <Button variant="outline" className="rounded-full px-6 border-accent/30 hover:border-accent/50 hover:bg-accent/5 transition-all duration-300">
                  Contact Support
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA SECTION - Using shared AuroraCTA component */}
      {/* ================================================================== */}
      <AuroraCTA />
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function CompareValue({
  value,
  isHighlighted,
}: {
  value: string | boolean;
  isHighlighted?: boolean;
}) {
  if (typeof value === 'boolean') {
    if (value) {
      return (
        <div className={cn('flex items-center justify-center', isHighlighted ? 'text-accent' : 'text-foreground')}>
          <HugeiconsIcon icon={Tick02Icon} size={18} />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center text-muted-foreground/40">
        <HugeiconsIcon icon={Cancel01Icon} size={18} />
      </div>
    );
  }

  if (value.includes('One-way')) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs sm:text-sm">
        <HugeiconsIcon icon={MinusSignIcon} size={14} />
        <span>{value}</span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        'text-xs sm:text-sm font-medium',
        isHighlighted ? 'text-accent' : 'text-muted-foreground'
      )}
    >
      {value}
    </span>
  );
}
