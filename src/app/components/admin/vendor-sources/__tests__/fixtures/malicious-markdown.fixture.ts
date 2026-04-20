/**
 * Malicious markdown fixtures for XSS sanitizer testing.
 * These strings represent common injection vectors that must be
 * neutralised by rehype-sanitize before rendering in the browser.
 *
 * TRIB-152
 */

export const scriptTag = `
# Normal heading

<script>alert('xss-script-tag')</script>

Paragraph text.
`;

export const imgOnerror = `
Some text.

<img src="x" onerror="alert('xss-onerror')" />

More text.
`;

export const javascriptHref = `
[Click me](javascript:alert('xss-js-href'))
`;

export const inlineEventHandler = `
<p onclick="alert('xss-onclick')">Click</p>
`;

export const iframeEmbed = `
<iframe src="https://evil.example.com/steal-cookies"></iframe>
`;

export const validMarkdown = `
# Real heading

Some **bold** and *italic* text.

- List item 1
- List item 2

[Safe link](https://docs.example.com)

\`\`\`
code block
\`\`\`
`;
