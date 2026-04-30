do $$
begin
  create type public.vendor_source_lifecycle as enum (
    'active',
    'paused',
    'retired'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.vendor_doc_sources
  add column if not exists lifecycle public.vendor_source_lifecycle not null default 'active',
  add column if not exists legal_reviewed_at timestamptz,
  add column if not exists legal_reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists legal_review_reference_url text,
  add column if not exists legal_review_notes text,
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by uuid references public.users(id) on delete set null,
  add column if not exists retirement_reason text,
  add column if not exists replacement_source_id uuid references public.vendor_doc_sources(id) on delete set null;

do $$
begin
  alter table public.vendor_doc_sources
    add constraint vendor_doc_sources_legal_review_reference_https
    check (
      legal_review_reference_url is null
      or legal_review_reference_url ~ '^https://'
    );
exception
  when duplicate_object then null;
end $$;

comment on column public.vendor_doc_sources.lifecycle is
  'Governed source lifecycle. Only active sources are syncable and queryable; paused blocks sync; retired preserves audit history.';
comment on column public.vendor_doc_sources.legal_reviewed_at is
  'Timestamp when a system admin last recorded legal or terms provenance for this source.';
comment on column public.vendor_doc_sources.legal_reviewed_by is
  'System-admin user who last recorded legal or terms provenance for this source.';
comment on column public.vendor_doc_sources.legal_review_reference_url is
  'Optional URL to legal or terms evidence used for the latest source review.';
comment on column public.vendor_doc_sources.legal_review_notes is
  'Internal notes for legal provenance and source-governance decisions.';
comment on column public.vendor_doc_sources.retired_at is
  'Soft-retirement timestamp. Retired sources are kept for audit and excluded from sync/read paths.';
comment on column public.vendor_doc_sources.retired_by is
  'System-admin user who retired this source.';
comment on column public.vendor_doc_sources.retirement_reason is
  'Required operator reason for source retirement.';
comment on column public.vendor_doc_sources.replacement_source_id is
  'Optional replacement source that supersedes this retired source.';

alter table public.vendor_wiki_pages
  add column if not exists last_seen_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by uuid references public.users(id) on delete set null,
  add column if not exists retirement_reason text;

comment on column public.vendor_wiki_pages.last_seen_at is
  'Timestamp when this source-scoped vendor page was last present in a complete sync manifest, even when content was unchanged.';
comment on column public.vendor_wiki_pages.retired_at is
  'Soft-retirement timestamp inherited from a retired vendor source or explicit governance action.';
comment on column public.vendor_wiki_pages.retired_by is
  'System-admin user who retired this page or its parent source.';
comment on column public.vendor_wiki_pages.retirement_reason is
  'Operator reason for hiding this page from read paths without deleting audit history.';

create index if not exists vendor_doc_sources_active_idx
  on public.vendor_doc_sources (app, source_url)
  where lifecycle = 'active' and retired_at is null;

create index if not exists vendor_wiki_pages_active_app_screen_idx
  on public.vendor_wiki_pages (app, screen, updated_at desc)
  where retired_at is null;

create index if not exists vendor_wiki_pages_active_source_url_idx
  on public.vendor_wiki_pages (vendor_source_id, source_url)
  where retired_at is null;

create or replace view public.vendor_wiki_page_counts as
select
  vendor_source_id,
  count(*)::integer as page_count
from public.vendor_wiki_pages
where vendor_source_id is not null
  and retired_at is null
group by vendor_source_id;
