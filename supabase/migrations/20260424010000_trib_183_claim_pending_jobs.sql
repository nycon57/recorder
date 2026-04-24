-- TRIB-183: Atomically claim pending worker jobs before execution.
--
-- The worker previously selected pending rows, then updated each row by id.
-- Two workers could select the same row before either update completed. This
-- function locks the ordered candidate set with SKIP LOCKED, marks only those
-- rows as processing, and returns exactly the rows won by the caller.

create or replace function public.claim_pending_jobs(
  p_batch_size integer,
  p_claimed_at timestamptz default now()
)
returns table (
  id uuid,
  type text,
  status text,
  payload jsonb,
  result jsonb,
  error text,
  attempts integer,
  max_attempts integer,
  run_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  dedupe_key text,
  created_at timestamptz,
  progress_percent integer,
  progress_message text,
  content_id uuid,
  priority integer,
  segments_completed integer,
  total_segments integer,
  parent_job_id uuid,
  content jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with locked_jobs as (
    select j.id
    from public.jobs as j
    where j.status = 'pending'
      and j.run_at <= p_claimed_at
    order by
      j.priority asc nulls last,
      j.run_at asc,
      j.created_at asc
    limit greatest(coalesce(p_batch_size, 0), 0)
    for update of j skip locked
  ),
  claimed_jobs as (
    update public.jobs as j
    set
      status = 'processing',
      started_at = p_claimed_at,
      progress_percent = 0,
      progress_message = 'Starting job...'
    from locked_jobs
    where j.id = locked_jobs.id
      and j.status = 'pending'
    returning j.*
  )
  select
    j.id,
    j.type,
    j.status,
    j.payload,
    j.result,
    j.error,
    j.attempts,
    j.max_attempts,
    j.run_at,
    j.started_at,
    j.completed_at,
    j.dedupe_key,
    j.created_at,
    j.progress_percent,
    j.progress_message,
    j.content_id,
    j.priority,
    j.segments_completed,
    j.total_segments,
    j.parent_job_id,
    case
      when c.id is null then null
      else jsonb_build_object(
        'id', c.id,
        'org_id', c.org_id,
        'title', c.title,
        'status', c.status,
        'content_type', c.content_type,
        'file_type', c.file_type,
        'storage_path_raw', c.storage_path_raw,
        'storage_path_processed', c.storage_path_processed,
        'file_size', c.file_size
      )
    end as content
  from claimed_jobs as j
  left join public.content as c on c.id = j.content_id
  order by
    j.priority asc nulls last,
    j.run_at asc,
    j.created_at asc;
$$;

comment on function public.claim_pending_jobs(integer, timestamptz) is
  'Atomically claims pending worker jobs using FOR UPDATE SKIP LOCKED and returns only rows won by the caller.';

revoke all on function public.claim_pending_jobs(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_pending_jobs(integer, timestamptz) to service_role;
