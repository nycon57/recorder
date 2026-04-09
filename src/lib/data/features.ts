/**
 * Feature Pages Data Registry
 *
 * Centralized data for all /features/[id] pages.
 * Each feature has complete content for hero, problem, solution, stats, FAQ, etc.
 *
 * IMPORTANT: Icons are stored as string names to avoid Server/Client Component
 * serialization issues. Use the IconName type and ICON_MAP in components.
 */

// =============================================================================
// ICON NAME TYPE (for serialization-safe icon references)
// =============================================================================

export type IconName =
  | 'Video'
  | 'Mic'
  | 'Search'
  | 'Bot'
  | 'FileText'
  | 'Users'
  | 'Zap'
  | 'Clock'
  | 'Globe'
  | 'Brain'
  | 'Target'
  | 'Layers'
  | 'Network'
  | 'ArrowUpRight'
  | 'Shield'
  | 'Sparkles';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type FeatureId =
  | 'recording'
  | 'transcription'
  | 'search'
  | 'assistant'
  | 'documentation'
  | 'collaboration';

export interface FeatureHeroData {
  badge: string;
  headline: string;
  highlightedText: string;
  subtitle: string;
  primaryCta: { text: string; href: string };
  secondaryCta: { text: string; href: string };
}

export interface FeatureProblemData {
  headline: string;
  painPoints: Array<{
    icon: IconName;
    title: string;
    description: string;
  }>;
  quote?: {
    text: string;
    author: string;
    role: string;
  };
}

export interface FeatureSolutionTab {
  id: string;
  title: string;
  description: string;
  features: string[];
  icon: IconName;
}

export interface FeatureSolutionData {
  headline: string;
  subtitle: string;
  tabs: FeatureSolutionTab[];
}

export interface FeatureStatData {
  value: string;
  label: string;
  description: string;
}

export interface FeatureDeepDiveItem {
  title: string;
  description: string;
  icon: IconName;
  size: 'small' | 'medium' | 'large';
}

export interface FeatureDeepDiveData {
  headline: string;
  subtitle: string;
  items: FeatureDeepDiveItem[];
}

export interface ComparisonRow {
  feature: string;
  tribora: boolean | string;
  competitor1: boolean | string;
  competitor2: boolean | string;
}

export interface ComparisonData {
  headline: string;
  subtitle: string;
  competitors: [string, string];
  rows: ComparisonRow[];
}

