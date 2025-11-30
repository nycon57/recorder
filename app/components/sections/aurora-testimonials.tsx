'use client';

import * as motion from 'motion/react-client';
import AutoScroll from 'embla-carousel-auto-scroll';
import { useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { QuoteUpIcon, SparklesIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/app/components/ui/carousel';

// Animation variants for header content
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

/**
 * AuroraTestimonials - Auto-scrolling testimonial carousels
 *
 * Design adapted from shadcnblocks Testimonial7 with Tribora Aurora styling.
 * Features:
 * - Two rows of auto-scrolling testimonials (opposite directions)
 * - Glass-effect cards with accent glow on hover
 * - Aurora gradient backgrounds
 * - Smooth infinite scroll animation
 */

interface Testimonial {
  name: string;
  role: string;
  company: string;
  avatar: string;
  content: string;
}

const testimonials1: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Head of Engineering',
    company: 'TechCorp',
    avatar: 'https://i.pravatar.cc/100?img=1',
    content:
      'Tribora has transformed how we capture and share knowledge. Our onboarding time has been cut in half because new hires can watch expert walkthroughs and search for answers instantly.',
  },
  {
    name: 'Michael Rodriguez',
    role: 'Operations Manager',
    company: 'StartupXYZ',
    avatar: 'https://i.pravatar.cc/100?img=3',
    content:
      'The AI-generated documentation is incredible. We used to spend hours writing process docs, now Tribora does it automatically from our screen recordings.',
  },
  {
    name: 'Emily Watson',
    role: 'Customer Success Lead',
    company: 'SaaS Co',
    avatar: 'https://i.pravatar.cc/100?img=5',
    content:
      "We've built an entire knowledge base from our team's expertise. The semantic search means anyone can find the exact information they need in seconds.",
  },
  {
    name: 'David Park',
    role: 'Product Manager',
    company: 'InnovateTech',
    avatar: 'https://i.pravatar.cc/100?img=8',
    content:
      'The knowledge graph feature is a game-changer. It connects concepts across all our recordings, creating a living documentation system.',
  },
  {
    name: 'Amanda Foster',
    role: 'VP of Sales',
    company: 'GrowthScale',
    avatar: 'https://i.pravatar.cc/100?img=9',
    content:
      'Our sales team uses Tribora to record best practices. New reps can learn from top performers instantly—it\'s like having a mentor on demand.',
  },
  {
    name: 'Robert Kim',
    role: 'DevOps Lead',
    company: 'CloudFirst',
    avatar: 'https://i.pravatar.cc/100?img=11',
    content:
      'Debugging sessions recorded in Tribora have saved us countless hours. When issues recur, we have searchable video evidence of how we fixed them.',
  },
];

const testimonials2: Testimonial[] = [
  {
    name: 'Lisa Thompson',
    role: 'Training Director',
    company: 'Enterprise Inc',
    avatar: 'https://i.pravatar.cc/100?img=16',
    content:
      'Finally, a tool that captures the "how" behind processes. Our experts can record once, and the whole team benefits forever.',
  },
  {
    name: 'James Wilson',
    role: 'CTO',
    company: 'DataFlow',
    avatar: 'https://i.pravatar.cc/100?img=12',
    content:
      'The RAG assistant is like having a senior team member available 24/7. It answers questions with exact citations from our recordings.',
  },
  {
    name: 'Nina Patel',
    role: 'Head of Product',
    company: 'FinTech Pro',
    avatar: 'https://i.pravatar.cc/100?img=21',
    content:
      'We replaced three different tools with Tribora. Recording, transcription, documentation, and search—all in one platform that actually works.',
  },
  {
    name: 'Marcus Johnson',
    role: 'Engineering Manager',
    company: 'ScaleUp',
    avatar: 'https://i.pravatar.cc/100?img=13',
    content:
      'Code reviews with Tribora recordings have elevated our entire team. Junior devs can pause, rewind, and really understand the reasoning.',
  },
  {
    name: 'Sophie Laurent',
    role: 'Design Lead',
    company: 'CreativeHub',
    avatar: 'https://i.pravatar.cc/100?img=25',
    content:
      'I record design critiques and tutorials for my team. The auto-generated docs capture everything, even the visual decisions I explain on screen.',
  },
  {
    name: 'Alex Turner',
    role: 'CEO',
    company: 'Nexus AI',
    avatar: 'https://i.pravatar.cc/100?img=15',
    content:
      'Tribora is our institutional memory. When employees leave, their knowledge stays. That alone makes it invaluable for any growing company.',
  },
];

