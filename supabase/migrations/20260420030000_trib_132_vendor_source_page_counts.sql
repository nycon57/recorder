create or replace view public.vendor_corpus_page_counts as
select
  vendor_source_id,
  count(*)::integer as page_count
from public.vendor_corpus_pages
where vendor_source_id is not null
group by vendor_source_id;

comment on view public.vendor_corpus_page_counts is
  'Per-vendor-source corpus page counts used by internal vendor ops surfaces without transferring raw corpus rows.';

create or replace view public.vendor_wiki_page_counts as
select
  vendor_source_id,
  count(*)::integer as page_count
from public.vendor_wiki_pages
where vendor_source_id is not null
group by vendor_source_id;

comment on view public.vendor_wiki_page_counts is
  'Per-vendor-source legacy vendor wiki page counts used for compatibility-aware internal ops visibility.';
