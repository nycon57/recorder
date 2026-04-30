/* global describe, expect, it */

import { parseFrontmatter } from '../lib/parse-frontmatter';

describe('parseFrontmatter', () => {
  it('accepts minimal valid frontmatter', () => {
    const source = `---
title: Hello
description: World
audience: public
section: getting-started
---
Body here.
`;
    const { data, body } = parseFrontmatter(source);
    expect(data.title).toBe('Hello');
    expect(data.description).toBe('World');
    expect(data.audience).toBe('public');
    expect(data.section).toBe('getting-started');
    expect(body.trim()).toBe('Body here.');
  });

  it('returns empty data when no --- delimiter at start', () => {
    const source = 'No frontmatter here.\n\nJust body.';
    const { data, body } = parseFrontmatter(source);
    expect(data).toEqual({});
    expect(body).toBe(source);
  });

  it('handles missing closing delimiter', () => {
    const source = `---
title: Broken
`;
    const { data, body } = parseFrontmatter(source);
    // No closing delimiter — treated as no frontmatter
    expect(data).toEqual({});
    expect(body).toBe(source);
  });

  it('parses quoted strings', () => {
    const source = `---
title: "Quoted: with colon"
description: 'Single quoted'
---
`;
    const { data } = parseFrontmatter(source);
    expect(data.title).toBe('Quoted: with colon');
    expect(data.description).toBe('Single quoted');
  });

  it('parses flow arrays [a, b, c]', () => {
    const source = `---
tags: [recordings, recorder, capture]
---
`;
    const { data } = parseFrontmatter(source);
    expect(data.tags).toEqual(['recordings', 'recorder', 'capture']);
  });

  it('parses block arrays', () => {
    const source = `---
related:
  - product/recordings/share-permissions
  - product/recordings/capture-settings
---
`;
    const { data } = parseFrontmatter(source);
    expect(data.related).toEqual([
      'product/recordings/share-permissions',
      'product/recordings/capture-settings',
    ]);
  });

  it('parses boolean scalars', () => {
    const source = `---
draft: true
unlisted: false
---
`;
    const { data } = parseFrontmatter(source);
    expect(data.draft).toBe(true);
    expect(data.unlisted).toBe(false);
  });

  it('parses integer scalars', () => {
    const source = `---
order: 42
---
`;
    const { data } = parseFrontmatter(source);
    expect(data.order).toBe(42);
  });

  it('provides rawYaml string for hashing', () => {
    const source = `---
title: Test
---
Body.
`;
    const { rawYaml } = parseFrontmatter(source);
    expect(rawYaml).toContain('title: Test');
  });

  it('separates body correctly', () => {
    const source = `---
title: Test
---

# Heading

Paragraph.
`;
    const { body } = parseFrontmatter(source);
    expect(body).toContain('# Heading');
    expect(body).toContain('Paragraph.');
    expect(body).not.toContain('title:');
  });

  it('handles CRLF line endings', () => {
    const source = '---\r\ntitle: CRLF\r\n---\r\nBody.\r\n';
    const { data, body } = parseFrontmatter(source);
    expect(data.title).toBe('CRLF');
    expect(body).toContain('Body.');
  });

  it('skips comment lines', () => {
    const source = `---
# This is a comment
title: Uncommented
---
`;
    const { data } = parseFrontmatter(source);
    expect(data.title).toBe('Uncommented');
    expect(data).not.toHaveProperty('#');
  });
});
