"use client";

import { CheckIcon, Info, MinusIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { cn } from "@/lib/utils/cn";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Switch } from "@/app/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";

type TierName = "Free" | "Pro" | "Premium";

interface Tier {
  name: string;
  price: string;
  annualPrice: string;
  description: string;
}

interface Feature {
  name: string;
  tiers: Partial<Record<TierName, boolean>>;
  tooltip?: string;
}

interface Section {
  name: string;
  features: Feature[];
}

const tiers: Tier[] = [
  {
    name: "Free",
    price: "$0",
    annualPrice: "$0",
    description: "Perfect for individuals exploring AI-powered recording",
  },
  {
    name: "Pro",
    price: "$29",
    annualPrice: "$290",
    description: "For teams that need advanced AI capabilities",
  },
  {
    name: "Premium",
    price: "$99",
    annualPrice: "$990",
    description: "Advanced features for large organizations",
  },
];

const sections: Section[] = [
  {
    name: "Core Features",
    features: [
      {
        name: "Browser Recording",
        tiers: { Free: true, Pro: true, Premium: true },
        tooltip: "Capture screen, camera, and audio instantly",
      },
      {
        name: "AI Transcription",
        tiers: { Free: true, Pro: true, Premium: true },
        tooltip: "95%+ accuracy with Whisper AI",
      },
      {
        name: "Semantic Search",
        tiers: { Pro: true, Premium: true },
        tooltip: "Find anything instantly with context-aware AI search",
      },
      {
        name: "RAG Assistant",
        tiers: { Premium: true },
        tooltip: "Ask questions, get answers with exact citations",
      },
    ],
  },
  {
    name: "Collaboration",
    features: [
      {
        name: "Personal workspace",
        tiers: { Free: true, Pro: true, Premium: true },
        tooltip: "Your private recording library",
      },
      {
        name: "Team sharing",
        tiers: { Pro: true, Premium: true },
        tooltip: "Share knowledge across your organization",
      },
      {
        name: "Advanced RBAC",
        tiers: { Premium: true },
        tooltip: "Role-based access control for enterprise",
      },
      {
        name: "SSO & SAML",
        tiers: { Premium: true },
        tooltip: "Enterprise authentication and security",
      },
    ],
  },
];

const RegistryPricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  return (
    <section className="py-24 sm:py-32 bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/3 h-[600px] w-[600px] rounded-full
          bg-secondary/10 blur-[100px] animate-float" />
        <div className="absolute bottom-1/3 right-1/3 h-[500px] w-[500px] rounded-full
          bg-accent/10 blur-[80px] animate-pulse-slow" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mt-2 text-4xl font-light tracking-tight sm:text-5xl text-foreground">
            Choose Your Plan
          </p>
        </div>
        <p className="text-[#AAC8C4] mx-auto mt-6 max-w-2xl text-center text-lg leading-8 font-light">
          Scale from solo to enterprise with AI-powered knowledge management
        </p>

        <div className="mt-10 flex flex-col items-center gap-2 lg:hidden">
          <span className="flex items-center gap-3 text-base font-medium text-[#F1F7F6]">
            Annual
            <Switch
              checked={isAnnual}
              onCheckedChange={() => setIsAnnual(!isAnnual)}
            />
            Monthly
          </span>
        </div>

        {/* Mobile view */}
        <div className="mx-auto mt-12 max-w-md space-y-8 sm:mt-16 lg:hidden">
          {tiers.map((tier) => (
            <Card key={tier.name} className="p-8 glass-dark border-[#00DF81]/10">
              <CardHeader className="p-0">
                <div className="flex flex-col gap-2 text-center">
                  <CardTitle className="text-xl font-light text-[#F1F7F6]">
                    {tier.name}
                  </CardTitle>
                  <span className="text-[#AAC8C4] text-sm font-light">
                    {tier.description}
                  </span>
                </div>
                <div className="flex flex-col justify-center gap-x-1 pt-8 text-center">
                  <span className="text-4xl font-light text-[#F1F7F6]">
                    {isAnnual ? tier.annualPrice : tier.price}
                  </span>
                  <span className="text-[#AAC8C4] text-sm leading-6 font-light">
                    /month
                  </span>
                </div>
              </CardHeader>
              <Button className="mt-8 w-full bg-gradient-to-r from-[#00DF81] to-[#2CC295] text-[#01001a] font-medium hover:shadow-[0_0_30px_rgba(0,223,129,0.5)]">
                Get Started
              </Button>
              <CardContent className="p-0">
                <ul className="mt-10 space-y-4 text-sm leading-6">
                  <TooltipProvider>
                    {sections.map((section) => (
                      <li key={section.name}>
                        <ul role="list" className="space-y-4">
                          {section.features.map(
                            (feature) =>
                              feature.tiers[tier.name as TierName] && (
                                <li
                                  key={feature.name}
                                  className="flex items-center justify-between"
                                >
                                  <span className="flex items-center gap-3 text-[#AAC8C4]">
                                    <CheckIcon className="h-5 w-5 flex-none text-[#00DF81]" />
                                    <span>{feature.name}</span>
                                  </span>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Info className="text-[#AAC8C4]/60 ml-1 h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {feature.tooltip}
                                    </TooltipContent>
                                  </Tooltip>
                                </li>
                              ),
                          )}
                        </ul>
                      </li>
                    ))}
                  </TooltipProvider>
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop view */}
        <div className="isolate mt-20 hidden lg:block">
          <div className="relative -mx-8">
            {tiers.map((tier, idx) => (
              <div
                className="absolute inset-x-4 inset-y-0 -z-10 flex"
                key={tier.name}
              >
                <div
                  className="flex w-1/4 px-4"
                  style={{
                    marginLeft: `${(idx + 1) * 25}%`,
                  }}
                >
                  <div className="w-full border-x border-[#00DF81]/10" />
                </div>
              </div>
            ))}
            <table className="w-full table-fixed border-separate border-spacing-x-8 text-left">
              <thead>
                <tr>
                  <td />
                  {tiers.map((tier) => (
                    <th key={tier.name} className="px-6 pt-6 xl:px-8 xl:pt-8">
                      <div className="flex flex-col gap-2 text-center">
                        <span className="text-xl font-light uppercase leading-7 text-[#F1F7F6]">
                          {tier.name}
                        </span>
                        <span className="text-[#AAC8C4] text-sm font-light">
                          {tier.description}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>
                    <div className="flex flex-col gap-2">
                      <p className="text-[#AAC8C4] text-sm font-light">
                        Billing
                      </p>
                      <span className="flex items-center gap-3 text-base font-medium text-[#F1F7F6]">
                        Annual
                        <Switch
                          checked={isAnnual}
                          onCheckedChange={() => setIsAnnual(!isAnnual)}
                        />
                        Monthly
                      </span>
                    </div>
                  </th>
                  {tiers.map((tier) => (
                    <td key={tier.name} className="px-6 pt-10 xl:px-8">
                      <div className="flex flex-col justify-center gap-x-1 text-center">
                        <span className="text-4xl font-light text-[#F1F7F6]">
                          {isAnnual ? tier.annualPrice : tier.price}
                        </span>
                        <span className="text-[#AAC8C4] text-sm leading-6 font-light">
                          /month
                        </span>
                      </div>
                      <Button className="mt-8 w-full bg-gradient-to-r from-[#00DF81] to-[#2CC295] text-[#01001a] font-medium hover:shadow-[0_0_30px_rgba(0,223,129,0.5)]">
                        Get Started
                      </Button>
                    </td>
                  ))}
                </tr>
                {sections.map((section, sectionIdx) => (
                  <Fragment key={section.name}>
                    <tr>
                      <th
                        className={cn(
                          "pb-4 text-sm font-medium leading-6 text-[#F1F7F6]",
                          sectionIdx === 0 ? "pt-8" : "pt-16",
                        )}
                      >
                        {section.name}
                      </th>
                    </tr>
                    <TooltipProvider delayDuration={200}>
                      {section.features.map((feature) => (
                        <tr key={feature.name}>
                          <th className="flex items-center justify-between py-4 text-sm font-light leading-6 text-[#AAC8C4]">
                            {feature.name}
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="text-[#AAC8C4]/60 hover:text-[#00DF81] ml-1 h-4 w-4 transition-colors" />
                              </TooltipTrigger>
                              <TooltipContent>{feature.tooltip}</TooltipContent>
                            </Tooltip>
                          </th>
                          {tiers.map((tier) => (
                            <td key={tier.name} className="px-6 py-4 xl:px-8">
                              <>
                                {feature.tiers[tier.name as TierName] ? (
                                  <CheckIcon className="mx-auto h-5 w-5 text-[#00DF81]" />
                                ) : (
                                  <MinusIcon className="text-[#AAC8C4]/40 mx-auto h-5 w-5" />
                                )}
                              </>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </TooltipProvider>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export { RegistryPricing };
