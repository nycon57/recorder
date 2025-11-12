'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Target,
  Heart,
  Zap,
  Shield,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Github,
  Linkedin,
  Twitter,
  Award,
  Globe,
  Rocket,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { ModernCTA } from '@/app/components/sections';

const VALUES = [
  {
    icon: Target,
    title: 'Simplicity First',
    description:
      "Powerful features shouldn't require complex workflows. We prioritize ease of use without sacrificing capability.",
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    icon: Shield,
    title: 'Privacy & Security',
    description:
      'Your knowledge is valuable. We protect it with enterprise-grade security and transparent data practices.',
    color: 'from-green-500/20 to-emerald-500/20',
  },
  {
    icon: Zap,
    title: 'Speed & Reliability',
    description:
      'Knowledge should be instant. We build for performance and uptime so you can access what you need, when you need it.',
    color: 'from-yellow-500/20 to-orange-500/20',
  },
  {
    icon: Heart,
    title: 'Customer Success',
    description:
      'We succeed when you succeed. Your feedback drives our roadmap and our support team is here to help.',
    color: 'from-pink-500/20 to-rose-500/20',
  },
];

const STATS = [
  { value: '10K+', label: 'Active Users', icon: Users },
  { value: '1M+', label: 'Recordings Processed', icon: TrendingUp },
  { value: '99%', label: 'Uptime Guarantee', icon: Award },
  { value: '50+', label: 'Countries Served', icon: Globe },
];

const TEAM = [
  {
    name: 'Sarah Chen',
    role: 'Co-Founder & CEO',
    bio: 'Former engineering lead at a Fortune 500 tech company, passionate about making knowledge accessible to everyone',
    avatar: '/images/team/sarah.jpg',
    social: {
      linkedin: '#',
      twitter: '#',
    },
  },
  {
    name: 'Michael Rodriguez',
    role: 'Co-Founder & CTO',
    bio: 'AI researcher with a PhD in NLP and machine learning, building the future of intelligent search',
    avatar: '/images/team/michael.jpg',
    social: {
      linkedin: '#',
      github: '#',
    },
  },
  {
    name: 'Emily Watson',
    role: 'Head of Product',
    bio: 'Product leader with 10+ years experience crafting delightful user experiences',
    avatar: '/images/team/emily.jpg',
    social: {
      linkedin: '#',
      twitter: '#',
    },
  },
];

