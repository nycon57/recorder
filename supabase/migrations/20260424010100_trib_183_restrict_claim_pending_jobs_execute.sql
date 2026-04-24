-- TRIB-183: Restrict job claiming RPC execution to the worker service role.

revoke all on function public.claim_pending_jobs(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_pending_jobs(integer, timestamptz) to service_role;
