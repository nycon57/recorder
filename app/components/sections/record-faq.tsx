'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

type FaqItem = { question: string; answer: string };

export type RecordFAQProps = {
  tagline?: string;
  title?: string;
  description?: string;
  faqs?: FaqItem[];
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
  softBg?: boolean;
};

const DEFAULT_FAQS: FaqItem[] = [
  {
    question: 'Can I try Pro features for free?',
    answer:
      'Yes! We offer a 14-day free trial of Pro features with no credit card required. You can explore all advanced features including AI documentation, semantic search, and the AI assistant.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express, Discover) and offer annual billing with a discount. Enterprise customers can also pay via invoice.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Absolutely! You can upgrade or downgrade your plan at any time from your account settings. Changes take effect immediately, and we prorate billing adjustments.',
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer:
      'Your recordings and documents are safe. If you downgrade from Pro to Free, you retain access to all existing content but new recordings will be limited to the Free tier quota. You can export your data at any time.',
  },
  {
    question: 'Do you offer discounts for nonprofits or education?',
    answer:
      'Yes! We offer special discounts for nonprofits, educational institutions, and open-source projects. Contact our sales team to learn more about our discount programs.',
  },
  {
    question: 'Is my data secure and private?',
    answer:
      'Security and privacy are our top priorities. We use industry-standard encryption (AES-256) for data at rest and in transit. We never share your data with third parties and you maintain full ownership of all your content.',
  },
];

export default function RecordFAQ({
  tagline = 'FAQs',
  title = 'Frequently Asked Questions',
  description = 'Find answers to common questions about Record and get the information you need.',
  faqs = DEFAULT_FAQS,
  ctaHref = '/faq',
  ctaLabel = 'See All FAQs',
  className,
  softBg,
}: RecordFAQProps) {
  return (
    <section
      className={cn(
        'px-6 py-10 lg:py-24',
        softBg && 'bg-muted',
        className
      )}
    >
      <div className="container">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center text-center">
          <span className="text-body-xs-medium bg-card inline-flex h-8 items-center gap-2 rounded-[10px] border border-border px-3 py-0 leading-none shadow-sm">
            <Sparkles className="h-[14px] w-[14px] text-primary" />
            {tagline}
          </span>
          <h2 className="text-foreground text-heading-1 mt-4">
            {title}
          </h2>
          <p className="text-body-md sm:text-body-lg mt-4 max-w-[568px] text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-4xl space-y-3 lg:mt-12">
          <Accordion
            type="single"
            collapsible
            className="w-full space-y-[18px]"
          >
            {faqs.map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`item-${idx}`}
                className="border-none"
              >
                <div
                  className={cn(
                    'rounded-2xl border border-border',
                    softBg ? 'bg-card' : 'bg-muted'
                  )}
                >
                  <AccordionTrigger
                    className={cn(
                      'group flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-4 text-left sm:px-6 sm:py-5',
                      'hover:no-underline',
                      '[&>svg]:hidden'
                    )}
                  >
                    <span className="text-body-lg-medium text-foreground">
                      {item.question}
                    </span>
                    <span
                      aria-hidden
                      className="text-foreground text-xl group-data-[state=open]:hidden"
                    >
                      +
                    </span>
                    <span
                      aria-hidden
                      className="text-foreground hidden text-xl group-data-[state=open]:block"
                    >
                      −
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 sm:px-6 sm:pb-5">
                    <p className="text-body-md text-muted-foreground">{item.answer}</p>
                  </AccordionContent>
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild variant="secondary" className="px-5">
            <Link href={ctaHref}>
              <span className="mr-2">{ctaLabel}</span>
              <span aria-hidden>→</span>
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
