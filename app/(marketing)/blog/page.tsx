'use client';

import { useEffect, useState, useMemo } from 'react';
import * as motion from 'motion/react-client';
import Link from 'next/link';
import Image from 'next/image';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  Clock01Icon,
  SparklesIcon,
  BookOpen01Icon,
  FilterIcon,
  Search01Icon,
  SortingAZ01Icon,
  Tag01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import type { BlogPostCard, BlogPostCategory } from '@/lib/types/database';

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

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

const CATEGORIES: { value: BlogPostCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Posts' },
  { value: 'product', label: 'Product' },
  { value: 'insights', label: 'Insights' },
  { value: 'tutorials', label: 'Tutorials' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'reading_time', label: 'Reading Time' },
];

const CATEGORY_COLORS: Record<BlogPostCategory, string> = {
  product: 'bg-accent/10 text-accent border-accent/30',
  insights: 'bg-secondary/10 text-secondary border-secondary/30',
  tutorials: 'bg-primary/10 text-primary border-primary/30',
  general: 'bg-muted text-muted-foreground border-border',
};

/**
 * Blog Archive Page - Premium blog listing with aurora styling
 *
 * Features:
 * - Featured posts section with hero card
 * - Search functionality
 * - Category filtering
 * - Sort options
 * - Tag filtering
 * - Aurora gradient backgrounds
 * - Glass-effect cards
 * - Responsive grid layout
 */
