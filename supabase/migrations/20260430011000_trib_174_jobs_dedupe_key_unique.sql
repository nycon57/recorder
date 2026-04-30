-- TRIB-174: make downstream worker enqueue idempotent at the database layer.
--
-- This intentionally fails if duplicate non-null dedupe keys already exist, so
-- production cleanup happens explicitly before the uniqueness contract is added.
do $$
begin
  if exists (
    select 1
    from jobs
    where dedupe_key is not null
    group by dedupe_key
    having count(*) > 1
  ) then
    raise exception 'Cannot create jobs_dedupe_key_unique: duplicate non-null jobs.dedupe_key values exist';
  end if;
end $$;

create unique index if not exists jobs_dedupe_key_unique
  on jobs (dedupe_key)
  where dedupe_key is not null;

create or replace function public.supersede_org_wiki_page(
  p_existing_page_id uuid,
  p_org_id uuid,
  p_app text,
  p_screen text,
  p_topic text,
  p_content text,
  p_confidence double precision,
  p_supersedes_id uuid,
  p_compilation_log jsonb,
  p_valid_until timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_page_id uuid;
  v_updated_count integer;
begin
  insert into public.org_wiki_pages (
    org_id,
    app,
    screen,
    topic,
    content,
    confidence,
    supersedes_id,
    compilation_log
  )
  values (
    p_org_id,
    p_app,
    p_screen,
    p_topic,
    p_content,
    p_confidence,
    p_supersedes_id,
    p_compilation_log
  )
  returning id into v_new_page_id;

  update public.org_wiki_pages
  set valid_until = p_valid_until
  where id = p_existing_page_id
    and valid_until is null;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception 'Could not supersede current org_wiki_pages row %', p_existing_page_id;
  end if;

  return v_new_page_id;
end;
$$;

revoke all on function public.supersede_org_wiki_page(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  double precision,
  uuid,
  jsonb,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.supersede_org_wiki_page(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  double precision,
  uuid,
  jsonb,
  timestamptz
) to service_role;
