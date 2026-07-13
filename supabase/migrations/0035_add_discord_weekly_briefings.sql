create table if not exists public.discord_manager_channels (
  account_manager text primary key check (account_manager in (
    U&'\C815\D604\C815', U&'\BC15\C885\C11D', U&'\B958\D76C\CC2C',
    U&'\D5C8\C9C4\C11D', U&'\C774\C601\C900', U&'\C8FC\C7AC\D658', U&'\C774\C815\C900'
  )),
  discord_channel_id text not null unique check (btrim(discord_channel_id) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_weekly_briefing_deliveries (
  id uuid primary key default gen_random_uuid(),
  seoul_week_key text not null,
  account_manager text not null check (account_manager in (
    U&'\C815\D604\C815', U&'\BC15\C885\C11D', U&'\B958\D76C\CC2C',
    U&'\D5C8\C9C4\C11D', U&'\C774\C601\C900', U&'\C8FC\C7AC\D658', U&'\C774\C815\C900'
  )),
  scope_key text not null check (scope_key = 'manager-empty' or scope_key like 'company:%'),
  company_id uuid references public.companies(id) on delete set null,
  kind text not null default 'scheduled' check (kind = 'scheduled'),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed', 'needs_review')),
  parent_message_id text,
  thread_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_message_count integer not null default 0 check (sent_message_count >= 0),
  message_chunks jsonb not null default '[]'::jsonb check (jsonb_typeof(message_chunks) = 'array'),
  claim_token uuid,
  lease_expires_at timestamptz,
  external_request_started_at timestamptz,
  external_request_step text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (seoul_week_key, account_manager, scope_key)
);

create index if not exists discord_weekly_briefing_deliveries_status_idx
  on public.discord_weekly_briefing_deliveries (status, seoul_week_key);

create table if not exists public.discord_briefing_test_deliveries (
  id uuid primary key default gen_random_uuid(),
  account_manager text not null check (account_manager in (
    U&'\C815\D604\C815', U&'\BC15\C885\C11D', U&'\B958\D76C\CC2C',
    U&'\D5C8\C9C4\C11D', U&'\C774\C601\C900', U&'\C8FC\C7AC\D658', U&'\C774\C815\C900'
  )),
  status text not null check (status in ('completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create or replace function public.claim_discord_weekly_briefing_delivery(
  p_seoul_week_key text,
  p_account_manager text,
  p_scope_key text,
  p_company_id uuid,
  p_message_chunks jsonb
)
returns table (
  id uuid,
  claim_token uuid,
  parent_message_id text,
  thread_id text,
  sent_message_count integer,
  message_chunks jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.discord_weekly_briefing_deliveries (
    seoul_week_key, account_manager, scope_key, company_id, message_chunks,
    claim_token, lease_expires_at
  ) values (
    p_seoul_week_key, p_account_manager, p_scope_key, p_company_id, p_message_chunks,
    gen_random_uuid(), now() + interval '5 minutes'
  ) on conflict (seoul_week_key, account_manager, scope_key) do nothing
  returning discord_weekly_briefing_deliveries.id, discord_weekly_briefing_deliveries.claim_token, discord_weekly_briefing_deliveries.parent_message_id,
    discord_weekly_briefing_deliveries.thread_id, discord_weekly_briefing_deliveries.sent_message_count,
    discord_weekly_briefing_deliveries.message_chunks;

  if found then return; end if;

  -- A worker may die after recording an external request but before it can
  -- checkpoint the Discord response.  Never retry that ambiguous request;
  -- make it visible to operators instead.
  update public.discord_weekly_briefing_deliveries
  set status = 'needs_review',
      last_error = coalesce(last_error, 'Discord request outcome is unknown; operator review is required.')
  where seoul_week_key = p_seoul_week_key and account_manager = p_account_manager and scope_key = p_scope_key
    and status = 'processing' and lease_expires_at < now() and external_request_started_at is not null;

  return query
  update public.discord_weekly_briefing_deliveries
  set status = 'processing', claim_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes',
      attempt_count = attempt_count + 1, last_error = null
  where seoul_week_key = p_seoul_week_key and account_manager = p_account_manager and scope_key = p_scope_key
    and (status = 'failed' or (status = 'processing' and lease_expires_at < now() and external_request_started_at is null))
  returning discord_weekly_briefing_deliveries.id, discord_weekly_briefing_deliveries.claim_token, discord_weekly_briefing_deliveries.parent_message_id,
    discord_weekly_briefing_deliveries.thread_id, discord_weekly_briefing_deliveries.sent_message_count,
    discord_weekly_briefing_deliveries.message_chunks;
end;
$$;

revoke execute on function public.claim_discord_weekly_briefing_delivery(text, text, text, uuid, jsonb) from public;
grant execute on function public.claim_discord_weekly_briefing_delivery(text, text, text, uuid, jsonb) to service_role;

create or replace function public.renew_discord_weekly_briefing_delivery_lease(
  p_delivery_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_renewed boolean;
begin
  update public.discord_weekly_briefing_deliveries
  set lease_expires_at = now() + interval '5 minutes'
  where id = p_delivery_id
    and claim_token = p_claim_token
    and status = 'processing'
    and lease_expires_at > now()
  returning true into v_renewed;

  return coalesce(v_renewed, false);
end;
$$;

revoke execute on function public.renew_discord_weekly_briefing_delivery_lease(uuid, uuid) from public;
grant execute on function public.renew_discord_weekly_briefing_delivery_lease(uuid, uuid) to service_role;

create trigger discord_manager_channels_set_updated_at
before update on public.discord_manager_channels
for each row execute function public.set_updated_at();

create trigger discord_weekly_briefing_deliveries_set_updated_at
before update on public.discord_weekly_briefing_deliveries
for each row execute function public.set_updated_at();

alter table public.discord_manager_channels enable row level security;
alter table public.discord_weekly_briefing_deliveries enable row level security;
alter table public.discord_briefing_test_deliveries enable row level security;

create policy "Authenticated users can manage Discord manager channels"
on public.discord_manager_channels for all to authenticated using (true) with check (true);

create policy "Authenticated users can read Discord briefing deliveries"
on public.discord_weekly_briefing_deliveries for select to authenticated using (true);

create policy "Authenticated users can read Discord briefing test deliveries"
on public.discord_briefing_test_deliveries for select to authenticated using (true);
