-- Atomically increment API key usage metadata after successful validation.
create or replace function public.increment_api_key_usage_count(p_key_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.api_keys
  set
    usage_count = coalesce(usage_count, 0) + 1,
    last_used_at = now(),
    updated_at = now()
  where id = p_key_id;
end;
$$;

revoke all on function public.increment_api_key_usage_count(uuid) from public;
grant execute on function public.increment_api_key_usage_count(uuid) to service_role;
