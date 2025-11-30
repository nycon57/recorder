'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import * as motion from 'motion/react-client';
import Link from 'next/link';
import Image from 'next/image';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Clock01Icon,
  Calendar01Icon,
  BookOpen01Icon,
  Share01Icon,
  TwitterIcon,
  Linkedin01Icon,
  Link01Icon,
} from '@hugeicons/core-free-icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import type { BlogPost, BlogPostCard, BlogPostCategory } from '@/lib/types/database';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const CATEGORY_COLORS: Record<BlogPostCategory, string> = {
  product: 'bg-accent/10 text-accent border-accent/30',
  insights: 'bg-secondary/10 text-secondary border-secondary/30',
  tutorials: 'bg-primary/10 text-primary border-primary/30',
  general: 'bg-muted text-muted-foreground border-border',
};

/**
 * Blog Post Detail Page - Premium blog post view with aurora styling
 *
 * Features:
 * - Full markdown content rendering
 * - Author info and reading time
 * - Related posts section
 * - Social sharing
 * - Aurora gradient backgrounds
 */
export default function BlogPostPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPost() {
      if (!slug) return;

      try {
        const response = await fetch(`/api/blog/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Post not found');
          } else {
            setError('Failed to load post');
          }
          return;
        }

        const data = await response.json();
        setPost(data.post);
        setRelatedPosts(data.relatedPosts || []);
      } catch (err) {
        console.error('Failed to fetch blog post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [slug]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const shareOnTwitter = () => {
    const text = `Check out "${post?.title}" by ${post?.author_name}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  const shareOnLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <main className="relative min-h-screen bg-background">
        <div className="container px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20">
          <div className="max-w-3xl mx-auto animate-pulse">
            <div className="h-6 w-24 bg-muted/20 rounded mb-4" />
            <div className="h-12 w-3/4 bg-muted/20 rounded mb-6" />
            <div className="h-4 w-1/2 bg-muted/20 rounded mb-8" />
            <div className="aspect-[16/9] bg-muted/20 rounded-xl mb-8" />
            <div className="space-y-4">
              <div className="h-4 w-full bg-muted/20 rounded" />
              <div className="h-4 w-full bg-muted/20 rounded" />
              <div className="h-4 w-2/3 bg-muted/20 rounded" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="relative min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <HugeiconsIcon icon={BookOpen01Icon} size={64} className="mx-auto text-muted-foreground/30 mb-6" />
          <h1 className="text-2xl font-outfit font-medium text-foreground mb-2">
            {error || 'Post not found'}
          </h1>
          <p className="text-muted-foreground mb-6">
            The blog post you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/blog">
            <Button variant="outline" className="rounded-full">
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background">
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Aurora orbs */}
        <div
          className="absolute top-[-5%] right-[20%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.1)_0%,transparent_70%)]
            blur-[100px] animate-float"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="absolute bottom-[30%] left-[5%] w-[300px] h-[300px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.06)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '2s' }}
        />

        {/* Radial gradient from top */}
        <div
          className="absolute inset-0
            bg-[radial-gradient(ellipse_60%_40%_at_50%_-5%,rgba(0,223,130,0.06),transparent_60%)]"
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.01]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,223,130,0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,223,130,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* === CONTENT === */}
      <article className="relative z-10 container px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20">
        {/* Back Link */}
        <motion.div
          className="max-w-3xl mx-auto mb-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <Link
            href="/blog"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-2" />
            Back to Blog
          </Link>
        </motion.div>

        {/* Article Header */}
        <motion.header
          className="max-w-3xl mx-auto mb-8"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {/* Category & Reading Time */}
          <motion.div
            className="flex flex-wrap items-center gap-3 mb-4"
            variants={fadeInUp}
          >
            <Badge
              variant="outline"
              className={cn('text-xs', CATEGORY_COLORS[post.category])}
            >
              {post.category}
            </Badge>
            <span className="flex items-center text-sm text-muted-foreground">
              <HugeiconsIcon icon={Clock01Icon} size={14} className="mr-1" />
              {post.reading_time_minutes} min read
            </span>
            <span className="flex items-center text-sm text-muted-foreground">
              <HugeiconsIcon icon={Calendar01Icon} size={14} className="mr-1" />
              {formatDate(post.published_at)}
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
              leading-tight tracking-tight text-foreground mb-6"
            variants={fadeInUp}
          >
            {post.title}
          </motion.h1>

          {/* Excerpt */}
          {post.excerpt && (
            <motion.p
              className="text-lg sm:text-xl text-muted-foreground font-light mb-8"
              variants={fadeInUp}
            >
              {post.excerpt}
            </motion.p>
          )}

          {/* Author & Share */}
          <motion.div
            className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-border/50"
            variants={fadeInUp}
          >
            {/* Author */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                {post.author_avatar_url ? (
                  <Image
                    src={post.author_avatar_url}
                    alt={post.author_name}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <span className="text-sm font-medium text-accent">
                    {post.author_name.split(' ').map(n => n[0]).join('')}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">{post.author_name}</p>
                {post.author_role && (
                  <p className="text-sm text-muted-foreground">{post.author_role}</p>
                )}
              </div>
            </div>

            {/* Share */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">
                <HugeiconsIcon icon={Share01Icon} size={14} className="inline mr-1" />
                Share
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/50 hover:border-accent/30"
                onClick={shareOnTwitter}
              >
                <HugeiconsIcon icon={TwitterIcon} size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/50 hover:border-accent/30"
                onClick={shareOnLinkedIn}
              >
                <HugeiconsIcon icon={Linkedin01Icon} size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/50 hover:border-accent/30"
                onClick={copyLink}
              >
                <HugeiconsIcon icon={Link01Icon} size={16} />
              </Button>
            </div>
          </motion.div>
        </motion.header>

        {/* Featured Image */}
        {post.featured_image_url && (
          <motion.div
            className="max-w-4xl mx-auto mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.2 }}
          >
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden
              border border-border/30 shadow-[0_0_40px_rgba(0,223,130,0.08)]">
              <Image
                src={post.featured_image_url}
                alt={post.featured_image_alt || post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </motion.div>
        )}

        {/* Article Content */}
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.3 }}
        >
          <div
            className="prose prose-lg prose-invert
              prose-headings:font-outfit prose-headings:font-light prose-headings:tracking-tight
              prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
              prose-p:text-muted-foreground prose-p:font-light prose-p:leading-relaxed
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-medium
              prose-code:text-accent prose-code:bg-accent/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-card/50 prose-pre:border prose-pre:border-border/50
              prose-blockquote:border-accent prose-blockquote:text-muted-foreground
              prose-li:text-muted-foreground
              max-w-none"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground mr-2">Tags:</span>
                {post.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs bg-card/50 border-border/50 text-muted-foreground"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <motion.section
            className="max-w-5xl mx-auto mt-16 pt-16 border-t border-border/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="font-outfit text-2xl font-light text-foreground mb-8">
              Related Posts
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  href={`/blog/${relatedPost.slug}`}
                  className={cn(
                    'group block relative rounded-xl overflow-hidden',
                    'bg-card/30 backdrop-blur-sm',
                    'border border-border/50',
                    'hover:border-accent/30 hover:shadow-[0_0_30px_rgba(0,223,130,0.1)]',
                    'transition-all duration-500'
                  )}
                >
                  {/* Image */}
                  <div className="aspect-[16/10] bg-gradient-to-br from-accent/5 via-card to-secondary/5 relative">
                    {relatedPost.featured_image_url ? (
                      <Image
                        src={relatedPost.featured_image_url}
                        alt={relatedPost.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <HugeiconsIcon icon={BookOpen01Icon} size={24} className="text-accent/20" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-outfit text-base font-medium text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                      {relatedPost.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2">
                      {relatedPost.reading_time_minutes} min read
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {/* Bottom CTA */}
        <motion.div
          className="max-w-3xl mx-auto mt-16 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div
            className="rounded-2xl p-8 sm:p-12
              bg-gradient-to-br from-accent/5 via-card/50 to-secondary/5
              border border-accent/20
              shadow-[0_0_40px_rgba(0,223,130,0.08)]"
          >
            <h3 className="font-outfit text-2xl font-light text-foreground mb-3">
              Ready to transform your knowledge?
            </h3>
            <p className="text-muted-foreground mb-6">
              Start capturing and sharing expertise with Tribora today.
            </p>
            <Link href="/sign-up">
              <Button
                className="rounded-full bg-gradient-to-r from-accent to-secondary
                  text-accent-foreground font-medium px-8 py-3
                  hover:shadow-[0_0_30px_rgba(0,223,130,0.4)]
                  transition-shadow duration-300"
              >
                Start Free Trial
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </article>
    </main>
  );
}
