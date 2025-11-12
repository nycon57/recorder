'use client';

import { Sparkles } from 'lucide-react';
import Image from 'next/image';

type Testimonial = {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatarSrc?: string;
};

export type RecordTestimonialsProps = {
  tagline?: string;
  title?: string;
  subtitle?: string;
  testimonials?: Testimonial[];
};

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Record has transformed how we capture and share knowledge. Our onboarding time has been cut in half because new hires can watch expert walkthroughs and search for answers instantly.',
    author: 'Sarah Chen',
    role: 'Head of Engineering',
    company: 'TechCorp',
    avatarSrc: '/images/testimonials/sarah.webp',
  },
  {
    quote:
      'The AI-generated documentation is incredible. We used to spend hours writing process docs, now Record does it automatically from our screen recordings. Game-changer.',
    author: 'Michael Rodriguez',
    role: 'Operations Manager',
    company: 'StartupXYZ',
    avatarSrc: '/images/testimonials/michael.webp',
  },
  {
    quote:
      "We've built an entire knowledge base from our team's expertise. The semantic search means anyone can find the exact information they need in seconds. It's like having a personal expert on call 24/7.",
    author: 'Emily Watson',
    role: 'Customer Success Lead',
    company: 'SaaS Co',
    avatarSrc: '/images/testimonials/emily.webp',
  },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function RecordTestimonials({
  tagline = 'Testimonials',
  title = 'Trusted by Teams Worldwide',
  subtitle = 'See how teams are transforming their knowledge management',
  testimonials = DEFAULT_TESTIMONIALS,
}: RecordTestimonialsProps) {
  return (
    <section id="record-testimonials" className="px-6 py-10 lg:py-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-body-xs-medium bg-card inline-flex h-8 items-center gap-2 rounded-[10px] border border-border px-3 py-0 leading-none shadow-sm">
            <Sparkles className="h-[14px] w-[14px] text-primary" />
            {tagline}
          </span>

          <h2 className="text-foreground text-heading-1 mt-4">
            {title}
          </h2>
          <p className="text-body-md sm:text-body-lg mx-auto mt-4 max-w-2xl text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <article
              key={i}
              className="bg-card rounded-[24px] border border-border p-6 shadow-sm md:p-8"
            >
              <div className="flex items-start gap-4">
                {t.avatarSrc ? (
                  <Image
                    src={t.avatarSrc}
                    alt={t.author}
                    width={48}
                    height={48}
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground font-semibold">
                    {getInitials(t.author)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-body-sm-bold text-foreground">
                    {t.author}
                  </div>
                  <div className="text-body-sm text-muted-foreground">
                    {t.role}
                  </div>
                  <div className="text-body-xs text-muted-foreground/70 mt-0.5">
                    {t.company}
                  </div>
                </div>
              </div>

              <p className="text-body-md text-foreground mt-6">"{t.quote}"</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
