"use client";

import {
  Mic,
  Brain,
  Search,
  MessageSquare,
  FileText,
  Users,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

// Based on shadcnblocks feature26 pattern with Caribbean Green palette
interface Feature {
  icon: typeof Mic;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Mic,
    title: "Browser Recording",
    description: "Capture screen, camera, and audio instantly. No downloads required.",
  },
  {
    icon: Brain,
    title: "AI Transcription",
    description: "95%+ accuracy with Whisper AI. 50+ languages supported.",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description: "Find anything instantly with context-aware AI search.",
  },
  {
    icon: MessageSquare,
    title: "RAG Assistant",
    description: "Ask questions, get answers with exact citations from your recordings.",
  },
  {
    icon: FileText,
    title: "Auto Documentation",
    description: "Transform recordings into structured docs automatically.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Share knowledge across your organization with RBAC.",
  },
];

const RegistryFeatures = () => {
  return (
    <section className="py-24 sm:py-32 bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full
          bg-accent/10 blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full
          bg-secondary/10 blur-[80px] animate-float" />
      </div>

      <div className="container px-6 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full
              glass-caribbean border border-accent/30">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Powerful Features</span>
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-6 tracking-tight">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-accent to-secondary
              bg-clip-text text-transparent">
              Capture Knowledge
            </span>
          </h2>

          <p className="text-xl text-muted-foreground font-light">
            From recording to AI-powered answers, transform tacit knowledge into searchable intelligence.
          </p>
        </div>

        {/* Features Grid - based on feature26 pattern */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className={cn(
                  "group relative p-8 rounded-2xl overflow-hidden",
                  "glass-dark border border-accent/10",
                  "hover:border-accent/30 transition-all duration-500",
                )}
              >
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent
                  opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center
                      group-hover:bg-accent/20 group-hover:scale-110 transition-all duration-300">
                      <Icon className="h-7 w-7 text-accent" />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-light text-foreground mb-3 tracking-tight">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed font-light">
                    {feature.description}
                  </p>
                </div>

                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
                  transition-opacity duration-500
                  bg-gradient-to-r from-[#00DF81]/10 via-[#2CC295]/10 to-[#00DF81]/10
                  blur-xl -z-10" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export { RegistryFeatures };
