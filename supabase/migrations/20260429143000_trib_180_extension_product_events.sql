-- TRIB-180: Privacy-safe product telemetry for extension sessions and turns.
--
-- This table intentionally stores product facts only. Raw transcript text,
-- assistant answers, page text/summaries, screenshots, and arbitrary tool
-- result text are rejected at the API boundary and have no columns here.

create table if not exists public.extension_product_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid null,
  auth_method text not null check (auth_method in ('session', 'api_key')),
  session_id text null,
  conversation_id text null,
  turn_id text null,
  event_id text not null,
  event_type text not null,
  seq integer null check (seq is null or seq >= 0),
  occurred_at timestamptz not null,
  url_host text null,
  url_path text null,
  app text null,
  screen text null,
  knowledge_mode text null,
  vendor_match_basis text null,
  org_match_basis text null,
  vendor_match_category text null,
  org_match_category text null,
  latency_ms integer null check (latency_ms is null or latency_ms >= 0),
  source_count integer null check (source_count is null or source_count >= 0),
  source_kinds text[] null,
  outcome text null,
  error_code text null,
  error_category text null,
  message_direction text null check (
    message_direction is null
    or message_direction in ('user', 'assistant', 'system')
  ),
  message_length integer null check (
    message_length is null or message_length >= 0
  ),
  tool_name text null,
  action text null,
  selector_present boolean null,
  input_text_length integer null check (
    input_text_length is null or input_text_length >= 0
  ),
  output_text_length integer null check (
    output_text_length is null or output_text_length >= 0
  ),
  fingerprint text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint extension_product_events_event_id_key unique (event_id),
  constraint extension_product_events_session_seq_key unique (session_id, seq)
);

create index if not exists idx_extension_product_events_org_time
  on public.extension_product_events (org_id, occurred_at desc);

create index if not exists idx_extension_product_events_session_seq
  on public.extension_product_events (session_id, seq);

create index if not exists idx_extension_product_events_type_time
  on public.extension_product_events (event_type, occurred_at desc);

create index if not exists idx_extension_product_events_conversation_turn
  on public.extension_product_events (conversation_id, turn_id);

create index if not exists idx_extension_product_events_event_id
  on public.extension_product_events (event_id);

alter table public.extension_product_events enable row level security;

comment on table public.extension_product_events is
  'Privacy-safe extension product telemetry. Does not store raw transcript, assistant answer, page text, screenshots, or raw tool results.';
