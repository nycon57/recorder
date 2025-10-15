import Link from 'next/link';

import { RecordCTA } from '@/app/components/sections';

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container px-6 py-16 mx-auto max-w-4xl text-center">
        <h1 className="text-heading-1 mb-4">About Record</h1>
        <p className="text-body-lg text-muted-foreground">
          We're building the future of knowledge management
        </p>
      </section>

      <div className="container px-6 py-8 mx-auto max-w-4xl">
        {/* Mission */}
        <section className="mb-16">
          <h2 className="text-heading-2 mb-6">Our Mission</h2>
          <p className="text-body-lg text-muted-foreground mb-4">
            At Record, we believe that valuable knowledge shouldn't be locked
            away in people's heads or buried in hours of video content. Our
            mission is to make expert knowledge accessible, searchable, and
            actionable for everyone.
          </p>
          <p className="text-body-lg text-muted-foreground">
            We're building the future of knowledge management—where capturing
            expertise is as simple as having a conversation, and finding answers
            is as easy as asking a question.
          </p>
        </section>

        {/* Story */}
        <section className="mb-16">
          <h2 className="text-heading-2 mb-6">Our Story</h2>
          <p className="text-body-lg text-muted-foreground mb-4">
            Record was born from a simple frustration: too much time was being
            wasted documenting processes, creating training materials, and
            answering the same questions over and over.
          </p>
          <p className="text-body-lg text-muted-foreground mb-4">
            We realized that the tools existed to solve this problem—screen
            recording, AI transcription, natural language processing—but no one
            had put them together in a seamless, easy-to-use package focused on
            knowledge capture and retrieval.
          </p>
          <p className="text-body-lg text-muted-foreground">
            So we built Record: a platform that transforms the way teams
            capture, organize, and access their collective knowledge.
          </p>
        </section>

        {/* Values */}
        <section className="mb-16">
          <h2 className="text-heading-2 mb-6">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-8 mt-6">
            <div className="p-6 border border-border rounded-xl bg-card">
              <h3 className="text-heading-5 mb-3">🎯 Simplicity First</h3>
              <p className="text-muted-foreground">
                Powerful features shouldn't require complex workflows. We
                prioritize ease of use without sacrificing capability.
              </p>
            </div>
            <div className="p-6 border border-border rounded-xl bg-card">
              <h3 className="text-heading-5 mb-3">🔒 Privacy & Security</h3>
              <p className="text-muted-foreground">
                Your knowledge is valuable. We protect it with enterprise-grade
                security and transparent data practices.
              </p>
            </div>
            <div className="p-6 border border-border rounded-xl bg-card">
              <h3 className="text-heading-5 mb-3">⚡ Speed & Reliability</h3>
              <p className="text-muted-foreground">
                Knowledge should be instant. We build for performance and uptime
                so you can access what you need, when you need it.
              </p>
            </div>
            <div className="p-6 border border-border rounded-xl bg-card">
              <h3 className="text-heading-5 mb-3">🤝 Customer Success</h3>
              <p className="text-muted-foreground">
                We succeed when you succeed. Your feedback drives our roadmap
                and our support team is here to help.
              </p>
            </div>
          </div>
        </section>

        {/* Technology */}
        <section className="mb-16">
          <h2 className="text-heading-2 mb-6">Technology</h2>
          <p className="text-body-lg text-muted-foreground mb-4">
            Record is built on cutting-edge technology:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 text-body-md">
            <li>Browser-based recording with WebRTC and modern web APIs</li>
            <li>OpenAI Whisper for state-of-the-art transcription</li>
            <li>GPT models for intelligent document generation</li>
            <li>
              Vector embeddings and semantic search for intelligent retrieval
            </li>
            <li>Secure, scalable infrastructure on Vercel and Supabase</li>
          </ul>
        </section>

        {/* Join Us */}
        <section className="mb-16">
          <h2 className="text-heading-2 mb-6">Join Us</h2>
          <p className="text-body-lg text-muted-foreground mb-4">
            We're just getting started. If you're passionate about making
            knowledge accessible and want to be part of shaping the future of
            work, we'd love to hear from you.
          </p>
          <div className="flex gap-4 mt-6">
            <Link
              href="/contact"
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition"
            >
              Get in Touch
            </Link>
            <Link
              href="https://github.com/yourusername/record"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border-2 border-border font-semibold rounded-lg hover:bg-accent transition"
            >
              View on GitHub
            </Link>
          </div>
        </section>
      </div>

      <RecordCTA />
    </div>
  );
}