const AuroraTestimonials = () => {
  const plugin1 = useRef(
    AutoScroll({
      startDelay: 500,
      speed: 0.5,
      stopOnInteraction: false,
    })
  );

  const plugin2 = useRef(
    AutoScroll({
      startDelay: 500,
      speed: 0.5,
      direction: 'backward',
      stopOnInteraction: false,
    })
  );

  return (
    <section className="relative py-20 sm:py-28 lg:py-32 overflow-hidden">
      {/* === BACKGROUND LAYERS === */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top gradient connecting from features */}
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-background to-transparent" />

        {/* Flowing aurora orbs */}
        <div
          className="absolute top-[20%] left-[5%] w-[450px] h-[450px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.08)_0%,transparent_70%)]
            blur-[100px] animate-float"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
            blur-[80px] animate-float"
          style={{ animationDelay: '4s' }}
        />

        {/* Subtle accent line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/10 to-transparent" />
      </div>

      {/* === HEADER === */}
      <motion.div
        className="container px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center gap-6 mb-12 sm:mb-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp}>
          <Badge
            variant="outline"
            className="px-4 py-2 rounded-full bg-accent/5 backdrop-blur-sm border-accent/30"
          >
            <HugeiconsIcon icon={SparklesIcon} size={16} className="mr-2 text-accent" />
            <span className="text-sm font-medium text-accent">Testimonials</span>
          </Badge>
        </motion.div>

        <motion.h2
          className="font-outfit text-center text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight"
          variants={fadeInUp}
        >
          Trusted by{' '}
          <span className="bg-gradient-to-r from-accent via-secondary to-primary bg-clip-text text-transparent">
            knowledge-driven teams
          </span>
        </motion.h2>

        <motion.p
          className="text-center text-muted-foreground text-lg max-w-2xl"
          variants={fadeInUp}
        >
          See how teams are transforming tacit expertise into searchable,
          AI-powered knowledge bases.
        </motion.p>

        <motion.div variants={fadeInUp}>
          <Link href="/sign-up">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Button
                className={cn(
                  'mt-4 h-12 px-8 rounded-full',
                  'bg-gradient-to-r from-accent to-secondary',
                  'text-accent-foreground font-medium',
                  'transition-shadow duration-300',
                  'hover:shadow-[0_0_30px_rgba(0,223,130,0.4)]'
                )}
              >
                Get started free
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-2" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </motion.div>

      {/* === CAROUSELS === */}
      <div className="relative z-10">
        <div className="space-y-4">
          {/* First Row - Forward Direction */}
          <Carousel
            opts={{
              loop: true,
              align: 'start',
            }}
            plugins={[plugin1.current]}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {testimonials1.map((testimonial, index) => (
                <CarouselItem key={index} className="pl-4 basis-auto">
                  <Card
                    className={cn(
                      'group max-w-[400px] select-none p-6',
                      'bg-card/50 backdrop-blur-sm',
                      'border border-border/50 rounded-2xl',
                      'transition-all duration-500',
                      'hover:border-accent/30',
                      'hover:shadow-[0_0_40px_rgba(0,223,130,0.1)]'
                    )}
                  >
                    {/* Header with Avatar */}
                    <div className="mb-4 flex gap-4 items-center">
                      <Avatar className="h-11 w-11 ring-2 ring-accent/20 transition-all duration-300 group-hover:ring-accent/40">
                        <AvatarImage
                          src={testimonial.avatar}
                          alt={testimonial.name}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-accent to-secondary text-accent-foreground text-sm font-medium">
                          {testimonial.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium text-foreground group-hover:text-accent transition-colors">
                          {testimonial.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {testimonial.role} · {testimonial.company}
                        </p>
                      </div>
                      <HugeiconsIcon icon={QuoteUpIcon} size={20} className="ml-auto text-accent/30 group-hover:text-accent/60 transition-colors" />
                    </div>

                    {/* Quote */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      "{testimonial.content}"
                    </p>

                    {/* Bottom glow */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Second Row - Backward Direction */}
          <Carousel
            opts={{
              loop: true,
              align: 'start',
            }}
            plugins={[plugin2.current]}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {testimonials2.map((testimonial, index) => (
                <CarouselItem key={index} className="pl-4 basis-auto">
                  <Card
                    className={cn(
                      'group max-w-[400px] select-none p-6',
                      'bg-card/50 backdrop-blur-sm',
                      'border border-border/50 rounded-2xl',
                      'transition-all duration-500',
                      'hover:border-secondary/30',
                      'hover:shadow-[0_0_40px_rgba(44,194,149,0.1)]'
                    )}
                  >
                    {/* Header with Avatar */}
                    <div className="mb-4 flex gap-4 items-center">
                      <Avatar className="h-11 w-11 ring-2 ring-secondary/20 transition-all duration-300 group-hover:ring-secondary/40">
                        <AvatarImage
                          src={testimonial.avatar}
                          alt={testimonial.name}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-secondary to-accent text-accent-foreground text-sm font-medium">
                          {testimonial.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium text-foreground group-hover:text-secondary transition-colors">
                          {testimonial.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {testimonial.role} · {testimonial.company}
                        </p>
                      </div>
                      <HugeiconsIcon icon={QuoteUpIcon} size={20} className="ml-auto text-secondary/30 group-hover:text-secondary/60 transition-colors" />
                    </div>

                    {/* Quote */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      "{testimonial.content}"
                    </p>

                    {/* Bottom glow */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Edge fade gradients */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
      </div>
    </section>
  );
};

export { AuroraTestimonials };
