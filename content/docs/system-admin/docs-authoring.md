---
title: Docs authoring
description: Frontmatter shape, slug rules, order conventions, related-link rules, Zod validation loop, and DB-override mechanics for Tribora docs authors.
audience: system-admin
section: system-admin
order: 50
related:
  - system-admin/feature-flags
tags:
  - runbook
  - docs
  - authoring
---

## Overview

This page documents how to author, validate, and maintain docs pages in the Tribora repository. It restates the technical contract from `content/docs/README.md` and adds the DB-adapter specifics that README does not cover. Keep this page current as the pipeline evolves.

## File location and naming

All docs pages live under `content/docs/<section>/<slug>.md`. The file path determines the page slug — there is no frontmatter `slug` field. The slug derivation rules are:

- `content/docs/product/recordings.md` → slug `product/recordings`
- `content/docs/system-admin/debug-tools.md` → slug `system-admin/debug-tools`
- `content/docs/product/index.md` → slug `product` (directory index)
- Files or directories starting with `_` are skipped entirely (authoring scratch).

Slug validation regex: `^[a-z0-9][a-z0-9/-]*$`. The build fails loudly on any slug that does not match.

## Required frontmatter

```yaml
---
title: "Page title"
description: "One sentence used in nav and meta description."
audience: system-admin    # public | org-admin | system-admin
section: system-admin     # must be a valid SectionId (12 values)
---
```

**Do not include these fields** — the pipeline derives them:

| Field | Source |
|---|---|
| `slug` | Derived from file path |
| `updatedAt` | `git log -1` for the file |
| `source` | Set to `'git'` by the loader |
| `contentHash` | SHA-256 of frontmatter + body, truncated to 16 chars |

Adding any of those fields in frontmatter causes a hard build failure.

## Optional frontmatter

| Field | Type | Description |
|---|---|---|
| `order` | integer | Sort order within section/group. Default 1000. Use 10/20/30 increments. |
| `group` | string | Nav sub-group label within a section. Does not auto-derive from directory. |
| `related` | string[] | Slugs of related pages. Cross-audience escalation is stripped at registry build. |
| `tags` | string[] | Freeform tags for search (no effect on nav). |
| `unlisted` | boolean | Hides from nav; direct URL still works subject to audience gate. |
| `draft` | boolean | Excluded from registry entirely. Only appears in `npm run dev`. |

## Order conventions

Use 10-unit increments within a section: `order: 10`, `order: 20`, `order: 30`. Leave gaps for future inserts — a page inserted between 10 and 20 uses `order: 15`. Do not renumber existing pages unless the section is being substantially reorganized; renumbering creates unnecessary diff noise.

## Related-link rules

Related links are filtered at registry build time by the `relatedFor()` function:

1. **Dangling slug** — the linked page does not exist in the registry → stripped with a `logger.warn`.
2. **Cross-audience escalation** — a `public` page linking to an `org-admin` or `system-admin` page → stripped with a `logger.warn`. A page may only link to pages at the same or lower audience level.
3. The `audience` on the current page sets the ceiling for its related links.

This means: `system-admin` pages can link to `org-admin` or `public` pages; `org-admin` pages can link to `public` pages; `public` pages can only link to other `public` pages.

## Zod validation loop

Run the Zod gate locally before pushing:

```bash
npx tsx scripts/docs/build.ts
```

If a page has invalid frontmatter, the build fails with a message like:

```
[docs:build] Zod validation failed for content/docs/system-admin/new-page.md:
  audience: Invalid enum value. Expected 'public' | 'org-admin' | 'system-admin', received 'admin'
```

Fix the frontmatter, re-run, and confirm a clean exit.

The same gate runs as `npm run prebuild` before every production build. A CI build with a Zod failure does not deploy.

## Adding a new section

To add a section beyond the current 12:

1. Add the new `SectionId` to `src/lib/docs/types.ts` (the `SectionId` union type).
2. Add the new section to `SectionIdSchema` in `src/lib/docs/schema.ts`.
3. Add a `DocsSection` entry to `src/lib/docs/sections.ts` with `id`, `title`, `audience`, `order`, and optional `description`.
4. Update the `check` constraint in the `docs_pages` table migration (or apply a new migration) to include the new section value.
5. Run `mcp__supabase__generate_typescript_types` to regenerate `src/lib/types/database.ts`.

## Git vs. DB adapter

Two adapters contribute pages to the registry. The registry merges them with **DB wins on slug collision**.

| Adapter | Source | When to use |
|---|---|---|
| Git (`loadGitPages`) | `content/docs/**/*.md` compiled to `manifest.json` at build time | All permanent, reviewed documentation |
| DB (`loadDbPages`) | `docs_pages` table, `published = true` | Hot-patches during incidents; experimental content |

### Hot-patching a published page

When an incident requires updating a runbook without a full deploy:

1. Find the page's slug (e.g., `platform-runbooks/deployment-lifecycle`).
2. Insert or update the row in `docs_pages` with the corrected `body_markdown` and `published = true`. The DB row overrides the git page with the same slug.
3. Revalidate the cache:

   ```bash
   curl -X POST https://<production-host>/api/admin/docs/platform-runbooks%2Fdeployment-lifecycle/revalidate \
     -H "Cookie: <system-admin session cookie>"
   ```

   This busts `docs:db` (the page list cache) and `docs:db:body:platform-runbooks/deployment-lifecycle` (the body cache).
4. Verify the updated page renders correctly at `/docs/platform-runbooks/deployment-lifecycle`.
5. In the next PR after the incident resolves, update the git source to match the DB hot-patch, then delete the `docs_pages` row so the registry falls back to git.

### DB row precedence — what `docs.db_shadow` means

If the worker log shows `docs.db_shadow { slug: "..." }`, a DB row with that slug has overridden the matching git page. This is expected during a hot-patch. If it appears unexpectedly, check the `docs_pages` table for stale rows and delete them.

## Related

- [Feature flags](feature-flags) — progressive rollout of docs features to specific orgs
