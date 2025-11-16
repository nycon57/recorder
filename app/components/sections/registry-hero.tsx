"use client";

import { ArrowRight, Play, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/app/components/ui/button";

// Based on shadcnblocks hero71 pattern with Caribbean Green palette
const RegistryHero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Gradient background - adapted from hero71 */}
      <div className="absolute inset-0">
        {/* Radial gradients */}
        <div className="absolute top-0 right-1/4 h-[600px] w-[600px] rounded-full
          bg-[#00df82]/20 blur-[135px] mix-blend-lighten animate-pulse-slow" />
        <div className="absolute bottom-1/4 left-1/4 h-[500px] w-[500px] rounded-full
          bg-[#2cc295]/15 blur-[120px] mix-blend-lighten animate-float" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #00df82 1px, transparent 1px),
              linear-gradient(to bottom, #00df82 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }}
        />
      </div>

      <div className="relative z-10 container px-6">
        <div className="mx-auto max-w-5xl text-center">
          {/* Badge */}
          <div className="mb-8 flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full
              glass-caribbean border border-accent/30">
              <Sparkles className="h-4 w-4 text-accent animate-pulse" />
              <span className="text-sm font-medium text-accent">AI-Powered Knowledge Management</span>
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-light leading-tight tracking-tight mb-6">
            <span className="text-foreground">Capture. </span>
            <span className="bg-gradient-to-r from-[#00df82] via-[#2cc295] to-[#17876e]
              bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]
              drop-shadow-[0_0_40px_rgba(0,223,130,0.6)]">
              Transform.
            </span>
            <span className="text-foreground"> Discover.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-muted-foreground font-light leading-relaxed max-w-3xl mx-auto mb-12">
            Stop losing expertise when team members leave. Record once, search forever—your team's knowledge, instantly accessible.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-gradient-to-r from-accent to-secondary
                  text-accent-foreground font-medium px-8 py-6 text-lg
                  hover:shadow-[0_0_40px_rgba(0,223,130,0.6)]
                  transition-all duration-300
                  group"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-2 transition-transform" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="glass-caribbean border border-accent/30
                text-accent hover:bg-accent/10 font-light
                px-8 py-6 text-lg group"
              onClick={() => {
                // TODO: Replace with actual demo video URL or modal
                window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank');
              }}
              aria-label="Watch product demo video"
            >
              <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              Watch Demo
            </Button>
          </div>

          {/* Trust badge */}
          <p className="text-sm text-muted-foreground/60 font-light">
            No credit card required • 14-day free trial • Cancel anytime
          </p>

          {/* Hero image placeholder */}
          <div className="mt-20 relative">
            <div className="glass-dark border border-accent/20 rounded-2xl p-2 overflow-hidden
              shadow-[0_0_60px_rgba(0,223,130,0.2)]">
              <div className="aspect-video bg-gradient-to-br from-accent/10 to-secondary/10
                rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <Play className="h-20 w-20 text-accent mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground font-light">Demo Video</p>
                </div>
              </div>
            </div>

            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-secondary/20 to-accent/20
              blur-3xl -z-10 opacity-50" />
          </div>
        </div>
      </div>
    </section>
  );
};

export { RegistryHero };
