/**
 * Script to apply the blog_posts table migration to Supabase
 * Run with: npx tsx scripts/apply-blog-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function applyMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Checking blog_posts table...\n');

  // Check if table exists
  const { data: tableCheck, error: checkError } = await supabase
    .from('blog_posts')
    .select('id')
    .limit(1);

  if (checkError && checkError.code === 'PGRST205') {
    console.log('Table does not exist. Please run the migration SQL in Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/clpatptmumyasbypvmun/sql/new\n');
    console.log('Copy the contents of: supabase/migrations/20251130000001_create_blog_posts.sql\n');
    process.exit(1);
  } else if (!checkError) {
    console.log('Table exists!');

    // Check if there are posts
    const { data: posts, count } = await supabase
      .from('blog_posts')
      .select('id, title', { count: 'exact' });

    if (posts && posts.length > 0) {
      console.log(`Found ${count || posts.length} existing posts.`);
    } else {
      console.log('No posts found. Adding seed data...');
      await seedPosts(supabase);
    }
  } else {
    console.error('Unknown error:', checkError);
  }

  console.log('\nDone!');
}

async function seedPosts(supabase: any) {
  const posts = [
    {
      title: 'Introducing Tribora: The Knowledge Intelligence Layer',
      slug: 'introducing-tribora-knowledge-intelligence-layer',
      excerpt: 'Discover how Tribora transforms tacit knowledge into searchable, AI-powered intelligence for your team.',
      content: `# Introducing Tribora: The Knowledge Intelligence Layer

Every team has experts. People who know exactly how things work, why decisions were made, and the little nuances that make the difference between success and failure.

## The Problem

But what happens when those experts leave? Or when they're on vacation? Or simply too busy to answer the same questions over and over?

**Knowledge walks out the door.**

We've all seen it happen:
- Senior engineers leave, taking years of context with them
- Onboarding takes months because "you just have to learn it"
- The same questions get asked again and again in Slack
- Hours of Loom videos sit unwatched because no one can find what they need

## The Solution: Tribora

Tribora is the **Knowledge Intelligence Layer** — an AI platform that captures tacit knowledge through screen recordings and transforms it into structured, searchable documentation.

Unlike other tools that just store content, **Tribora illuminates it**.

### How It Works

1. **Capture** — Record your screen with one click. Show how things are done.
2. **Transform** — AI transcribes, extracts workflows, and structures your knowledge.
3. **Illuminate** — Search semantically or ask our AI assistant with citations.

### Why Tribora?

- **Visual Intelligence**: We understand UI clicks, navigation paths, and visual context
- **Workflow Extraction**: Turn any recording into step-by-step guides automatically
- **Knowledge Graph**: Connect insights across recordings to build compounding value
- **Bidirectional Sync**: Publish enriched content back to Google Drive, SharePoint, Notion

## Start Your Journey

Join thousands of teams transforming how they capture and share knowledge.

[Start Free Trial →](/sign-up)`,
      category: 'product',
      tags: ['product-launch', 'ai', 'knowledge-management'],
      author_name: 'Sarah Chen',
      author_role: 'Co-Founder & CEO',
      status: 'published',
      is_featured: true,
      reading_time_minutes: 6,
      published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: 'The Hidden Cost of Tribal Knowledge',
      slug: 'hidden-cost-tribal-knowledge',
      excerpt: 'Why undocumented expertise costs your company more than you think — and how to fix it.',
      content: `# The Hidden Cost of Tribal Knowledge

There's a silent tax on every growing company. It's not in your P&L, but it's draining your team's productivity every single day.

## What is Tribal Knowledge?

Tribal knowledge is the undocumented expertise that exists only in people's heads. It's:

- The "gotchas" your senior dev knows about the legacy system
- The workaround your support lead uses for that one tricky customer
- The unwritten rules about how decisions actually get made

## The Real Cost

Research shows that knowledge workers spend **20% of their time** looking for information or finding colleagues who can help. That's one full day per week, per person.

For a 50-person team at $100K average salary:
- 20% of time = $1M/year searching for answers
- Plus opportunity cost of interrupted experts
- Plus onboarding delays for new hires
- Plus mistakes from missing context

**The true cost? Easily $2-3M annually for mid-size companies.**

## The Fix

The solution isn't more documentation meetings. It's capturing knowledge as it happens.

1. **Record, don't write** — Show your screen while explaining
2. **Let AI structure it** — Automatic transcription and documentation
3. **Make it searchable** — Semantic search finds what you need instantly
4. **Connect the dots** — Knowledge graph links related insights

## Start Reducing the Tax

Every day you wait, knowledge is walking out the door. Start capturing it today.

[Learn More →](/features)`,
      category: 'insights',
      tags: ['productivity', 'knowledge-management', 'roi'],
      author_name: 'Michael Rodriguez',
      author_role: 'Co-Founder & CTO',
      status: 'published',
      is_featured: false,
      reading_time_minutes: 5,
      published_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: 'How AI is Transforming Knowledge Management in 2024',
      slug: 'ai-transforming-knowledge-management-2024',
      excerpt: 'From basic search to intelligent assistants — the evolution of how teams capture and share expertise.',
      content: `# How AI is Transforming Knowledge Management in 2024

The knowledge management landscape is undergoing its biggest transformation since the invention of the wiki. AI isn't just making existing tools better — it's enabling entirely new approaches.

## The Old Way: Documentation as a Chore

Traditional knowledge management treated documentation as a separate task:
1. Do the work
2. Stop and write about it
3. Hope someone can find it later
4. Update it when it's already outdated

**No wonder adoption was always a struggle.**

## The New Way: Capture as You Work

AI enables a fundamentally different approach:
1. Record your screen while working
2. AI transcribes and structures automatically
3. Semantic search makes everything findable
4. Knowledge stays current because capture is effortless

## Key AI Capabilities Driving the Change

### 1. Multimodal Understanding

Modern AI can understand:
- What you're saying (speech-to-text)
- What you're showing (visual comprehension)
- What you're doing (workflow extraction)
- Why it matters (context inference)

### 2. Semantic Search

Forget exact keyword matching. Ask questions in natural language:
- "How do we handle refunds for enterprise customers?"
- "What's the process for deploying to production?"
- "Who knows about the payment integration?"

### 3. Intelligent Assistants

RAG-powered assistants that:
- Answer questions with citations
- Never hallucinate because they're grounded in your content
- Learn your team's terminology and context

## What This Means for Teams

The barrier between "having knowledge" and "sharing knowledge" is disappearing. In 2024, the most effective teams will be those that capture expertise continuously and make it instantly accessible.

[See AI-Powered Knowledge Management in Action →](/demo)`,
      category: 'insights',
      tags: ['ai', 'trends', 'future-of-work'],
      author_name: 'Emily Watson',
      author_role: 'Head of Product',
      status: 'published',
      is_featured: true,
      reading_time_minutes: 7,
      published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: 'Best Practices for Screen Recording Documentation',
      slug: 'best-practices-screen-recording-documentation',
      excerpt: 'Tips and techniques for creating effective screen recordings that actually get watched and remembered.',
      content: `# Best Practices for Screen Recording Documentation

Not all screen recordings are created equal. Here's how to create content your team will actually use.

## Before You Record

### 1. Have a Clear Goal

Before hitting record, answer:
- What specific problem does this solve?
- Who is the audience?
- What should they be able to do after watching?

### 2. Prepare Your Environment

- Close unnecessary tabs and apps
- Hide sensitive information
- Increase font sizes for readability
- Use a clean desktop background

### 3. Outline Your Flow

Jot down the key steps:
1. Introduction (10 seconds)
2. Main content (2-5 minutes)
3. Summary/next steps (30 seconds)

## During Recording

### Keep It Short

- Aim for 3-5 minutes maximum
- Break longer topics into a series
- People watch short videos; they skip long ones

### Narrate Everything

- Say what you're doing and why
- Explain clicks before you make them
- Call out important details

### Pause at Key Moments

- Give viewers time to process
- Highlight important information
- Repeat critical steps

## After Recording

### Let AI Do the Heavy Lifting

With Tribora:
- Automatic transcription captures everything
- Key steps get extracted into guides
- Semantic search makes it findable
- Knowledge graph connects related content

### Add Context

- Write a clear title
- Add relevant tags
- Link to related recordings

## Common Mistakes to Avoid

1. **Too long** — Keep it under 5 minutes
2. **No narration** — Silent recordings are useless
3. **No structure** — Rambling loses people
4. **No follow-up** — Make sure it's findable

## Ready to Start?

Capturing knowledge doesn't have to be hard. With the right tools and techniques, you can turn everyday work into valuable documentation.

[Start Recording →](/record)`,
      category: 'tutorials',
      tags: ['best-practices', 'documentation', 'productivity'],
      author_name: 'Emily Watson',
      author_role: 'Head of Product',
      status: 'published',
      is_featured: false,
      reading_time_minutes: 4,
      published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: 'Building a Knowledge-First Culture',
      slug: 'building-knowledge-first-culture',
      excerpt: 'How leading teams create environments where sharing knowledge becomes second nature.',
      content: `# Building a Knowledge-First Culture

Tools are important, but culture determines whether knowledge actually gets shared. Here's how to build a team where documentation happens naturally.

## The Culture Problem

We've all heard the objections:
- "I don't have time to document"
- "By the time I document it, it'll be outdated"
- "No one reads documentation anyway"
- "I'd rather just explain it in person"

These aren't just excuses — they're symptoms of a culture that hasn't made knowledge sharing valuable.

## Principles of a Knowledge-First Culture

### 1. Make Capture Effortless

If documentation requires stopping work, it won't happen. The solution:
- Record instead of write
- Capture during natural workflows
- Let AI do the structuring

### 2. Reward Sharing, Not Hoarding

Knowledge shouldn't be power. Recognize people who:
- Create helpful content
- Answer questions thoroughly
- Proactively share discoveries

### 3. Lead by Example

Leaders set the tone:
- Record your own explanations
- Share your decision-making process
- Ask "is this documented?" before answering

### 4. Make Knowledge Findable

The best documentation is useless if no one can find it:
- Semantic search over keyword matching
- Organized structure with clear categories
- Links between related content

## Practical Steps

### Week 1: Start Small
- Choose one recurring question
- Record a 3-minute explanation
- Share with the team

### Week 2: Build Habits
- When someone asks a question, record the answer
- Link to existing content instead of re-explaining
- Tag content consistently

### Week 3: Expand
- Identify top 10 questions by frequency
- Create recordings for each
- Build a "getting started" playlist

### Week 4: Celebrate
- Recognize top contributors
- Share time saved metrics
- Gather feedback and iterate

## Measuring Success

Track these metrics:
- Time to answer recurring questions
- New hire onboarding duration
- Knowledge base growth rate
- Content engagement/views

## The Compounding Effect

Knowledge-first culture compounds:
- More content → Better search results
- Better results → More usage
- More usage → More contributions
- More contributions → Stronger culture

[Start Building Your Knowledge Culture →](/sign-up)`,
      category: 'insights',
      tags: ['culture', 'leadership', 'best-practices'],
      author_name: 'Sarah Chen',
      author_role: 'Co-Founder & CEO',
      status: 'published',
      is_featured: false,
      reading_time_minutes: 8,
      published_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const { data, error } = await supabase
    .from('blog_posts')
    .insert(posts)
    .select();

  if (error) {
    console.error('Error seeding posts:', error);
  } else {
    console.log(`Added ${data.length} demo posts!`);
  }
}

applyMigration().catch(console.error);
