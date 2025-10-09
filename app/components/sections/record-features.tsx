'use client';

import { Mic, Search, Sparkles, Video, FileText, MessageSquare } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';

type BigFeature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
};

type SmallFeature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
};

export interface RecordFeaturesProps {
  id?: string;
  tagline?: string;
  title?: string;
  description?: string;
  bigFeatures?: BigFeature[];
  smallFeatures?: SmallFeature[];
}

const DEFAULT_BIG: BigFeature[] = [
  {
    icon: <Video className="h-8 w-8 text-primary" />,
    title: 'Browser Recording',
    description:
      'Capture screen, camera, and audio with our powerful browser-based recorder. No downloads required.',
  },
  {
    icon: <FileText className="h-8 w-8 text-secondary" />,
    title: 'AI Documentation',
    description:
      'Automatically generate comprehensive documentation from your recordings with GPT-5 Nano.',
  },
];

const DEFAULT_SMALL: SmallFeature[] = [
  {
    icon: <Mic className="h-6 w-6 text-primary" />,
    title: 'Transcription',
    description:
      'OpenAI Whisper provides accurate speech-to-text transcription with word-level timestamps.',
  },
  {
    icon: <Search className="h-6 w-6 text-accent" />,
    title: 'Semantic Search',
    description:
      'Find exactly what you need with vector embeddings and powerful semantic search.',
  },
  {
    icon: <MessageSquare className="h-6 w-6 text-primary" />,
    title: 'AI Assistant',
    description:
      'Ask questions and get answers from your knowledge base with RAG-powered AI chat.',
  },
];

export default function RecordFeatures({
  id = 'record-features',
  tagline = 'Features',
  title = 'Everything You Need',
  description = 'Keep your team\'s knowledge organized and accessible. Record, transcribe, document, and search - all powered by AI.',
  bigFeatures = DEFAULT_BIG,
  smallFeatures = DEFAULT_SMALL,
}: RecordFeaturesProps) {
  return (
    <section id={id} className="bg-background px-6">
      <div className="container py-10 lg:pt-30 lg:pb-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center text-center">
          <span className="text-body-xs-medium bg-card inline-flex h-8 items-center gap-2 rounded-[10px] border border-border px-3 py-0 leading-none shadow-sm">
            <Sparkles className="h-[14px] w-[14px] text-primary" />
            {tagline}
          </span>

          <h2 className="text-foreground text-heading-1 mt-4 max-w-[616px] tracking-tight lg:text-[52px]">
            {title}
          </h2>

          <p className="text-body-md sm:text-body-lg mx-auto mt-4 max-w-3xl text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:mt-14">
          <div className="grid gap-6 lg:grid-cols-2">
            {bigFeatures.map((feature, i) => {
              const content = (
                <Card
                  key={i}
                  className="bg-card border-border shadow-sm transition-all hover:shadow-lg"
                >
                  <CardHeader>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-heading-4">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-body-md mt-2">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );

              return feature.href ? (
                <Link key={i} href={feature.href} className="block">
                  {content}
                </Link>
              ) : (
                content
              );
            })}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {smallFeatures.map((feature, i) => {
              const item = (
                <Card
                  key={i}
                  className="bg-card border-border shadow-sm transition-all hover:shadow-lg"
                >
                  <CardContent className="pt-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      {feature.icon}
                    </div>
                    <h4 className="text-foreground text-heading-5 mb-2">
                      {feature.title}
                    </h4>
                    <p className="text-body-md text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );

              return feature.href ? (
                <Link key={i} href={feature.href} className="block">
                  {item}
                </Link>
              ) : (
                item
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
