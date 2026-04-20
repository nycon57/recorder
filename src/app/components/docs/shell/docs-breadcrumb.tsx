import Link from 'next/link';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb';

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface DocsBreadcrumbProps {
  segments: BreadcrumbSegment[];
}

/**
 * Breadcrumb bar for the docs shell.
 * Segments with an `href` are links; the final segment is rendered as the current page.
 */
export function DocsBreadcrumb({ segments }: DocsBreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/docs">Docs</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <span key={seg.label} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast || !seg.href ? (
                  <BreadcrumbPage>{seg.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={seg.href}>{seg.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