export interface TestimonialData {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FeaturePageData {
  id: FeatureId;
  icon: IconName;
  meta: {
    title: string;
    description: string;
    keywords: string[];
  };
  hero: FeatureHeroData;
  problem: FeatureProblemData;
  solution: FeatureSolutionData;
  deepDive: FeatureDeepDiveData;
  stats: FeatureStatData[];
  comparison?: ComparisonData;
  testimonials: TestimonialData[];
  faq: FAQItem[];
  relatedFeatures: FeatureId[];
  isMoat?: boolean; // For assistant & collaboration - get bespoke designs
}

// =============================================================================
// FEATURE DATA
// =============================================================================

export const FEATURES: Record<FeatureId, FeaturePageData> = {
  // ===========================================================================
  // RECORDING
  // ===========================================================================
  recording: {
    id: 'recording',
    icon: 'Video',
    meta: {
      title: 'Browser-Based Recording | Tribora',
      description:
        'Capture screen recordings and voice in one click. No downloads, no plugins. Record your expertise directly in the browser.',
      keywords: [
        'screen recording',
        'browser recording',
        'knowledge capture',
        'no download recorder',
      ],
    },
    hero: {
      badge: 'One-Click Capture',
      headline: 'Capture expertise',
      highlightedText: 'in one click',
      subtitle:
        'Record your screen and voice directly in your browser. No downloads, no plugins, no friction. Your knowledge is one click away from being preserved.',
      primaryCta: { text: 'Start Recording Free', href: '/sign-up' },
      secondaryCta: { text: 'See How It Works', href: '#solution' },
    },
    problem: {
      headline: 'Your best engineer left. Now what?',
      painPoints: [
        {
          icon: 'Clock',
          title: 'Knowledge walks out the door',
          description:
            'When experts leave, years of tribal knowledge vanish overnight. No documentation can capture what they know.',
        },
        {
          icon: 'FileText',
          title: 'Documentation is a chore',
          description:
            "Writing docs takes hours. By the time you're done, the process has already changed.",
        },
        {
          icon: 'Users',
          title: 'New hires struggle',
          description:
            'Onboarding takes weeks because institutional knowledge lives in people, not systems.',
        },
      ],
      quote: {
        text: 'Our best engineer left and took all the knowledge with them.',
        author: 'Engineering Manager',
        role: 'Series B Startup',
      },
    },
    solution: {
      headline: 'Recording reimagined for knowledge',
      subtitle:
        'Not just video. Intelligent capture that understands what you do.',
      tabs: [
        {
          id: 'capture',
          title: 'Instant Capture',
          description:
            'One click to start recording. No setup, no downloads, no waiting.',
          features: [
            'Browser-native recording',
            'Screen + webcam + audio',
            'No plugins required',
            'Works on any device',
          ],
          icon: 'Zap',
        },
        {
          id: 'quality',
          title: 'High Quality',
          description:
            'Crystal clear recordings that capture every detail of your workflow.',
          features: [
            'Up to 4K resolution',
            'Multi-monitor support',
            'Tab or window capture',
            'System audio included',
          ],
          icon: 'Video',
        },
        {
          id: 'organize',
          title: 'Auto-Organize',
          description:
            'Recordings automatically tagged, titled, and organized by AI.',
          features: [
            'AI-generated titles',
            'Automatic tagging',
            'Smart folders',
            'Full-text search',
          ],
          icon: 'Layers',
        },
      ],
    },
    deepDive: {
      headline: 'Everything you need to capture knowledge',
      subtitle: 'Built for teams who value expertise',
      items: [
        {
          title: 'No Downloads',
          description:
            'Works entirely in your browser. Chrome, Edge, Safari supported.',
          icon: 'Globe',
          size: 'medium',
        },
        {
          title: 'Privacy First',
          description:
            'Your recordings stay in your organization. SOC 2 compliant.',
          icon: 'Shield',
          size: 'small',
        },
        {
          title: 'Unlimited Length',
          description:
            'Record as long as you need. No arbitrary time limits on paid plans.',
          icon: 'Clock',
          size: 'small',
        },
        {
          title: 'Instant Processing',
          description:
            'Recordings start processing immediately. No waiting in queues.',
          icon: 'Zap',
          size: 'large',
        },
      ],
    },
    stats: [
      {
        value: '<5s',
        label: 'To Start Recording',
        description: 'From click to capture',
      },
      {
        value: '4K',
        label: 'Max Resolution',
        description: 'Crystal clear quality',
      },
      {
        value: '100%',
        label: 'Browser-Based',
        description: 'No downloads needed',
      },
      {
        value: '∞',
        label: 'Recording Length',
        description: 'No time limits',
      },
    ],
    testimonials: [
      {
        quote:
          'I used to spend 30 minutes setting up screen recording software. Now I just click and go.',
        author: 'Sarah Chen',
        role: 'Product Manager',
        company: 'TechFlow',
      },
      {
        quote:
          "The best recording tool is the one you'll actually use. Tribora removed every excuse not to document.",
        author: 'Marcus Johnson',
        role: 'Engineering Lead',
        company: 'ScaleUp Inc',
      },
    ],
    faq: [
      {
        question: 'Which browsers are supported?',
        answer:
          'Tribora works on Chrome, Edge, and Safari. We recommend Chrome for the best experience with all features.',
      },
      {
        question: 'Can I record specific tabs or windows?',
        answer:
          'Yes! You can choose to record your entire screen, a specific window, or just a browser tab.',
      },
      {
        question: 'Is there a recording time limit?',
        answer:
          'Free accounts can record up to 30 minutes per video. Paid plans have unlimited recording length.',
      },
      {
        question: 'Can I record with my webcam?',
        answer:
          'Yes, you can include a webcam bubble in your recordings, or record webcam-only videos.',
      },
    ],
    relatedFeatures: ['transcription', 'documentation', 'search'],
  },

  // ===========================================================================
  // TRANSCRIPTION
  // ===========================================================================
  transcription: {
    id: 'transcription',
    icon: 'Mic',
    meta: {
      title: 'AI-Powered Transcription | Tribora',
      description:
        '95%+ accuracy transcription in 50+ languages. Turn your recordings into searchable text automatically.',
      keywords: [
        'transcription',
        'speech to text',
        'audio transcription',
        'video transcription',
      ],
    },
    hero: {
      badge: '50+ Languages',
      headline: 'Every word,',
      highlightedText: 'perfectly captured',
      subtitle:
        'Industry-leading AI transcription with 95%+ accuracy. Your recordings become searchable text in minutes, not hours.',
      primaryCta: { text: 'Try Free Transcription', href: '/sign-up' },
      secondaryCta: { text: 'See Accuracy Demo', href: '#solution' },
    },
    problem: {
      headline: 'Buried in recordings no one can search',
      painPoints: [
        {
          icon: 'Clock',
          title: 'Hours of unwatched video',
          description:
            'You have 200 Loom videos. Nobody watches them because finding the right moment is impossible.',
        },
        {
          icon: 'Search',
          title: 'Ctrl+F doesn\'t work on video',
          description:
            'The answer is in a recording somewhere, but you\'d have to watch hours to find it.',
        },
        {
          icon: 'Globe',
          title: 'Global teams, language barriers',
          description:
            'Your team speaks 5 languages. Most transcription tools only support English well.',
        },
      ],
      quote: {
        text: 'We have 200 Loom videos but no one watches them.',
        author: 'Operations Lead',
        role: 'Remote-First Startup',
      },
    },
    solution: {
      headline: 'Transcription that actually works',
      subtitle: 'Powered by the same AI that understands context',
      tabs: [
        {
          id: 'accuracy',
          title: 'High Accuracy',
          description:
            '95%+ accuracy with automatic punctuation and speaker detection.',
          features: [
            '95%+ word accuracy',
            'Automatic punctuation',
            'Speaker diarization',
            'Technical term recognition',
          ],
          icon: 'Target',
        },
        {
          id: 'languages',
          title: '50+ Languages',
          description:
            'From English to Mandarin to Arabic. Global teams covered.',
          features: [
            '50+ languages supported',
            'Automatic language detection',
            'Mixed-language handling',
            'Accent recognition',
          ],
          icon: 'Globe',
        },
        {
          id: 'speed',
          title: 'Fast Processing',
          description:
            'Most recordings transcribed in under 2 minutes. No queues.',
          features: [
            '<2 min processing',
            'Real-time preview',
            'Batch processing',
            'Priority queue for paid',
          ],
          icon: 'Zap',
        },
      ],
    },
    deepDive: {
      headline: 'Transcription built for knowledge teams',
      subtitle: 'Not just text. Structured, searchable knowledge.',
      items: [
        {
          title: 'Timestamped Segments',
          description:
            'Jump to any moment by clicking the transcript. Perfect for long recordings.',
          icon: 'Clock',
          size: 'large',
        },
        {
          title: 'Edit & Correct',
          description:
            'Easily fix any transcription errors. Your corrections improve future accuracy.',
          icon: 'FileText',
          size: 'medium',
        },
        {
          title: 'Export Anywhere',
          description:
            'Download as TXT, SRT, VTT, or copy formatted text to any doc.',
          icon: 'ArrowUpRight',
          size: 'small',
        },
        {
          title: 'Speaker Labels',
          description:
            'Automatic speaker detection for meetings and interviews.',
          icon: 'Users',
          size: 'small',
        },
      ],
    },
    stats: [
      {
        value: '95%+',
        label: 'Accuracy',
        description: 'Industry-leading precision',
      },
      {
        value: '<2min',
        label: 'Processing Time',
        description: 'For most recordings',
      },
      {
        value: '50+',
        label: 'Languages',
        description: 'Global coverage',
      },
      {
        value: '99.9%',
        label: 'Uptime',
        description: 'Always available',
      },
    ],
    testimonials: [
      {
        quote:
          'We tried 5 transcription services. Tribora is the only one that handles our technical jargon correctly.',
        author: 'David Park',
        role: 'CTO',
        company: 'DevTools Co',
      },
      {
        quote:
          'Our global team records in 4 languages. Finally, everyone can search everything.',
        author: 'Elena Rodriguez',
        role: 'Head of Operations',
        company: 'GlobalScale',
      },
    ],
    faq: [
      {
        question: 'How accurate is the transcription?',
        answer:
          'Our transcription achieves 95%+ accuracy for clear audio in supported languages. Technical terms and proper nouns may require occasional correction.',
      },
      {
        question: 'How long does transcription take?',
        answer:
          'Most recordings are transcribed in under 2 minutes, regardless of length. Very long recordings (2+ hours) may take slightly longer.',
      },
      {
        question: 'Can I edit the transcription?',
        answer:
          'Yes! You can edit any part of the transcript directly in Tribora. Changes are saved automatically and improve search accuracy.',
      },
      {
        question: 'What audio quality is required?',
        answer:
          'Clear audio works best, but our AI handles background noise, accents, and varying audio quality well. Very low-quality audio may reduce accuracy.',
      },
    ],
    relatedFeatures: ['recording', 'search', 'documentation'],
  },

  // ===========================================================================
  // SEARCH
  // ===========================================================================
  search: {
    id: 'search',
    icon: 'Search',
    meta: {
      title: 'Semantic Search | Tribora',
      description:
        'Find knowledge by meaning, not just keywords. Semantic search across all your recordings, documents, and transcripts.',
      keywords: [
        'semantic search',
        'knowledge search',
        'AI search',
        'content discovery',
      ],
    },
    hero: {
      badge: 'AI-Powered Search',
      headline: 'Find by meaning,',
      highlightedText: 'not keywords',
      subtitle:
        'Semantic search that understands what you\'re looking for. Ask questions in natural language and get answers from your entire knowledge base.',
      primaryCta: { text: 'Try Smart Search', href: '/sign-up' },
      secondaryCta: { text: 'See Search in Action', href: '#solution' },
    },
    problem: {
      headline: 'The answer exists. You just can\'t find it.',
      painPoints: [
        {
          icon: 'Search',
          title: 'Keyword search fails',
          description:
            'You search for "customer refund" but the answer uses "billing dispute". Traditional search can\'t help.',
        },
        {
          icon: 'Layers',
          title: 'Knowledge silos',
          description:
            'Information scattered across recordings, docs, and transcripts. No single place to search.',
        },
        {
          icon: 'Clock',
          title: 'Time wasted searching',
          description:
            'Teams spend 20% of their time searching for information that already exists somewhere.',
        },
      ],
      quote: {
        text: 'We have 200 Loom videos but no one watches them.',
        author: 'Support Manager',
        role: 'SaaS Company',
      },
    },
    solution: {
      headline: 'Search that thinks like you',
      subtitle: 'Powered by the same AI that understands your content',
      tabs: [
        {
          id: 'semantic',
          title: 'Semantic Understanding',
          description:
            'Search by concept, not exact words. Find related content automatically.',
          features: [
            'Natural language queries',
            'Concept matching',
            'Synonym recognition',
            'Context awareness',
          ],
          icon: 'Brain',
        },
        {
          id: 'unified',
          title: 'Unified Search',
          description:
            'One search bar for recordings, transcripts, docs, and more.',
          features: [
            'Cross-content search',
            'Filter by type',
            'Date range filters',
            'Tag-based refinement',
          ],
          icon: 'Layers',
        },
        {
          id: 'instant',
          title: 'Instant Results',
          description:
            'Results in milliseconds, with relevant snippets highlighted.',
          features: [
            'Sub-second results',
            'Snippet previews',
            'Timestamp links',
            'Relevance ranking',
          ],
          icon: 'Zap',
        },
      ],
    },
    deepDive: {
      headline: 'Search capabilities that scale',
      subtitle: 'As your library grows, search gets smarter',
      items: [
        {
          title: 'Vector Embeddings',
          description:
            'Every piece of content is embedded for semantic similarity matching.',
          icon: 'Brain',
          size: 'large',
        },
        {
          title: 'Snippet Highlighting',
          description:
            'See exactly where your search terms appear with context.',
          icon: 'Target',
          size: 'medium',
        },
        {
          title: 'Time Jumps',
          description:
            'Click any result to jump directly to that moment in the recording.',
          icon: 'Clock',
          size: 'small',
        },
        {
          title: 'Saved Searches',
          description:
            'Save frequent searches and get notified when new matches appear.',
          icon: 'Sparkles',
          size: 'small',
        },
      ],
    },
    stats: [
      {
        value: '<100ms',
        label: 'Search Speed',
        description: 'Instant results',
      },
      {
        value: '10x',
        label: 'Better Recall',
        description: 'vs keyword search',
      },
      {
        value: '∞',
        label: 'Content Indexed',
        description: 'No limits on library size',
      },
      {
        value: '0',
        label: 'Missed Answers',
        description: 'Semantic matching finds related content',
      },
    ],
    testimonials: [
      {
        quote:
          'I searched for "how to handle angry customers" and found a training video about "de-escalation techniques". That would never work with keyword search.',
        author: 'Jennifer Walsh',
        role: 'Training Manager',
        company: 'ServicePro',
      },
      {
        quote:
          'Our support team used to spend 15 minutes per ticket searching for answers. Now it takes 30 seconds.',
        author: 'Michael Torres',
        role: 'Support Director',
        company: 'CloudStack',
      },
    ],
    faq: [
      {
        question: 'How is semantic search different from regular search?',
        answer:
          'Regular search matches exact words. Semantic search understands meaning, so "how to handle refunds" finds results about "processing returns" even if those exact words aren\'t used.',
      },
      {
        question: 'What content types can I search?',
        answer:
          'Search works across recordings, transcripts, AI-generated documentation, and imported documents. Everything is indexed and searchable.',
      },
      {
        question: 'How quickly are new recordings searchable?',
        answer:
          'New content becomes searchable within minutes of processing completion. You\'ll be notified when indexing is complete.',
      },
      {
        question: 'Can I filter search results?',
        answer:
          'Yes! Filter by content type, date range, tags, creators, or any custom metadata you\'ve added.',
      },
    ],
    relatedFeatures: ['assistant', 'transcription', 'documentation'],
  },

  // ===========================================================================
  // ASSISTANT (MOAT)
  // ===========================================================================
  assistant: {
    id: 'assistant',
    icon: 'Bot',
    isMoat: true,
    meta: {
      title: 'RAG AI Assistant | Tribora',
      description:
        'Ask questions, get answers with exact citations. AI assistant powered by your knowledge base with full source attribution.',
      keywords: [
        'AI assistant',
        'RAG',
        'knowledge assistant',
        'AI with citations',
      ],
    },
    hero: {
      badge: 'MOAT Feature',
      headline: 'AI answers with',
      highlightedText: 'exact citations',
      subtitle:
        'Ask any question about your knowledge base. Get accurate answers with links to the exact source. No hallucinations. No guessing.',
      primaryCta: { text: 'Meet Your AI Assistant', href: '/sign-up' },
      secondaryCta: { text: 'See It In Action', href: '#solution' },
    },
    problem: {
      headline: 'Same questions. Different answers. Every time.',
      painPoints: [
        {
          icon: 'Users',
          title: 'Repetitive questions',
          description:
            'New hires ask the same questions every onboarding. Experts answer the same thing weekly.',
        },
        {
          icon: 'Bot',
          title: 'AI without sources',
          description:
            'ChatGPT gives answers but you can\'t verify them. Where did that information come from?',
        },
        {
          icon: 'Clock',
          title: 'Expert bottlenecks',
          description:
            'Your senior team spends hours answering questions instead of doing deep work.',
        },
      ],
      quote: {
        text: 'New hires ask the same questions every onboarding.',
        author: 'HR Director',
        role: 'Growth-Stage Startup',
      },
    },
    solution: {
      headline: 'Your knowledge, always available',
      subtitle: 'Like having every expert on call, 24/7',
      tabs: [
        {
          id: 'answers',
          title: 'Instant Answers',
          description:
            'Ask in natural language, get accurate answers immediately.',
          features: [
            'Natural language questions',
            'Context-aware responses',
            'Conversation memory',
            'Follow-up support',
          ],
          icon: 'Zap',
        },
        {
          id: 'citations',
          title: 'Full Citations',
          description:
            'Every answer includes links to exact source moments.',
          features: [
            'Timestamp citations',
            'Source attribution',
            'Click to verify',
            'Multi-source synthesis',
          ],
          icon: 'Target',
        },
        {
          id: 'trust',
          title: 'Trustworthy AI',
          description:
            'Only answers from your knowledge base. No hallucinations.',
          features: [
            'Grounded in your data',
            'Confidence scores',
            '"I don\'t know" when appropriate',
            'Source transparency',
          ],
          icon: 'Shield',
        },
      ],
    },
    deepDive: {
      headline: 'AI that knows your business',
      subtitle: 'Trained on your expertise, not the internet',
      items: [
        {
          title: 'RAG Architecture',
          description:
            'Retrieval-Augmented Generation ensures every answer is grounded in your actual content.',
          icon: 'Brain',
          size: 'large',
        },
        {
          title: 'Citation Links',
          description:
            'Click any citation to jump directly to that moment in the source recording.',
          icon: 'Target',
          size: 'medium',
        },
        {
          title: 'Confidence Indicators',
          description:
            'See how confident the AI is in each answer based on available sources.',
          icon: 'Shield',
          size: 'small',
        },
        {
          title: 'Conversation Memory',
          description:
            'Ask follow-up questions. The assistant remembers context.',
          icon: 'Sparkles',
          size: 'small',
        },
      ],
    },
    stats: [
      {
        value: '0',
        label: 'Hallucinations',
        description: 'Grounded in your data',
      },
      {
        value: '100%',
        label: 'Cited Answers',
        description: 'Every claim has a source',
      },
      {
        value: '85%',
        label: 'Questions Resolved',
        description: 'Without human help',
      },
      {
        value: '5x',
        label: 'Faster Answers',
        description: 'vs asking a colleague',
      },
    ],
    comparison: {
      headline: 'Not just another AI chatbot',
      subtitle: 'The difference is trust',
      competitors: ['ChatGPT/Generic AI', 'Internal Wiki Search'],
      rows: [
        {
          feature: 'Answers from your data only',
          tribora: true,
          competitor1: false,
          competitor2: true,
        },
        {
          feature: 'Exact source citations',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'Timestamp links to video',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'Understands visual workflows',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'No training on your data',
          tribora: true,
          competitor1: false,
          competitor2: true,
        },
        {
          feature: 'Admits when it doesn\'t know',
          tribora: true,
          competitor1: false,
          competitor2: 'N/A',
        },
      ],
    },
    testimonials: [
      {
        quote:
          'Our new engineers get answers in seconds that used to require a 30-minute Slack thread. And they can verify every answer themselves.',
        author: 'Alex Kim',
        role: 'Engineering Manager',
        company: 'TechForward',
      },
      {
        quote:
          'The citations are what sold us. When the AI says "here\'s how to do X", we can actually click through and see the expert demonstrating it.',
        author: 'Rachel Adams',
        role: 'Head of L&D',
        company: 'ScaleUp Academy',
      },
    ],
    faq: [
      {
        question: 'How does the AI know about our company?',
        answer:
          'The assistant only uses content from your Tribora library - recordings, transcripts, and documents. It doesn\'t access the internet or external data.',
      },
      {
        question: 'Can the AI make things up?',
        answer:
          'Our RAG (Retrieval-Augmented Generation) architecture only generates answers from your actual content. If the answer isn\'t in your library, the AI will say so.',
      },
      {
        question: 'Are citations always accurate?',
        answer:
          'Every citation includes a clickable link to the exact timestamp or document section. You can always verify the source yourself.',
      },
      {
        question: 'Is our data used to train the AI?',
        answer:
          'No. Your data is never used to train external AI models. It stays within your organization and is only used to answer your team\'s questions.',
      },
    ],
    relatedFeatures: ['search', 'documentation', 'collaboration'],
  },

  // ===========================================================================
  // DOCUMENTATION
  // ===========================================================================
  documentation: {
    id: 'documentation',
    icon: 'FileText',
    meta: {
      title: 'Auto Documentation | Tribora',
      description:
        'Turn recordings into structured documentation automatically. SOPs, how-to guides, and summaries generated in seconds.',
      keywords: [
        'auto documentation',
        'AI documentation',
        'SOP generator',
        'how-to guides',
      ],
    },
    hero: {
      badge: 'AI-Generated',
      headline: '3 hours of writing in',
      highlightedText: '10 seconds',
      subtitle:
        'Transform any recording into structured documentation automatically. SOPs, how-to guides, summaries, and step-by-step instructions.',
      primaryCta: { text: 'Auto-Generate Docs', href: '/sign-up' },
      secondaryCta: { text: 'See Doc Examples', href: '#solution' },
    },
    problem: {
      headline: 'Documentation is a full-time job nobody has time for',
      painPoints: [
        {
          icon: 'Clock',
          title: 'Hours to write, minutes to forget',
          description:
            'Writing good docs takes 4+ hours. By the time you\'re done, the process has already changed.',
        },
        {
          icon: 'FileText',
          title: 'Outdated before published',
          description:
            'Static docs decay immediately. Nobody updates them because it takes as long as writing them fresh.',
        },
        {
          icon: 'Users',
          title: 'Expertise trapped in experts',
          description:
            'Your best people know things. They just don\'t have time to write them down.',
        },
      ],
      quote: {
        text: 'I spend 4 hours writing docs that people can\'t find anyway.',
        author: 'Technical Writer',
        role: 'Enterprise Software',
      },
    },
    solution: {
      headline: 'Documentation that writes itself',
      subtitle: 'Record once, document forever',
      tabs: [
        {
          id: 'generate',
          title: 'Auto-Generate',
          description:
            'AI watches your recording and creates structured documentation.',
          features: [
            'Step-by-step guides',
            'Executive summaries',
            'SOPs and procedures',
            'Meeting notes',
          ],
          icon: 'Sparkles',
        },
        {
          id: 'formats',
          title: 'Multiple Formats',
          description:
            'Get the format you need, from quick summaries to detailed SOPs.',
          features: [
            'Markdown export',
            'Copy to Notion/Docs',
            'Custom templates',
            'Brand formatting',
          ],
          icon: 'FileText',
        },
        {
          id: 'edit',
          title: 'Edit & Refine',
          description:
            'AI drafts, you polish. Human-in-the-loop for quality.',
          features: [
            'Rich text editor',
            'Suggest edits with AI',
            'Version history',
            'Collaborative editing',
          ],
          icon: 'Zap',
        },
      ],
    },
    deepDive: {
      headline: 'Workflow extraction that actually works',
      subtitle: 'We understand what you did, not just what you said',
      items: [
        {
          title: 'Visual Understanding',
          description:
            'AI sees UI elements, clicks, and navigation. Not just audio.',
          icon: 'Video',
          size: 'large',
        },
        {
          title: 'Step Detection',
          description:
            'Automatically identifies discrete steps in your workflow.',
          icon: 'Layers',
          size: 'medium',
        },
        {
          title: 'Screenshot Capture',
          description:
            'Key moments captured as screenshots, embedded in your docs.',
          icon: 'Target',
          size: 'small',
        },
        {
          title: 'Template Library',
          description:
            'Start with proven templates for SOPs, guides, and more.',
          icon: 'FileText',
          size: 'small',
        },
      ],
    },
    stats: [
      {
        value: '10s',
        label: 'Doc Generation',
        description: 'From recording to doc',
      },
      {
        value: '4hrs',
        label: 'Time Saved',
        description: 'Per document created',
      },
      {
        value: '95%',
        label: 'Step Accuracy',
        description: 'Workflow detection',
      },
      {
        value: '50%',
        label: 'Faster Onboarding',
        description: 'With auto-generated guides',
      },
    ],
    comparison: {
      headline: 'Beyond screen capture tools',
      subtitle: 'We create knowledge, not just recordings',
      competitors: ['Loom', 'Scribe/Tango'],
      rows: [
        {
          feature: 'Automatic documentation',
          tribora: true,
          competitor1: false,
          competitor2: 'Partial',
        },
        {
          feature: 'Voice + screen understanding',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'Editable output',
          tribora: true,
          competitor1: false,
          competitor2: true,
        },
        {
          feature: 'Searchable content',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'AI assistant integration',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'Export to docs/Notion',
          tribora: true,
          competitor1: false,
          competitor2: true,
        },
      ],
    },
    testimonials: [
      {
        quote:
          'I recorded a 20-minute product walkthrough. Tribora turned it into a 15-step SOP with screenshots. Would have taken me half a day to write.',
        author: 'Jordan Lee',
        role: 'Product Manager',
        company: 'StartupXYZ',
      },
      {
        quote:
          'Our documentation is finally up to date because updating means recording a quick video, not rewriting from scratch.',
        author: 'Sam Patel',
        role: 'Technical Lead',
        company: 'CloudNative Inc',
      },
    ],
    faq: [
      {
        question: 'What types of documents can be generated?',
        answer:
          'Tribora can generate step-by-step guides, SOPs, executive summaries, meeting notes, onboarding docs, and more. Choose a template or let AI decide based on content.',
      },
      {
        question: 'Can I edit the generated documentation?',
        answer:
          'Absolutely! Generated docs are fully editable. Use our rich text editor, suggest improvements with AI, or export to your preferred tool.',
      },
      {
        question: 'How does it know what steps I took?',
        answer:
          'Our AI analyzes both audio (what you said) and visual (what you clicked, typed, navigated). This dual understanding creates more accurate step detection.',
      },
      {
        question: 'Can I export docs to Notion, Google Docs, etc?',
        answer:
          'Yes! Export as Markdown, copy formatted text, or use integrations to push directly to Notion, Google Docs, or Confluence.',
      },
    ],
    relatedFeatures: ['recording', 'transcription', 'assistant'],
  },

  // ===========================================================================
  // COLLABORATION (MOAT)
  // ===========================================================================
  collaboration: {
    id: 'collaboration',
    icon: 'Users',
    isMoat: true,
    meta: {
      title: 'Team Collaboration & Knowledge Graph | Tribora',
      description:
        'Knowledge that compounds across teams. Shared libraries, connected concepts, and team intelligence that grows.',
      keywords: [
        'team collaboration',
        'knowledge graph',
        'team knowledge',
        'knowledge sharing',
      ],
    },
    hero: {
      badge: 'MOAT Feature',
      headline: 'Knowledge that',
      highlightedText: 'compounds',
      subtitle:
        'Individual expertise becomes team intelligence. As your library grows, concepts connect, patterns emerge, and your knowledge graph becomes your competitive advantage.',
      primaryCta: { text: 'Build Your Knowledge Graph', href: '/sign-up' },
      secondaryCta: { text: 'See The Graph', href: '#solution' },
    },
    problem: {
      headline: 'Tribal knowledge stays tribal',
      painPoints: [
        {
          icon: 'Users',
          title: 'Knowledge silos',
          description:
            'Sales knows things Engineering doesn\'t. Support learns things Product never hears. Information trapped in teams.',
        },
        {
          icon: 'Network',
          title: 'No connections',
          description:
            'Related knowledge exists but isn\'t linked. The same problems get solved independently.',
        },
        {
          icon: 'Clock',
          title: 'Expertise doesn\'t scale',
          description:
            'Your best people become bottlenecks. Their knowledge can\'t be in two places at once.',
        },
      ],
      quote: {
        text: 'Tribal knowledge trapped in videos no one watches.',
        author: 'VP of Engineering',
        role: 'Scale-Up Company',
      },
    },
    solution: {
      headline: 'From individual recordings to connected intelligence',
      subtitle: 'The knowledge graph that grows with you',
      tabs: [
        {
          id: 'graph',
          title: 'Knowledge Graph',
          description:
            'Concepts automatically linked across recordings and documents.',
          features: [
            'Automatic concept extraction',
            'Cross-recording links',
            'Visual graph explorer',
            'Concept search',
          ],
          icon: 'Network',
        },
        {
          id: 'teams',
          title: 'Team Libraries',
          description:
            'Shared spaces for team knowledge with smart organization.',
          features: [
            'Team workspaces',
            'Permission controls',
            'Activity feeds',
            'Collaborative tagging',
          ],
          icon: 'Users',
        },
        {
          id: 'insights',
          title: 'Team Insights',
          description:
            'See what your team knows and where the gaps are.',
          features: [
            'Coverage reports',
            'Expert identification',
            'Gap analysis',
            'Usage analytics',
          ],
          icon: 'Brain',
        },
      ],
    },
    deepDive: {
      headline: 'The compounding advantage',
      subtitle: 'Every recording makes your knowledge graph smarter',
      items: [
        {
          title: 'Concept Linking',
          description:
            'AI identifies concepts and automatically links related content across your library.',
          icon: 'Network',
          size: 'large',
        },
        {
          title: 'Graph Visualization',
          description:
            'Explore your knowledge graph visually. See how concepts connect.',
          icon: 'Brain',
          size: 'medium',
        },
        {
          title: 'Team Permissions',
          description:
            'Control who sees what. Share across org or keep team-specific.',
          icon: 'Shield',
          size: 'small',
        },
        {
          title: 'Expert Discovery',
          description:
            'Find who knows what. Identify subject matter experts automatically.',
          icon: 'Users',
          size: 'small',
        },
      ],
    },
    stats: [
      {
        value: '10x',
        label: 'Knowledge Reuse',
        description: 'vs isolated recordings',
      },
      {
        value: '∞',
        label: 'Connections',
        description: 'Auto-linked concepts',
      },
      {
        value: '50%',
        label: 'Faster Onboarding',
        description: 'With connected knowledge',
      },
      {
        value: '3x',
        label: 'Expert Leverage',
        description: 'Knowledge scales with team',
      },
    ],
    comparison: {
      headline: 'Beyond shared folders',
      subtitle: 'Knowledge that\'s connected, not just stored',
      competitors: ['Google Drive/SharePoint', 'Notion/Confluence'],
      rows: [
        {
          feature: 'Automatic concept linking',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'Knowledge graph visualization',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'Expert identification',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'Cross-content intelligence',
          tribora: true,
          competitor1: false,
          competitor2: 'Partial',
        },
        {
          feature: 'Video + doc + transcript unified',
          tribora: true,
          competitor1: false,
          competitor2: false,
        },
        {
          feature: 'AI assistant over all content',
          tribora: true,
          competitor1: false,
          competitor2: 'Partial',
        },
      ],
    },
    testimonials: [
      {
        quote:
          'We discovered that Engineering and Support had solved the same problem 3 different ways. The knowledge graph showed us immediately.',
        author: 'Chris Morgan',
        role: 'VP of Operations',
        company: 'Unified Systems',
      },
      {
        quote:
          'New team members now get recommended content based on what they need to know. The graph understands their role better than we could explain.',
        author: 'Amanda Liu',
        role: 'Head of People',
        company: 'GrowthStage Co',
      },
    ],
    faq: [
      {
        question: 'How does the knowledge graph work?',
        answer:
          'As you add recordings and documents, AI extracts key concepts (tools, processes, people, products). It then automatically links related concepts across your library, creating a visual map of how your knowledge connects.',
      },
      {
        question: 'Can different teams have separate libraries?',
        answer:
          'Yes! Create team workspaces with their own libraries and permissions. Content can be shared across teams or kept private. The knowledge graph still connects everything (with permission).',
      },
      {
        question: 'How do you identify experts?',
        answer:
          'The system tracks who creates content about which concepts. Over time, it builds a map of expertise - who knows what, based on their recorded knowledge.',
      },
      {
        question: 'Does the graph get smarter over time?',
        answer:
          'Absolutely. Every recording, every edit, every search teaches the graph. Connections strengthen, new relationships emerge, and relevance improves continuously.',
      },
    ],
    relatedFeatures: ['assistant', 'search', 'documentation'],
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function getFeature(id: string): FeaturePageData | undefined {
  return FEATURES[id as FeatureId];
}

export function getAllFeatureIds(): FeatureId[] {
  return Object.keys(FEATURES) as FeatureId[];
}

export function getRelatedFeatures(id: FeatureId): FeaturePageData[] {
  const feature = FEATURES[id];
  if (!feature) return [];
  return feature.relatedFeatures
    .map((relId) => FEATURES[relId])
    .filter(Boolean);
}

export function getMoatFeatures(): FeaturePageData[] {
  return Object.values(FEATURES).filter((f) => f.isMoat);
}
