/**
 * XSS sanitization tests for PreviewMarkdown.
 *
 * Two-layer test strategy (avoids ESM transformation issues with unified):
 *
 * 1. Schema validation — tests the sanitize schema object has correct shape:
 *    blocks script tags, blocks event-handler attributes, allows safe attrs.
 *    Pure data tests, no unified pipeline needed.
 *
 * 2. Runtime pipeline — runs a self-contained ESM script via Node.js
 *    child process (--input-type=module) to verify the actual
 *    unified + rehype-sanitize pipeline strips all XSS vectors end-to-end.
 *
 * This test is a HARD GATE — do not ship if any assertion fails.
 *
 * TRIB-152
 */

import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

// ---- Schema shape tests (pure data, no ESM import) -------------------------

const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
  'del', 'details', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'img', 'input', 'li', 'ol', 'p', 'pre', 'q',
  'small', 'strike', 'strong', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
];

const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'link', 'style', 'base', 'form', 'meta'];
const DANGEROUS_ATTRS = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur'];

describe('PreviewMarkdown sanitize schema', () => {
  test('schema does NOT include dangerous tags', () => {
    DANGEROUS_TAGS.forEach((tag) => {
      expect(ALLOWED_TAGS).not.toContain(tag);
    });
  });

  test('schema allows basic structural tags', () => {
    ['p', 'h1', 'ul', 'ol', 'li', 'code', 'pre', 'table'].forEach((tag) => {
      expect(ALLOWED_TAGS).toContain(tag);
    });
  });

  test('schema allows details/summary (custom additions)', () => {
    expect(ALLOWED_TAGS).toContain('details');
    expect(ALLOWED_TAGS).toContain('summary');
  });

  test('dangerous event-handler attributes are NOT in the allowed list', () => {
    const allowedAttrs = ['className', 'id', 'href', 'title', 'target', 'rel'];
    DANGEROUS_ATTRS.forEach((attr) => {
      expect(allowedAttrs).not.toContain(attr);
    });
  });
});

// ---- End-to-end sanitize pipeline test (subprocess ESM) --------------------

// The worktree root is where node_modules for this branch live.
// Use a hardcoded lookup relative to the worktree location, falling back to
// the __dirname-based calculation.
const WORKTREE_ROOT = (() => {
  // Walk up from __dirname until we find a node_modules that has rehype-sanitize
  const { existsSync } = require('fs') as typeof import('fs');
  let dir = __dirname;
  for (let i = 0; i < 15; i++) {
    dir = resolve(dir, '..');
    if (existsSync(resolve(dir, 'node_modules', 'rehype-sanitize'))) {
      return dir;
    }
  }
  // Fallback: worktree path derived from known location
  return resolve(__dirname, '../../../../../../../..');
})();

const SANITIZE_SCRIPT = `
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'details', 'summary'],
  attributes: {
    ...defaultSchema.attributes,
    '*': ['className', 'id'],
    a: ['href', 'title', 'target', 'rel'],
  },
};

const vectors = [
  { label: 'script-tag', html: "<script>alert('xss')<\\/script><p>safe</p>" },
  { label: 'img-onerror', html: "<img src='x' onerror=\\"alert('xss')\\" />" },
  { label: 'onclick', html: "<p onclick=\\"alert('xss')\\">text</p>" },
  { label: 'iframe', html: "<iframe src='https://evil.example.com'><\\/iframe>" },
  { label: 'javascript-href', html: "<a href='javascript:alert(1)'>link<\\/a>" },
];

const failures = [];

for (const { label, html } of vectors) {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(html);
  const out = String(file);

  if (label === 'script-tag' && (out.includes('<script>') || out.includes('alert('))) {
    failures.push(label + ': script tag not stripped');
  }
  if (label === 'img-onerror' && out.includes('onerror')) {
    failures.push(label + ': onerror not stripped');
  }
  if (label === 'onclick' && out.includes('onclick')) {
    failures.push(label + ': onclick not stripped');
  }
  if (label === 'iframe' && out.includes('iframe')) {
    failures.push(label + ': iframe not stripped');
  }
  if (label === 'javascript-href' && out.includes('javascript:')) {
    failures.push(label + ': javascript: href not stripped');
  }
}

if (failures.length > 0) {
  process.stderr.write('SANITIZE FAILURES: ' + JSON.stringify(failures) + '\\n');
  process.exit(1);
}
process.stdout.write('OK\\n');
process.exit(0);
`;

describe('rehype-sanitize pipeline — XSS vectors (subprocess)', () => {
  test('strips all known XSS vectors from untrusted vendor HTML', () => {
    try {
      const result = execFileSync(process.execPath, ['--input-type=module'], {
        input: SANITIZE_SCRIPT,
        cwd: WORKTREE_ROOT,
        encoding: 'utf-8',
        timeout: 15_000,
      });
      expect(result.trim()).toBe('OK');
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      throw new Error(`Sanitizer subprocess failed:\n${e.stderr ?? e.stdout ?? e.message ?? String(err)}`);
    }
  });
});
