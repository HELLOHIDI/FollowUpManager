create table public.project_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  scheduled_on date not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_schedules_project_scheduled_on_idx
  on public.project_schedules (project_id, scheduled_on);

create table public.discord_schedule_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.project_schedules(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  account_manager text not null,
  event_date date not null,
  notification_kind text not null check (notification_kind in ('d_minus_1', 'd_day')),
  message_content text not null check (btrim(message_content) <> ''),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed', 'needs_review')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claim_token uuid,
  lease_expires_at timestamptz,
  external_request_started_at timestamptz,
  external_request_step text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, event_date, notification_kind)
);

create index discord_schedule_reminder_deliveries_status_event_date_idx
  on public.discord_schedule_reminder_deliveries (status, event_date);

create index discord_schedule_reminder_deliveries_review_idx
  on public.discord_schedule_reminder_deliveries (updated_at desc)
  where status in ('failed', 'needs_review');

create or replace function public.claim_discord_schedule_reminder_delivery(
  p_schedule_id uuid,
  p_project_id uuid,
  p_company_id uuid,
  p_account_manager text,
  p_event_date date,
  p_notification_kind text,
  p_message_content text
)
returns table (
  id uuid,
  claim_token uuid,
  message_content text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.discord_schedule_reminder_deliveries (
    schedule_id, project_id, company_id, account_manager, event_date, notification_kind,
    message_content, claim_token, lease_expires_at
  ) values (
    p_schedule_id, p_project_id, p_company_id, p_account_manager, p_event_date, p_notification_kind,
    p_message_content, gen_random_uuid(), now() + interval '5 minutes'
  ) on conflict (schedule_id, event_date, notification_kind) do nothing
  returning discord_schedule_reminder_deliveries.id,
    discord_schedule_reminder_deliveries.claim_token,
    discord_schedule_reminder_deliveries.message_content;

  if found then return; end if;

  update public.discord_schedule_reminder_deliveries
  set status = 'needs_review',
      last_error = coalesce(last_error, 'Discord request outcome is unknown; operator review is required.')
  where schedule_id = p_schedule_id
    and event_date = p_event_date
    and notification_kind = p_notification_kind
    and status = 'processing'
    and lease_expires_at < now()
    and external_request_started_at is not null;

  return query
  update public.discord_schedule_reminder_deliveries
  set status = 'processing',
      claim_token = gen_random_uuid(),
      lease_expires_at = now() + interval '5 minutes',
      attempt_count = attempt_count + 1,
      last_error = null
  where schedule_id = p_schedule_id
    and event_date = p_event_date
    and notification_kind = p_notification_kind
    and (status = 'failed' or (status = 'processing' and lease_expires_at < now() and external_request_started_at is null))
  returning discord_schedule_reminder_deliveries.id,
    discord_schedule_reminder_deliveries.claim_token,
    discord_schedule_reminder_deliveries.message_content;
end;
$$;

create or replace function public.renew_discord_schedule_reminder_delivery_lease(
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
  update public.discord_schedule_reminder_deliveries
  set lease_expires_at = now() + interval '5 minutes'
  where id = p_delivery_id
    and claim_token = p_claim_token
    and status = 'processing'
    and lease_expires_at > now()
  returning true into v_renewed;

  return coalesce(v_renewed, false);
end;
$$;

create trigger project_schedules_set_updated_at
before update on public.project_schedules
for each row execute function public.set_updated_at();

create trigger discord_schedule_reminder_deliveries_set_updated_at
before update on public.discord_schedule_reminder_deliveries
for each row execute function public.set_updated_at();

alter table public.project_schedules enable row level security;
alter table public.discord_schedule_reminder_deliveries enable row level security;

create policy "Authenticated users can manage project schedules"
on public.project_schedules for all to authenticated using (true) with check (true);

create policy "Authenticated users can read Discord schedule reminder deliveries"
on public.discord_schedule_reminder_deliveries for select to authenticated using (true);

revoke execute on function public.claim_discord_schedule_reminder_delivery(uuid, uuid, uuid, text, date, text, text) from public;
grant execute on function public.claim_discord_schedule_reminder_delivery(uuid, uuid, uuid, text, date, text, text) to service_role;

revoke execute on function public.renew_discord_schedule_reminder_delivery_lease(uuid, uuid) from public;
grant execute on function public.renew_discord_schedule_reminder_delivery_lease(uuid, uuid) to service_role;
