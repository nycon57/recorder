create type public.vendor_source_kind as enum (
  'documentation',
  'developer_docs',
  'help_center',
  'api_reference',
  'release_notes',
  'mcp_snapshot'
);

create type public.vendor_fetch_strategy as enum (
  'markdown_export',
  'llms_txt',
  'static_site',
  'official_mcp_snapshot',
  'sanctioned_crawl'
);

create type public.vendor_terms_review_status as enum (
  'pending',
  'approved',
  'restricted',
  'rejected'
);

create table public.vendor_doc_sources (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  source_kind public.vendor_source_kind not null,
  source_url text not null,
  publisher_hostname text not null,
  official_source boolean not null default true check (official_source = true),
  fetch_strategy public.vendor_fetch_strategy not null,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  content_hash text,
  freshness_target interval not null default interval '7 days',
  version_band text[] not null default '{}'::text[],
  plan_band text[] not null default '{}'::text[],
  applicability jsonb not null default '{}'::jsonb,
  terms_review_status public.vendor_terms_review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_doc_sources_app_source_url_key unique (app, source_url),
  constraint vendor_doc_sources_source_url_https check (source_url ~ '^https://')
);

comment on table public.vendor_doc_sources is
  'Registry of official vendor-published documentation sources for the shared vendor knowledge corpus.';
comment on column public.vendor_doc_sources.publisher_hostname is
  'Normalized vendor-owned hostname root used by the service layer to enforce official-source-only ingestion.';
comment on column public.vendor_doc_sources.official_source is
  'Hard-locked to TRUE for the internal shared corpus. Non-official community sources are out of scope.';
comment on column public.vendor_doc_sources.freshness_target is
  'Desired recrawl interval for freshness checks.';
comment on column public.vendor_doc_sources.applicability is
  'JSON policy metadata for applicability such as legacy page ids, supported screens, or rollout notes.';

create index vendor_doc_sources_app_idx
  on public.vendor_doc_sources (app);

create index vendor_doc_sources_last_attempt_idx
  on public.vendor_doc_sources (last_attempt_at desc nulls last);

create index vendor_doc_sources_last_success_idx
  on public.vendor_doc_sources (last_success_at desc nulls last);

alter table public.vendor_wiki_pages
  add column if not exists vendor_source_id uuid references public.vendor_doc_sources(id) on delete set null;

comment on column public.vendor_wiki_pages.vendor_source_id is
  'Nullable compatibility bridge to the shared vendor source registry during migration from legacy app+screen pages.';

create index if not exists vendor_wiki_pages_vendor_source_id_idx
  on public.vendor_wiki_pages (vendor_source_id);
