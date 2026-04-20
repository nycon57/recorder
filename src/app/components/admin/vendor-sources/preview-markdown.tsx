'use client';

/**
 * PreviewMarkdown
 *
 * Isolated react-markdown render path for untrusted vendor content.
 * Applies rehype-sanitize with an explicit allow-list schema.
 * External links are force-attributed with rel="noopener noreferrer nofollow".
 *
 * XSS coverage is asserted in __tests__/preview-markdown.test.tsx.
 *
 * TRIB-152
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Element } from 'hast';

// ---------------------------------------------------------------------------
// Sanitize schema — explicit allow-list on top of defaultSchema
// ---------------------------------------------------------------------------

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'details',
    'summary',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': ['className', 'id'],
    a: ['href', 'title', 'target', 'rel'],
  },
};

// ---------------------------------------------------------------------------
// Rehype plugin: force external links to safe rel + target
// ---------------------------------------------------------------------------

function rehypeExternalLinks() {
  return (tree: Element) => {
    visitNodes(tree);
  };

  function visitNodes(node: unknown) {
    const n = node as {
      type?: string;
      tagName?: string;
      properties?: Record<string, unknown>;
      children?: unknown[];
    };
    if (n.type === 'element' && n.tagName === 'a' && n.properties) {
      const href = String(n.properties.href ?? '');
      if (href.startsWith('http://') || href.startsWith('https://')) {
        n.properties.target = '_blank';
        n.properties.rel = 'noopener noreferrer nofollow';
      }
      // Belt+suspenders: strip javascript: protocol (sanitize also blocks it)
      if (/^javascript:/i.test(href)) {
        n.properties.href = '#';
      }
    }
    if (Array.isArray(n.children)) {
      n.children.forEach(visitNodes);
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PreviewMarkdownProps {
  content: string;
}

export function PreviewMarkdown({ content }: PreviewMarkdownProps) {
  return (
    <div className="prose-sm max-w-none text-sm text-foreground leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeSanitize, sanitizeSchema],
          rehypeExternalLinks,
        ]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-3 mb-1.5">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li className="text-sm">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            return isBlock ? (
              <code className="block font-mono text-xs">{children}</code>
            ) : (
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono mb-3">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-medium bg-muted">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground mb-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
