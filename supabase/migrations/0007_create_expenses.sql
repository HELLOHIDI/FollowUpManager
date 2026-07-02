-- Migration: create expenses table

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  project_budget_category_id uuid not null,
  category_key text not null,

  title text not null check (btrim(title) <> ''),
  stage_key text not null default 'sales_completed'
    check (stage_key in (
      'sales_completed',
      'pre_approval',
      'execution_in_progress',
      'execution_request'
    )),

  expected_amount bigint check (expected_amount is null or expected_amount >= 0),
  approved_amount bigint check (approved_amount is null or approved_amount >= 0),
  contract_amount bigint check (contract_amount is null or contract_amount >= 0),
  final_amount bigint check (final_amount is null or final_amount >= 0),

  expected_spend_date date,
  execution_request_date date,

  vendor_name text,
  memo text,

  pre_approval_status text
    check (
      pre_approval_status is null
      or pre_approval_status in (
        'not_required',
        'required',
        'requested',
        'approved',
        'rejected',
        'needs_review'
      )
    ),
  execution_progress_status text
    check (
      execution_progress_status is null
      or execution_progress_status in (
        'not_started',
        'in_progress',
        'delayed',
        'completed',
        'needs_review'
      )
    ),
  execution_request_status text
    check (
      execution_request_status is null
      or execution_request_status in (
        'draft',
        'ready_to_submit',
        'submitted',
        'needs_supplement',
        'completed'
      )
    ),

  stage_fields jsonb not null default '{}'::jsonb
    check (jsonb_typeof(stage_fields) = 'object'),

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expenses_project_budget_category_match_fk
    foreign key (project_budget_category_id, project_id, category_key)
    references public.project_budget_categories(id, project_id, category_key)
    on delete restrict
);

create index if not exists expenses_project_id_idx
  on public.expenses(project_id);

create index if not exists expenses_project_budget_category_id_idx
  on public.expenses(project_budget_category_id);

create index if not exists expenses_project_category_idx
  on public.expenses(project_id, category_key);

create index if not exists expenses_project_stage_idx
  on public.expenses(project_id, stage_key);

create index if not exists expenses_deleted_at_idx
  on public.expenses(deleted_at);

create trigger expenses_set_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy "Authenticated users can read expenses"
on public.expenses
for select
to authenticated
using (true);

create policy "Authenticated users can insert expenses"
on public.expenses
for insert
to authenticated
with check (true);

create policy "Authenticated users can update expenses"
on public.expenses
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete expenses"
on public.expenses
for delete
to authenticated
using (true);

comment on table public.expenses is
  'Actual FuManager execution and management unit for a project.';
