# Extension Technical Decisions

## TRIB-22 — Framework and Monorepo Architecture

### Decision 1: Extension Framework — WXT

**Chosen: WXT (https://wxt.dev)**

#### Alternatives Evaluated

| Option | Pros | Cons |
|--------|------|------|
| **WXT** | TypeScript-first, auto-manifest, HMR for all entry points, clean MV3 output, React support via module, cross-browser | Learning curve for WXT conventions |
| **Plasmo** | React-focused, large community, auto-manifest | Heavier runtime abstraction, CSUI injection model adds complexity, less transparent build output, hides permission control |
| **Raw MV3** | Maximum control, zero framework overhead | No HMR (painful for popup dev), manual manifest management, manual Vite/webpack config from scratch, no content script reload |

#### Rationale

Tribora's extension requires four entry points: a content script (DOM analysis, overlay), a service worker (auth, API relay), a React popup (status, login), and eventually an options page. WXT handles all four with HMR during development and outputs clean Manifest V3 artifacts with zero runtime overhead.

The Rowboat reference extension (`reference-repos/rowboat/.../chrome-extension/extension/`) is raw JavaScript with no build step — adequate for a simple page-capture tool but insufficient for Tribora's requirements (React popup, TypeScript content scripts, multiple interacting components, shared type package).

WXT gives us development velocity without sacrificing control:
- Permissions declared explicitly in `wxt.config.ts` manifest field
- Output is standard MV3 — `manifest.json` + individual JS bundles, no runtime wrapper
- `defineBackground`, `defineContentScript` are thin type-only helpers, not runtime abstractions

### Decision 2: Monorepo Structure — npm workspaces in existing repo

**Chosen: `packages/extension/` and `packages/shared/` inside the existing Tribora Next.js repo**

#### Alternatives Evaluated

| Option | Description | Decision |
|--------|-------------|----------|
| **npm workspaces in-repo** | `packages/` alongside `src/` in the same repo | **Chosen** |
| Separate repo for extension | New GitHub repo for the extension | Rejected — adds CI/CD complexity, makes `PageContext` sharing require npm publishing |
| pnpm/turborepo monorepo | Migrate to pnpm or add turborepo | Rejected — project uses npm (`package-lock.json`); adding pnpm breaks existing lockfile |

#### Rationale

The `PageContext` interface (defined in PRD Part 3 Component 1) must be shared between:
1. The extension content script (builds with WXT/Vite)
2. The Next.js backend API routes (`/api/extension/query`, `/api/extension/context`)

A shared types package (`@tribora/shared`) in the same repo is the simplest path — consumed via path aliases at build time with zero publishing overhead.

The existing repo uses npm exclusively (`package-lock.json` is tracked, scripts use `npm run`). npm workspaces is the correct tool, requiring only a `"workspaces": ["packages/*"]` field in the root `package.json`.

The Next.js app at repo root continues to deploy to Vercel unchanged — Vercel runs `next build` from root, which ignores `packages/extension/` entirely. The extension builds separately via `npm run build:extension`.

### How `PageContext` Is Shared

```
packages/shared/src/types.ts     ← defines PageContext interface
          ↓                              ↓
packages/extension/               src/app/api/extension/
  (WXT Vite build)                  (Next.js build)
  imports via                        imports via
  @tribora/shared path alias         @tribora/shared path alias
```

Both build tools resolve `@tribora/shared` to `packages/shared/src/index.ts` via:
- Root `tsconfig.json` paths field (TypeScript resolution)
- npm workspace symlink in `node_modules/@tribora/shared` (runtime resolution for Vite)

No compilation step is needed for `@tribora/shared` — it is consumed as TypeScript source directly by both build tools.
