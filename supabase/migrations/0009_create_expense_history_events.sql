-- Migration: create expense history events

create table if not exists public.expense_history_events (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,

  event_type text not null
    check (event_type in (
      'expense_created',
      'stage_changed',
      'category_changed',
      'amount_changed',
      'approval_status_changed',
      'execution_status_changed',
      'execution_request_status_changed',
      'evidence_uploaded',
      'evidence_deleted',
      'memo_updated',
      'stage_field_updated'
    )),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  summary text not null check (btrim(summary) <> ''),
  before_value jsonb,
  after_value jsonb,

  constraint expense_history_events_json_values_check
    check (
      (before_value is null or jsonb_typeof(before_value) = 'object')
      and (after_value is null or jsonb_typeof(after_value) = 'object')
    )
);

create index if not exists expense_history_events_expense_id_changed_at_idx
  on public.expense_history_events(expense_id, changed_at desc);

create index if not exists expense_history_events_event_type_idx
  on public.expense_history_events(event_type);

alter table public.expense_history_events enable row level security;

create policy "Authenticated users can read expense history events"
on public.expense_history_events
for select
to authenticated
using (true);

create policy "Authenticated users can insert expense history events"
on public.expense_history_events
for insert
to authenticated
with check (true);

create policy "Authenticated users can update expense history events"
on public.expense_history_events
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete expense history events"
on public.expense_history_events
for delete
to authenticated
using (true);

comment on table public.expense_history_events is
  'Operational timeline events for GrantFollow expenses.';
