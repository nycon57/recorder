'use client';

import { SignUpButton } from '@clerk/nextjs';
import Image from 'next/image';

import { Button } from '@/app/components/ui/button';

type RecordCTAProps = {
  title?: string;
  description?: string;
  ctaLabel?: string;
  patternSrc?: string;
};

export default function RecordCTA({
  title = "Ready to Capture Your Team's Knowledge?",
  description = 'Start for free today. No credit card required.',
  ctaLabel = 'Get Started Free',
  patternSrc = '/images/patterns/grid-pattern.webp',
}: RecordCTAProps) {
  return (
    <section className="bg-gradient-to-br from-primary to-secondary relative overflow-hidden px-6 py-10 text-primary-foreground lg:py-26">
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        <Image
          src={patternSrc}
          alt=""
          fill
          priority
          className="object-cover opacity-10"
        />
      </div>

      <div className="relative z-10 container text-center">
        <h2 className="text-heading-1 mx-auto max-w-[637px] tracking-tight lg:text-[52px]">
          {title}
        </h2>

        <p className="text-body-md sm:text-body-lg mx-auto mt-5 max-w-3xl text-white/90">
          {description}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <SignUpButton mode="modal">
            <Button
              className="w-full bg-white text-foreground hover:bg-white/90 sm:w-auto"
              variant="default"
            >
              {ctaLabel}
            </Button>
          </SignUpButton>
        </div>
      </div>
    </section>
  );
}
