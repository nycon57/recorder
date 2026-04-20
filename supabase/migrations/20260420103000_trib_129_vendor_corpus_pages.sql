create table public.vendor_corpus_pages (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  screen text,
  title text not null,
  normalized_content text not null,
  content_excerpt text not null,
  source_url text,
  vendor_page_id uuid references public.vendor_wiki_pages(id) on delete cascade,
  vendor_source_id uuid references public.vendor_doc_sources(id) on delete set null,
  content_hash text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_corpus_pages_vendor_page_id_key unique (vendor_page_id)
);

comment on table public.vendor_corpus_pages is
  'Normalized shared vendor corpus derived from legacy vendor_wiki_pages for compatibility-safe semantic retrieval.';
comment on column public.vendor_corpus_pages.vendor_page_id is
  'Compatibility bridge back to the legacy exact app+screen vendor_wiki_pages row while cutover remains in progress.';
comment on column public.vendor_corpus_pages.content_excerpt is
  'Collapsed excerpt used for lightweight hybrid ranking and embedding input construction.';

create index vendor_corpus_pages_app_idx
  on public.vendor_corpus_pages (app);

create index vendor_corpus_pages_app_screen_idx
  on public.vendor_corpus_pages (app, screen);

create index vendor_corpus_pages_vendor_source_idx
  on public.vendor_corpus_pages (vendor_source_id);

create index vendor_corpus_pages_embedding_idx
  on public.vendor_corpus_pages using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
