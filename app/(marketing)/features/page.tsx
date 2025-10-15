import { Video, FileText, Search, MessageSquare, Users, Zap } from 'lucide-react';

import { RecordFeatures, RecordCTA } from '@/app/components/sections';

export default function FeaturesPage() {
  const detailedFeatures = [
    {
      icon: 'video' as const,
      title: 'Browser-Based Recording',
      description:
        'Capture your screen, camera, and audio directly in your browser. No downloads, no plugins, no hassle. Just open the app and start recording.',
      bullets: [
        'Screen share with system audio',
        'Webcam overlay (picture-in-picture)',
        'High-quality microphone capture',
        'Live preview and device selection',
      ],
      imageSide: 'right' as const,
    },
    {
      icon: 'file-text' as const,
      title: 'Automatic Transcription',
      description:
        'Your spoken words magically become accurate text. Powered by OpenAI Whisper, our transcription includes timestamps, speaker detection, and high accuracy across multiple languages.',
      bullets: [
        'Word-level timestamps for navigation',
        'Multi-language support',
        'Editable transcripts',
        'Export to text, SRT, VTT',
      ],
      imageSide: 'left' as const,
    },
    {
      icon: 'zap' as const,
      title: 'AI-Powered Documentation',
      description:
        'Turn any recording into structured documentation automatically. Our AI analyzes your content and generates organized, readable docs with headings, summaries, and key points.',
      bullets: [
        'Automatic structure and formatting',
        'Key points and summaries',
        'Editable and customizable',
        'Export to Markdown, PDF, HTML',
      ],
      imageSide: 'right' as const,
    },
    {
      icon: 'search' as const,
      title: 'Semantic Search',
      description:
        "Find exactly what you're looking for, even if you don't remember the exact words. Our AI-powered search understands context and meaning, not just keywords.",
      bullets: [
        'Context-aware search',
        'Search across all recordings',
        'Jump to exact moments in videos',
        'Filters and advanced queries',
      ],
      imageSide: 'left' as const,
    },
    {
      icon: 'message-square' as const,
      title: 'AI Assistant',
      description:
        "Ask questions about your recordings and get instant answers with citations. Your personal AI assistant knows everything you've recorded and helps you find information fast.",
      bullets: [
        'Natural language queries',
        'Answers with source citations',
        'Conversation history',
        'Per-recording and global chat',
      ],
      imageSide: 'right' as const,
    },
    {
      icon: 'users' as const,
      title: 'Team Collaboration',
      description:
        'Share knowledge across your organization. Invite team members, manage permissions, and build a centralized knowledge base everyone can access.',
      bullets: [
        'Organization management',
        'Role-based access control',
        'Public and private sharing',
        'Usage analytics and insights',
      ],
      imageSide: 'left' as const,
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container px-6 py-16 mx-auto max-w-7xl text-center">
        <span className="text-body-xs-medium bg-card inline-flex h-8 items-center gap-2 rounded-[10px] border border-border px-3 py-0 leading-none shadow-[0_1px_2px_0_rgba(13,13,18,0.06)]">
          <Zap className="h-3 w-3 text-primary" />
          Features
        </span>
        <h1 className="text-heading-1 mt-4 lg:text-[52px]">
          Everything You Need to Capture and Share Knowledge
        </h1>
        <p className="text-body-lg text-muted-foreground max-w-3xl mx-auto mt-4">
          From recording to AI-powered answers, Record provides a complete
          knowledge management platform for modern teams.
        </p>
      </section>

      {/* Feature Sections */}
      <section className="container px-6 py-12 mx-auto max-w-7xl">
        {detailedFeatures.map((feature, index) => {
          const Icon =
            feature.icon === 'video'
              ? Video
              : feature.icon === 'file-text'
                ? FileText
                : feature.icon === 'zap'
                  ? Zap
                  : feature.icon === 'search'
                    ? Search
                    : feature.icon === 'message-square'
                      ? MessageSquare
                      : Users;

          return (
            <div
              key={index}
              className={`grid md:grid-cols-2 gap-12 items-center mb-24 ${
                index === detailedFeatures.length - 1 ? 'mb-0' : ''
              }`}
            >
              <div
                className={
                  feature.imageSide === 'left' ? 'order-2 md:order-1' : ''
                }
              >
                <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-8 h-64 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    [{feature.title} Screenshot]
                  </div>
                </div>
              </div>
              <div
                className={
                  feature.imageSide === 'left' ? 'order-1 md:order-2' : ''
                }
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-heading-3">{feature.title}</h2>
                </div>
                <p className="text-body-lg text-muted-foreground mb-6">
                  {feature.description}
                </p>
                <ul className="space-y-3">
                  {feature.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-accent text-xs">
                          ✓
                        </span>
                      </div>
                      <span className="text-foreground">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </section>

      <RecordCTA />
    </div>
  );
}