const MILESTONES = [
  {
    year: '2023',
    title: 'Founded',
    description: 'Record was born from a simple idea: make knowledge capture effortless',
  },
  {
    year: '2023',
    title: 'Beta Launch',
    description: 'Released beta to first 100 users, gathered invaluable feedback',
  },
  {
    year: '2024',
    title: 'Public Launch',
    description: 'Opened to the public with full AI-powered features',
  },
  {
    year: '2024',
    title: '10K Users',
    description: 'Reached 10,000 active users across 50+ countries',
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />

        <div className="relative z-10 container px-6 mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 text-sm font-medium text-primary backdrop-blur-sm mb-6">
              <Sparkles className="h-4 w-4" />
              About Record
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-heading-1 mb-6"
          >
            We're Building the Future of Knowledge Management
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Making expert knowledge accessible, searchable, and actionable for everyone.
          </motion.p>
        </div>
      </section>

      {/* Stats */}
      <section className="container px-6 py-16 mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 border border-border rounded-2xl bg-card/50 backdrop-blur-sm"
        >
          {STATS.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Icon className="h-6 w-6 text-primary" />
                  <div className="text-4xl font-bold text-primary">{stat.value}</div>
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Mission & Story */}
      <section className="container px-6 py-16 mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <h2 className="text-heading-2 mb-6">Our Mission</h2>
          <p className="text-lg text-muted-foreground mb-4">
            At Record, we believe that valuable knowledge shouldn't be locked away in people's
            heads or buried in hours of video content. Our mission is to make expert knowledge
            accessible, searchable, and actionable for everyone.
          </p>
          <p className="text-lg text-muted-foreground">
            We're building the future of knowledge management—where capturing expertise is as
            simple as having a conversation, and finding answers is as easy as asking a question.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <h2 className="text-heading-2 mb-6">Our Story</h2>
          <p className="text-lg text-muted-foreground mb-4">
            Record was born from a simple frustration: too much time was being wasted documenting
            processes, creating training materials, and answering the same questions over and over.
          </p>
          <p className="text-lg text-muted-foreground mb-4">
            We realized that the tools existed to solve this problem—screen recording, AI
            transcription, natural language processing—but no one had put them together in a
            seamless, easy-to-use package focused on knowledge capture and retrieval.
          </p>
          <p className="text-lg text-muted-foreground">
            So we built Record: a platform that transforms the way teams capture, organize, and
            access their collective knowledge.
          </p>
        </motion.div>
      </section>

      {/* Values */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30" />

        <div className="relative z-10 container px-6 mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-heading-2 mb-4">Our Values</h2>
            <p className="text-lg text-muted-foreground">
              The principles that guide everything we do
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {VALUES.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="p-8 border border-border rounded-2xl bg-card shadow-lg hover:shadow-xl transition-all group"
                >
                  <div className={`w-14 h-14 bg-gradient-to-br ${value.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-heading-4 mb-3">{value.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{value.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="container px-6 py-16 mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-heading-2 mb-4">Our Journey</h2>
          <p className="text-lg text-muted-foreground">
            Key milestones in our mission to democratize knowledge
          </p>
        </motion.div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-primary/30 to-transparent" />

          <div className="space-y-12">
            {MILESTONES.map((milestone, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative flex items-center gap-8 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Timeline dot */}
                <div className="absolute left-4 md:left-1/2 -ml-2 w-4 h-4 rounded-full bg-primary border-4 border-background z-10" />

                {/* Content card */}
                <div className={`flex-1 ml-12 md:ml-0 ${index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                  <div className="p-6 border border-border rounded-xl bg-card shadow-md hover:shadow-lg transition-shadow">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-3">
                      <Rocket className="h-3 w-3" />
                      {milestone.year}
                    </div>
                    <h3 className="text-heading-4 mb-2">{milestone.title}</h3>
                    <p className="text-muted-foreground">{milestone.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="container px-6 py-16 mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-heading-2 mb-4">Meet the Team</h2>
          <p className="text-lg text-muted-foreground">
            Passionate builders working to make knowledge accessible
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {TEAM.map((member, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center group"
            >
              <div className="relative mb-6">
                <div className="w-48 h-48 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center overflow-hidden border border-border group-hover:border-primary transition-colors">
                  <Users className="h-24 w-24 text-primary" />
                </div>
              </div>
              <h3 className="text-heading-4 mb-1">{member.name}</h3>
              <p className="text-primary font-medium mb-3">{member.role}</p>
              <p className="text-sm text-muted-foreground mb-4">{member.bio}</p>
              <div className="flex gap-3 justify-center">
                {member.social.linkedin && (
                  <a
                    href={member.social.linkedin}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                )}
                {member.social.twitter && (
                  <a
                    href={member.social.twitter}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Twitter className="h-5 w-5" />
                  </a>
                )}
                {member.social.github && (
                  <a
                    href={member.social.github}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Technology Stack */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30" />

        <div className="relative z-10 container px-6 mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-heading-2 mb-6">Built with Modern Technology</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Record is built on cutting-edge technology to deliver the best possible experience:
            </p>
            <ul className="space-y-3">
              {[
                'Browser-based recording with WebRTC and modern web APIs',
                'OpenAI Whisper for state-of-the-art transcription',
                'GPT models for intelligent document generation',
                'Vector embeddings and semantic search for intelligent retrieval',
                'Secure, scalable infrastructure on Vercel and Supabase',
              ].map((item, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-foreground/90">{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Join Us */}
      <section className="container px-6 py-16 mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-heading-2 mb-6">Join Us</h2>
          <p className="text-lg text-muted-foreground mb-8">
            We're just getting started. If you're passionate about making knowledge accessible and
            want to be part of shaping the future of work, we'd love to hear from you.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/contact">
              <Button size="lg" className="group">
                Get in Touch
                <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <ModernCTA />
    </div>
  );
}
