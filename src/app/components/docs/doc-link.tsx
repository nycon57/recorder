import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface DocLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * DocLink — inline "Learn more" affordance for contextual doc entrypoints.
 *
 * Renders as a small, underline-on-hover link with a trailing external-style
 * arrow. Never uses amber unless the caller supplies it via className.
 * Designed to sit near section headings or description paragraphs without
 * interrupting layout.
 */
export function DocLink({ href, children, className }: DocLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1 text-sm text-muted-foreground',
        'underline-offset-4 hover:underline hover:text-foreground',
        'transition-colors duration-150',
        className,
      )}
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
}
