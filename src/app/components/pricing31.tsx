"use client";

import {
  Check,
  Cloud,
  FileText,
  Headphones,
  LucideIcon,
  MessageSquare,
  Network,
  Search,
  Shield,
  Sparkles,
  Users,
  Video,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/app/components/ui/button";
import { ArrowRightIcon } from "@radix-ui/react-icons";

interface FeatureItem {
  icon: LucideIcon;
  text: string;
}

interface PricingPlan {
  name: string;
  priceMonthly: string;
  priceYearly?: string;
  description: string;
  bestFor: string;
  features?: FeatureItem[];
  mostPopular?: boolean;
  cta: {
    text: string;
    href: string;
  };
}

const PLANS: PricingPlan[] = [
  {
    name: "Free",
    priceMonthly: "$0",
    description: "Perfect for exploring knowledge management",
    bestFor: "Individuals getting started",
    features: [
      { icon: Video, text: "5 recordings per month" },
      { icon: FileText, text: "Basic transcription" },
      { icon: Cloud, text: "1GB storage" },
      { icon: Search, text: "Basic search" },
      { icon: Headphones, text: "Community support" },
    ],
    cta: {
      text: "Get started free",
      href: "/sign-up",
    },
  },
  {
    name: "Pro",
    mostPopular: true,
    priceMonthly: "$29",
    priceYearly: "$24",
    description: "For teams that need advanced AI features",
    bestFor: "Teams capturing knowledge at scale",
    features: [
      { icon: Video, text: "Unlimited recordings" },
      { icon: Sparkles, text: "AI-powered transcription" },
      { icon: Search, text: "Semantic search" },
      { icon: MessageSquare, text: "AI RAG assistant" },
      { icon: FileText, text: "Auto documentation" },
      { icon: Network, text: "Knowledge graph" },
      { icon: Users, text: "Team collaboration" },
      { icon: Zap, text: "Priority support" },
    ],
    cta: {
      text: "Start free trial",
      href: "/sign-up",
    },
  },
  {
    name: "Enterprise",
    priceMonthly: "Custom",
    description: "For organizations with advanced needs",
    bestFor: "Large teams with security requirements",
    features: [
      { icon: Check, text: "Everything in Pro" },
      { icon: Shield, text: "SSO & SAML authentication" },
      { icon: Cloud, text: "On-premise deployment" },
      { icon: Zap, text: "Custom integrations" },
      { icon: Headphones, text: "Dedicated account manager" },
      { icon: Shield, text: "99.9% SLA guarantee" },
    ],
    cta: {
      text: "Contact sales",
      href: "/contact",
    },
  },
];

interface Pricing31Props {
  title?: string;
  description?: string;
}

const Pricing31 = ({
  title = "Simple, transparent pricing",
  description = "Start free and upgrade as your team grows. Annual plans save 20%.",
}: Pricing31Props) => {
  return (
    <section className="py-24 lg:py-32">
      <div className="container">
        <div className="flex flex-col items-center justify-center gap-8">
          <div className="max-w-2xl text-center">
            <h1 className="text-foreground mb-4 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="text-muted-foreground text-lg">
              {description}
            </p>
          </div>
          <div className="mt-4 grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
            {PLANS.map((plan, index) => (
              <PlanCard key={index} plan={plan} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const PlanCard = ({ plan }: { plan: PricingPlan }) => {
  return (
    <div
      className={`relative flex h-full w-full flex-col rounded-xl border px-6 py-8 transition-all duration-300 ${
        plan?.mostPopular
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border bg-card hover:border-primary/50 hover:shadow-md"
      }`}
    >
      {plan.mostPopular && (
        <div className="bg-primary text-primary-foreground absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-1.5 text-xs font-semibold">
          Most popular
        </div>
      )}

      <div className="mb-2 text-xl font-semibold">{plan.name}</div>

      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{plan.priceMonthly}</span>
        {plan.priceMonthly !== "Custom" && (
          <span className="text-muted-foreground text-sm">/month</span>
        )}
      </div>

      {plan.priceYearly && (
        <div className="text-muted-foreground mb-4 text-sm">
          ${plan.priceYearly}/mo billed annually
        </div>
      )}

      <div className="text-muted-foreground mb-6 text-sm">
        {plan.bestFor}
      </div>

      <div className="text-foreground mb-6 font-medium">
        {plan.description}
      </div>

      <Button
        asChild
        className="w-full"
        variant={plan.mostPopular ? "default" : "outline"}
        size="lg"
      >
        <Link href={plan.cta.href}>
          {plan.cta.text}
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </Link>
      </Button>

      <div className="mt-8 flex flex-1 flex-col gap-3">
        {plan.features?.map((feature, index) => (
          <div key={index} className="text-foreground/90 flex items-center gap-3 text-sm">
            <feature.icon className="text-primary h-4 w-4 flex-shrink-0" />
            {feature.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export { Pricing31 };
