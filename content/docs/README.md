# Docs content authoring guide

All docs pages live under `content/docs/`. Each `.md` file becomes one page in the `/docs` route.

## Directory structure

```
content/docs/
  <section>/
    <optional-group>/
      <slug>.md
```

- `<section>` must exactly match one of the 12 `SectionId` values in `src/lib/docs/sections.ts`:
  `getting-started`, `product`, `integrations`, `reference`, `policies`,
  `knowledge-ops`, `org-admin`, `observability`, `platform-runbooks`,
  `vendor-sources`, `system-admin`, `security`.
- `<optional-group>` is a directory for authoring convenience. It does **not** auto-map to `group:` frontmatter. Set `group:` explicitly if you want nav grouping.
- `index.md` inside a subdirectory maps to the directory's slug:
  `content/docs/product/index.md` → slug `product`.
- Files whose name starts with `_`, or inside a folder starting with `_`, are skipped (authoring scratch).

## Frontmatter

```yaml
---
title: "Capture settings"
description: "Configure what the recorder captures and at what quality."
audience: public          # public | org-admin | system-admin
section: product          # must be a valid SectionId
group: Recordings         # optional — used for nav nesting within a section
order: 20                 # optional — sort order within section/group (default 1000)
related:
  - product/recordings/share-permissions
tags: [recordings, recorder]
draft: false              # omit or false = published; true = dev-only preview
unlisted: false           # omit or false = shown in nav; true = direct URL only
---
```

**Do not author these fields** — they are derived automatically:

| Field | Source |
|---|---|
| `slug` | Derived from file path |
| `updatedAt` | `git log -1` for the file (falls back to file mtime) |
| `source` | Set to `'git'` by the loader |
| `contentHash` | SHA-256 of frontmatter + body, truncated to 16 chars |

Adding `slug` or `updatedAt` to frontmatter causes a hard build failure.

## Body

Write standard GitHub Flavored Markdown (GFM). Code blocks get Shiki syntax highlighting with the `github-dark-dimmed` theme:

````markdown
```typescript
const greeting = "hello, tribora";
```
````

Supported languages: `typescript`, `tsx`, `javascript`, `jsx`, `bash`, `shell`, `json`, `yaml`, `toml`, `markdown`, `html`, `css`, `sql`, `python`.

## Draft pages

```yaml
draft: true
```

Draft pages are included in development (`npm run dev`) but excluded from production builds (`npm run build`). Use drafts while authoring content that isn't ready to ship.

## Build integration

The pipeline runs automatically before every `next build`:

```bash
npm run build          # triggers prebuild → docs compile → next build
npx tsx scripts/docs/build.ts   # run the pipeline alone (dev/testing)
```

The build fails loudly if:
- Required frontmatter fields are missing or invalid
- `slug` or `updatedAt` appear in frontmatter
- A derived slug doesn't match `^[a-z0-9][a-z0-9/-]*$`

## CI notes

Vercel defaults to `fetch-depth: 10`, which is sufficient for `updatedAt` resolution
in most cases. If your repo has very deep history and shallow clones, `updatedAt` may
degrade to the checkout time. Use `fetch-depth: 0` in CI to get accurate timestamps.
