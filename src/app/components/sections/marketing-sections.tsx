import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  FileSearch,
  Mic2,
  Network,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';

const features = [
  {
    title: 'Record what matters',
    description: 'Capture meetings, training sessions, and team knowledge in one searchable workspace.',
    icon: Mic2,
  },
  {
    title: 'Turn recordings into answers',
    description: 'Transform raw conversations into structured context your team can use immediately.',
    icon: Brain,
  },
  {
    title: 'Find the source fast',
    description: 'Search across recordings, docs, and saved pages with citations back to the original material.',
    icon: FileSearch,
  },
];

const proofPoints = [
  {
    title: 'Shared memory',
    description: 'Keep team knowledge accessible after calls, handoffs, and onboarding sessions.',
  },
  {
    title: 'Context routing',
    description: 'Send the right answer path to recordings, documents, or vendor knowledge.',
  },
  {
    title: 'Review queues',
    description: 'Promote important answers into trusted wiki pages before they spread.',
  },
];

const plans = [
  {
    name: 'Starter',
    price: '$19',
    summary: 'For individuals building a searchable knowledge base.',
  },
  {
    name: 'Team',
    price: '$49',
    summary: 'For teams that need shared recordings, review, and recall.',
  },
  {
    name: 'Business',
    price: 'Custom',
    summary: 'For organizations with governance and vendor knowledge needs.',
  },
];

export function AuroraHero() {
  return (
    <section className="border-b bg-background">
      <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            Knowledge Intelligence Layer
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight text-foreground md:text-6xl">
            Tribora turns team conversations into trusted knowledge.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Record, upload, search, and review the knowledge your organization creates every day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Start capturing
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs/getting-started/welcome">Read the docs</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-sm border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <BookOpenCheck className="size-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">Team knowledge brief</p>
              <p className="text-sm text-muted-foreground">Generated from recordings and docs</p>
            </div>
          </div>
          <div className="grid gap-3">
            {proofPoints.map((point) => (
              <div key={point.title} className="rounded-sm border border-border bg-background p-4">
                <p className="font-medium text-foreground">{point.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuroraValueProp() {
  return (
    <section className="bg-muted/20 py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1fr]">
          <div>
            <p className="text-sm font-medium text-primary">Operational memory</p>
            <h2 className="mt-3 text-3xl font-semibold text-foreground">
              Replace scattered recall with one reviewed knowledge layer.
            </h2>
          </div>
          <p className="text-lg leading-8 text-muted-foreground">
            Tribora helps teams preserve the context behind decisions, questions, customer calls, and internal training.
            Review workflows keep important answers accurate before they become shared references.
          </p>
        </div>
      </div>
    </section>
  );
}

export function AuroraFeatures() {
  return (
    <section className="bg-background py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-medium text-primary">Core workflow</p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground">
            Capture, structure, and recall knowledge.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-sm border border-border bg-card p-5">
                <Icon className="size-5 text-primary" />
                <h3 className="mt-4 font-medium text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function AuroraTestimonials() {
  return (
    <section className="border-y bg-muted/20 py-16">
      <div className="mx-auto max-w-5xl px-6 text-center lg:px-8">
        <Network className="mx-auto size-8 text-primary" />
        <blockquote className="mt-6 text-2xl font-medium leading-10 text-foreground">
          Teams should not have to remember which meeting, page, or person held the answer.
        </blockquote>
        <p className="mt-4 text-muted-foreground">
          Tribora keeps the path back to the original knowledge visible.
        </p>
      </div>
    </section>
  );
}

export function AuroraPricing() {
  return (
    <section className="bg-background py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-medium text-primary">Plans</p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground">
            Start small and scale the knowledge layer with your team.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className="rounded-sm border border-border bg-card p-5">
              <p className="font-medium text-foreground">{plan.name}</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{plan.price}</p>
              <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{plan.summary}</p>
              <Button asChild className="mt-5 w-full" variant={plan.name === 'Team' ? 'default' : 'outline'}>
                <Link href="/pricing">View plan</Link>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AuroraCTA() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold">Build a knowledge layer your team can trust.</h2>
          <p className="mt-3 max-w-2xl text-primary-foreground/80">
            Capture important context once and make it searchable everywhere your team works.
          </p>
        </div>
        <Button asChild variant="secondary" size="lg">
          <Link href="/sign-up">
            Get started
            <CheckCircle2 className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
