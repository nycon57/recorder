'use client';

import * as React from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { cn } from '@/lib/utils';

interface RichTextViewerProps {
  content: string;
  title?: string | null;
  className?: string;
}

export default function RichTextViewer({
  content,
  title,
  className,
}: RichTextViewerProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Content Viewer */}
      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="min-h-[400px] max-h-[800px] overflow-y-auto px-6 py-8 sm:px-8 sm:py-10">
            <div className="prose dark:prose-invert max-w-3xl mx-auto prose-sm sm:prose-base prose-headings:font-semibold prose-p:leading-relaxed">
              {title && (
                <h1 className="text-2xl font-semibold mb-6">{title}</h1>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm sm:text-base leading-relaxed">
                {content}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
