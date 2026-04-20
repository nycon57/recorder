# Demo Tenant Smoke Checklist

Manual checklist for an engineer to run after `npm run demo:seed` or `npm run demo:reset`.
Target: under 5 minutes for a complete pass.

Run `npm run demo:smoke -- --env=local` first for the automated assertions, then step
through this checklist for the UI surfaces the script cannot reach.

---

## Setup

Sign in at `http://localhost:3000` (or your staging URL). Use the magic-link flow
(no passwords seeded by default). All emails: `@demo.tribora.test`.

---

## As owner@demo.tribora.test (Dana Okafor — VP Customer Experience)

- [ ] **Dashboard loads** — recording count card shows ~30, wiki pages ~12, knowledge gaps ~4.
- [ ] **Library** — 30 recordings visible across 3 topical groups (onboarding, refund, integrations).
- [ ] **Knowledge → Wiki** — 12 wiki pages visible; at least 8 show "published" status.
- [ ] **Vendor admin** — `/vendor-admin` loads without empty-state; branding + knowledge-scope shows `[hubspot, zendesk, jira]`.
- [ ] **System admin** — `/admin` should load (owner is NOT system-admin by default; if it 404s or shows unauthorized, that is the expected behavior — document it). Only a user with `is_system_admin=true` can access `/admin`.

## As admin@demo.tribora.test (Priya Rangan — Head of Support Ops)

- [ ] **Dashboard** — recordings count, wiki pages, knowledge gaps all non-zero.
- [ ] **Wiki review** (`/admin/wiki-review` if accessible) — 4 unpublished pages visible for action.
- [ ] **Library** — all 30 recordings visible, can filter by tag (refund, onboarding, integration).
- [ ] **Search** — querying "refund" returns at least one wiki page or recording result.

## As lead@demo.tribora.test (Marcus Chen — Senior Support Engineer)

- [ ] **Dashboard** — "My recordings" count shows 18 (not 30).
- [ ] **Library** — all 30 org-scoped recordings visible; Marcus's 18 have his avatar/name.
- [ ] **Assistant** (`/assistant`) — asking "how do I process a partial refund in HubSpot?" returns results (keyword match; semantic ranking flat due to zero-vector embeddings).
- [ ] **Recording upload** — upload button is visible and enabled.

## As agent@demo.tribora.test (Sofía Alvarez — Support Agent)

- [ ] **Dashboard** — "My recordings" count shows 10.
- [ ] **Library** — org-scoped; her 10 recordings identifiable.
- [ ] **Recording upload** — upload button visible and enabled.
- [ ] **Wiki** — all 12 published wiki pages visible; edit is not available to contributor role.

## As reader@demo.tribora.test (Jordan Blake — New Hire)

- [ ] **Dashboard** — "My recordings" shows 0, "My contributions" shows 0.
- [ ] **Library** — can see all 30 org-scoped recordings (read-only).
- [ ] **Playback** — clicking a recording shows the expected 404/no-media message (R2 blobs not seeded — this is documented behavior, not a bug).
- [ ] **Recording upload** — upload button is absent or disabled for reader role.
- [ ] **Wiki** — published pages visible; cannot edit.

---

## System Admin checks (requires user with is_system_admin=true)

The demo roster does NOT include a system-admin user. If your local DB has one
from a prior migration or manual setup:

- [ ] `/admin` loads the system-admin panel.
- [ ] `/admin/vendor-sources` lists the seeded vendor demo org (`tribora-vendor-demo`).
- [ ] Acme Support Demo appears in the tenant list with `vendor_org_id` populated.

---

## Known limitations (not failures)

- **Playback 404s** — R2 audio/video blobs are not uploaded. `storage_path_r2` is a
  deterministic DB-only path. Playback will always 404. This is expected and documented.
- **Semantic search flat** — embeddings are zero-vectors. BM25/keyword search works;
  vector-ranked semantic results are flat. Run `npm run demo:reembed` (follow-up ticket)
  for real vectors.
- **Email magic links** — seeded emails are `@demo.tribora.test`. Magic links require
  a working Resend integration. For local testing, check your email logs or use the
  Supabase admin panel to inspect the `verification_tokens` table.
- **System-admin panel** — no demo user has `is_system_admin=true`. The owner can
  access vendor-admin routes but not the system-wide `/admin/*` panel.
