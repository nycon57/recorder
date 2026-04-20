-- TRIB-146: Tighten RLS and add attribution columns to vendor_wiki_pages
--
-- Pre-migration audit (recorded in TRIB-146 Build Complete comment):
--   pg_policies WHERE tablename = 'vendor_wiki_pages' → [] (no existing policies)
--   relrowsecurity = false (RLS was fully disabled)
--
-- Changes:
--   1. Add curated_by (audit attribution) and ingest_job_id (job provenance)
--   2. Enable RLS on the table
--   3. Allow authenticated users to SELECT (read) — corpus is shared/readable
--   4. Restrict INSERT / UPDATE / DELETE to service_role only
--      (no authenticated policy → authenticated role cannot mutate)

-- 1. Attribution columns
alter table public.vendor_wiki_pages
  add column if not exists curated_by uuid
    references public.users(id) on delete set null,
  add column if not exists ingest_job_id uuid
    references public.jobs(id) on delete set null;

comment on column public.vendor_wiki_pages.curated_by is
  'System-admin user who last curated or approved this page (TRIB-146).';
comment on column public.vendor_wiki_pages.ingest_job_id is
  'Job that produced or last updated this page — used for ingestion audit provenance (TRIB-146).';

-- 2. Enable RLS
alter table public.vendor_wiki_pages enable row level security;

-- 3. SELECT open to authenticated users — shared corpus is readable
create policy "vendor_wiki_pages_select_authenticated"
  on public.vendor_wiki_pages
  for select
  to authenticated
  using (true);

-- INSERT / UPDATE / DELETE: no authenticated policy → service_role only
-- (service_role bypasses RLS; authenticated role gets no mutation grants)
