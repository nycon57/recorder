/**
 * compile-markdown.ts
 *
 * unified pipeline: Markdown → sanitized HTML with Shiki code highlighting.
 *
 * Stack:
 *   remark-parse → remark-gfm → remark-rehype
 *   → rehype-slug → rehype-autolink-headings
 *   → [shiki rehype plugin] → rehype-sanitize → rehype-stringify
 *
 * A single Shiki highlighter is created once and reused across all pages.
 * See plan §3 / §17.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { createHighlighter, type Highlighter } from 'shiki';
import type { Root, Element } from 'hast';
import type { Plugin } from 'unified';

// ── Shiki singleton ───────────────────────────────────────────────────────────

let _highlighter: Highlighter | null = null;

/** Create (or return cached) the Shiki highlighter. */
async function getHighlighter(): Promise<Highlighter> {
  if (_highlighter) return _highlighter;
  _highlighter = await createHighlighter({
    themes: ['github-dark-dimmed'],
    langs: [
      'typescript',
      'tsx',
      'javascript',
      'jsx',
      'bash',
      'shell',
      'json',
      'yaml',
      'toml',
      'markdown',
      'html',
      'css',
      'sql',
      'python',
    ],
  });
  return _highlighter;
}

// ── Shiki rehype plugin ───────────────────────────────────────────────────────

/**
 * Walk HAST for `<pre><code class="language-*">` nodes and replace with
 * Shiki-highlighted HTML. Nodes without a language class pass through unchanged.
 */
function makeShikiPlugin(highlighter: Highlighter): Plugin<[], Root> {
  return () => async (tree) => {
    const { visit } = await import('unist-util-visit');

    const tasks: Array<() => Promise<void>> = [];

    visit(tree, 'element', (node: Element, index, parent) => {
      if (
        node.tagName !== 'pre' ||
        !Array.isArray(node.children) ||
        node.children.length !== 1
      ) {
        return;
      }

      const code = node.children[0] as Element;
      if (!code || code.tagName !== 'code') return;

      // Extract language from class: `language-typescript`
      const classAttr = code.properties?.className;
      const classes = Array.isArray(classAttr) ? classAttr : [];
      const langClass = (classes as string[]).find((c: string) =>
        c.startsWith('language-'),
      );
      if (!langClass) return;

      const lang = langClass.replace('language-', '');
      // Get text content
      const textNode = code.children[0];
      if (!textNode || textNode.type !== 'text') return;
      const code_text = textNode.value;

      if (!parent || index == null) return;

      tasks.push(async () => {
        let highlighted: string;
        try {
          highlighted = highlighter.codeToHtml(code_text, {
            lang,
            theme: 'github-dark-dimmed',
          });
        } catch {
          // Unknown language — fall back to plain <pre><code>
          return;
        }

        // Replace the <pre> node with a raw HTML node
        const { fromHtml } = await import('hast-util-from-html');
        const fragment = fromHtml(highlighted, { fragment: true });
        if (fragment.children.length > 0 && parent.children) {
          (parent.children as unknown[])[index] = fragment.children[0];
        }
      });
    });

    await Promise.all(tasks.map((t) => t()));
  };
}

// ── Sanitize schema ───────────────────────────────────────────────────────────

/**
 * Extend the default rehype-sanitize schema to allow:
 * - `class` / `className` attributes (Shiki adds these)
 * - `id` attributes (heading slugs)
 * - `data-*` attributes (autolink-headings ARIA)
 * - `aria-*` attributes
 * - `tabindex` (autolink-headings focus ring)
 * - `style` on spans (Shiki inline styles)
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'className',
      'class',
      'id',
      'tabIndex',
      'tabindex',
      'aria-hidden',
      'aria-label',
      ['style', /^color:[^;]+;?$/], // Shiki inline color only
    ],
    span: [
      ...(defaultSchema.attributes?.['span'] ?? []),
      'style',
      'className',
      'class',
    ],
    code: [
      ...(defaultSchema.attributes?.['code'] ?? []),
      'className',
      'class',
    ],
    a: [
      ...(defaultSchema.attributes?.['a'] ?? []),
      'href',
      'aria-hidden',
      'tabIndex',
      'tabindex',
    ],
  },
  // Allow data-* attrs
  strip: [],
} as typeof defaultSchema;

// ── Public compile function ───────────────────────────────────────────────────

/**
 * Compile a Markdown string to a sanitized HTML string.
 * Call once per file during `npm run prebuild`.
 */
export async function compileMarkdown(markdown: string): Promise<string> {
  const highlighter = await getHighlighter();
  const shikiPlugin = makeShikiPlugin(highlighter);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: { ariaHidden: true, tabIndex: -1 },
    })
    .use(shikiPlugin)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(markdown);

  return String(result);
}

/** Release the cached Shiki highlighter (useful in tests). */
export function disposeHighlighter(): void {
  _highlighter?.dispose();
  _highlighter = null;
}
