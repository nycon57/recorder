// We test the slug derivation logic directly.
// The `deriveSlug` function is internal to build.ts, so we duplicate its
// logic here as a pure function to keep the test dependency-free.
// This test also validates the regex enforcement (plan §1).

const CONTENT_ROOT_POSIX = 'content/docs';
const SLUG_REGEX = /^[a-z0-9][a-z0-9/-]*$/;

function deriveSlugPosix(absolutePosixPath: string): string {
  // Simulate the build.ts derivation on POSIX paths
  if (!absolutePosixPath.includes(CONTENT_ROOT_POSIX)) {
    throw new Error(`Path does not contain content root: ${absolutePosixPath}`);
  }
  const idx = absolutePosixPath.indexOf(CONTENT_ROOT_POSIX);
  const rel = absolutePosixPath.slice(idx + CONTENT_ROOT_POSIX.length + 1);
  let slug = rel.replace(/\.md$/, '');
  if (slug.endsWith('/index')) {
    slug = slug.slice(0, -'/index'.length) || 'index';
  }
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(`invalid slug: "${slug}"`);
  }
  return slug;
}

describe('slug derivation', () => {
  it('derives slug from nested path', () => {
    const path = '/repo/content/docs/product/recordings/capture-settings.md';
    expect(deriveSlugPosix(path)).toBe('product/recordings/capture-settings');
  });

  it('derives slug from top-level file', () => {
    const path = '/repo/content/docs/product/capture-settings.md';
    expect(deriveSlugPosix(path)).toBe('product/capture-settings');
  });

  it('maps index.md to directory slug', () => {
    const path = '/repo/content/docs/product/index.md';
    expect(deriveSlugPosix(path)).toBe('product');
  });

  it('maps nested index.md to parent slug', () => {
    const path = '/repo/content/docs/product/recordings/index.md';
    expect(deriveSlugPosix(path)).toBe('product/recordings');
  });

  it('produces valid slugs for getting-started section', () => {
    const path = '/repo/content/docs/getting-started/welcome.md';
    const slug = deriveSlugPosix(path);
    expect(slug).toBe('getting-started/welcome');
    expect(SLUG_REGEX.test(slug)).toBe(true);
  });

  it('rejects uppercase characters in slug', () => {
    const path = '/repo/content/docs/product/CapturePage.md';
    expect(() => deriveSlugPosix(path)).toThrow('invalid slug');
  });

  it('rejects slug starting with a hyphen at content root', () => {
    // A file directly under content/docs/-bad-slug.md produces slug "-bad-slug"
    // which fails the ^[a-z0-9] anchored regex.
    const path = '/repo/content/docs/-bad-slug.md';
    expect(() => deriveSlugPosix(path)).toThrow('invalid slug');
  });

  it('rejects slug with spaces', () => {
    const path = '/repo/content/docs/product/bad slug.md';
    expect(() => deriveSlugPosix(path)).toThrow('invalid slug');
  });

  it('allows hyphens in the middle of slug segments', () => {
    const slug = 'product/capture-settings';
    expect(SLUG_REGEX.test(slug)).toBe(true);
  });

  it('handles Windows-style separators by normalising', () => {
    // Simulate Windows path normalisation (sep join → posix join)
    const winRel = 'product\\recordings\\capture-settings.md';
    const normalised = winRel.split('\\').join('/');
    const slug = normalised.replace(/\.md$/, '');
    expect(slug).toBe('product/recordings/capture-settings');
    expect(SLUG_REGEX.test(slug)).toBe(true);
  });
});