export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPostCard[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<BlogPostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BlogPostCategory | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    async function fetchPosts() {
      try {
        // Fetch all posts
        const response = await fetch('/api/blog?limit=50');
        const data = await response.json();
        setPosts(data.posts || []);

        // Separate featured posts
        setFeaturedPosts((data.posts || []).filter((p: BlogPostCard) => p.is_featured));
      } catch (error) {
        console.error('Failed to fetch blog posts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  // Extract all unique tags from posts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    posts.forEach(post => {
      post.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [posts]);

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
    let result = posts.filter(p => !p.is_featured);

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Tag filter
    if (selectedTag) {
      result = result.filter(p => p.tags?.includes(selectedTag));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(query) ||
          p.excerpt?.toLowerCase().includes(query) ||
          p.author_name.toLowerCase().includes(query) ||
          p.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.published_at || 0).getTime() - new Date(b.published_at || 0).getTime());
        break;
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'reading_time':
        result.sort((a, b) => a.reading_time_minutes - b.reading_time_minutes);
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
        break;
    }

    return result;
  }, [posts, selectedCategory, selectedTag, searchQuery, sortBy]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedTag(null);
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || selectedCategory !== 'all' || selectedTag || sortBy !== 'newest';

  return (
    <main className="relative min-h-screen bg-background">
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Aurora orbs */}
        <div
          className="absolute top-[-10%] right-[10%] w-[600px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.12)_0%,transparent_70%)]
            blur-[100px] animate-float"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="absolute bottom-[20%] left-[5%] w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.08)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '2s' }}
        />

        {/* Radial gradient from top */}
        <div
          className="absolute inset-0
            bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,223,130,0.08),transparent_60%)]"
        />

        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.3]
            bg-[radial-gradient(rgba(0,223,130,0.4)_1px,transparent_1px)]
            [background-size:24px_24px]
            [mask-image:radial-gradient(ellipse_80%_60%_at_50%_20%,black_10%,transparent_60%)]"
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.015]"
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
      <div className="relative z-10 container px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-20">
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp}>
            <Badge
              variant="outline"
              className="mb-6 px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm
                border-accent/30"
            >
              <HugeiconsIcon icon={BookOpen01Icon} size={14} className="mr-2 text-accent" />
              <span className="text-sm font-medium text-accent">Blog</span>
            </Badge>
          </motion.div>

          <motion.h1
            className="font-outfit text-4xl sm:text-5xl lg:text-6xl font-light
              leading-tight tracking-tight mb-4 sm:mb-6"
            variants={fadeInUp}
          >
            Insights &{' '}
            <span
              className="bg-gradient-to-r from-accent via-secondary to-primary
                bg-clip-text text-transparent"
            >
              Knowledge
            </span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground font-light max-w-2xl mx-auto"
            variants={fadeInUp}
          >
            Explore the latest in knowledge management, AI, and team productivity.
            Learn how leading teams capture and share expertise.
          </motion.p>
        </motion.div>

        {/* Featured Posts */}
        {featuredPosts.length > 0 && (
          <motion.section
            className="mb-16 sm:mb-20"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div
              className="flex items-center gap-2 mb-6"
              variants={fadeInUp}
            >
              <HugeiconsIcon icon={SparklesIcon} size={20} className="text-accent" />
              <h2 className="text-lg font-medium text-foreground">Featured</h2>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {featuredPosts.slice(0, 2).map((post) => (
                <motion.article
                  key={post.id}
                  variants={cardVariants}
                  whileHover={{ y: -8, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                >
                  <Link
                    href={`/blog/${post.slug}`}
                    className={cn(
                      'group block relative rounded-2xl overflow-hidden h-full',
                      'bg-card/50 backdrop-blur-sm',
                      'border border-accent/30',
                      'hover:border-accent/50 hover:shadow-[0_0_50px_rgba(0,223,130,0.15)]',
                      'transition-all duration-500'
                    )}
                  >
                    {/* Featured image area */}
                    <div className="aspect-[16/9] bg-gradient-to-br from-accent/10 via-card to-secondary/10 relative">
                      {post.featured_image_url ? (
                        <Image
                          src={post.featured_image_url}
                          alt={post.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <HugeiconsIcon icon={BookOpen01Icon} size={48} className="text-accent/30" />
                        </div>
                      )}
                      {/* Featured badge */}
                      <div className="absolute top-4 left-4">
                        <Badge
                          className="bg-accent text-accent-foreground border-0"
                        >
                          <HugeiconsIcon icon={SparklesIcon} size={12} className="mr-1" />
                          Featured
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', CATEGORY_COLORS[post.category])}
                        >
                          {post.category}
                        </Badge>
                        <span className="flex items-center text-xs text-muted-foreground">
                          <HugeiconsIcon icon={Clock01Icon} size={12} className="mr-1" />
                          {post.reading_time_minutes} min read
                        </span>
                      </div>

                      <h3 className="font-outfit text-xl font-medium text-foreground mb-2 group-hover:text-accent transition-colors">
                        {post.title}
                      </h3>

                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {post.excerpt}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-accent">
                              {post.author_name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{post.author_name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(post.published_at)}</p>
                          </div>
                        </div>

                        <span className="flex items-center text-sm text-accent group-hover:translate-x-1 transition-transform">
                          Read more
                          <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-1" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          </motion.section>
        )}

        {/* Search, Filter & Sort Bar */}
        <motion.div
          className="mb-8 space-y-4"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          {/* Search and Sort Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/50 border-border/50 focus:border-accent/50
                  placeholder:text-muted-foreground/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px] bg-card/50 border-border/50">
                <HugeiconsIcon icon={SortingAZ01Icon} size={16} className="mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <HugeiconsIcon icon={FilterIcon} size={16} className="text-muted-foreground" />
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant="outline"
                size="sm"
                className={cn(
                  'rounded-full transition-all duration-300',
                  selectedCategory === cat.value
                    ? 'bg-accent/10 border-accent/50 text-accent'
                    : 'bg-card/50 border-border/50 text-muted-foreground hover:border-accent/30'
                )}
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label}
              </Button>
            ))}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} className="mr-1" />
                Clear filters
              </Button>
            )}
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <HugeiconsIcon icon={Tag01Icon} size={16} className="text-muted-foreground" />
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    'cursor-pointer transition-all duration-300',
                    selectedTag === tag
                      ? 'bg-accent/10 border-accent/50 text-accent'
                      : 'bg-card/30 border-border/30 text-muted-foreground hover:border-accent/30'
                  )}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </motion.div>

        {/* Results count */}
        {!loading && (
          <motion.p
            className="text-sm text-muted-foreground mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'} found
            {hasActiveFilters && ' (filtered)'}
          </motion.p>
        )}

        {/* Posts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-card/30 border border-border/30 animate-pulse"
              >
                <div className="aspect-[16/10] bg-muted/20" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-20 bg-muted/20 rounded" />
                  <div className="h-6 w-3/4 bg-muted/20 rounded" />
                  <div className="h-4 w-full bg-muted/20 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            key={`${selectedCategory}-${selectedTag}-${searchQuery}-${sortBy}`}
          >
            {filteredPosts.map((post) => (
              <motion.article
                key={post.id}
                variants={cardVariants}
                whileHover={{ y: -6, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className={cn(
                    'group block relative rounded-xl overflow-hidden h-full',
                    'bg-card/30 backdrop-blur-sm',
                    'border border-border/50',
                    'hover:border-accent/30 hover:shadow-[0_0_30px_rgba(0,223,130,0.1)]',
                    'transition-all duration-500'
                  )}
                >
                  {/* Image area */}
                  <div className="aspect-[16/10] bg-gradient-to-br from-accent/5 via-card to-secondary/5 relative">
                    {post.featured_image_url ? (
                      <Image
                        src={post.featured_image_url}
                        alt={post.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <HugeiconsIcon icon={BookOpen01Icon} size={32} className="text-accent/20" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge
                        variant="outline"
                        className={cn('text-xs', CATEGORY_COLORS[post.category])}
                      >
                        {post.category}
                      </Badge>
                      <span className="flex items-center text-xs text-muted-foreground">
                        <HugeiconsIcon icon={Clock01Icon} size={12} className="mr-1" />
                        {post.reading_time_minutes} min
                      </span>
                    </div>

                    <h3 className="font-outfit text-lg font-medium text-foreground mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                      {post.title}
                    </h3>

                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Tags preview */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {post.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs text-muted-foreground/70 bg-muted/30 px-2 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {post.tags.length > 2 && (
                          <span className="text-xs text-muted-foreground/50">
                            +{post.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-border/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{post.author_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(post.published_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && filteredPosts.length === 0 && (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <HugeiconsIcon icon={BookOpen01Icon} size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg text-muted-foreground mb-4">No posts found.</p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={clearFilters}
              >
                Clear all filters
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </main>
  );
}
