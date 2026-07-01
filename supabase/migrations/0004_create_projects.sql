-- Migration: create projects table

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,

  project_name text not null check (btrim(project_name) <> ''),
  host_institution text not null check (btrim(host_institution) <> ''),
  agreement_start_date date not null,
  agreement_end_date date not null,

  government_subsidy_amount bigint not null default 0
    check (government_subsidy_amount >= 0),
  self_cash_amount bigint not null default 0
    check (self_cash_amount >= 0),
  self_in_kind_amount bigint not null default 0
    check (self_in_kind_amount >= 0),
  self_contribution_amount bigint not null default 0
    check (self_contribution_amount >= 0),
  total_project_budget bigint not null default 0
    check (total_project_budget >= 0),

  self_cash_ratio numeric(6, 5) not null default 0.10000
    check (self_cash_ratio >= 0 and self_cash_ratio <= 1),
  self_in_kind_ratio numeric(6, 5) not null default 0.20000
    check (self_in_kind_ratio >= 0 and self_in_kind_ratio <= 1),
  budget_composition_status text not null default 'default_applied'
    check (budget_composition_status in (
      'default_applied',
      'custom_contribution_applied',
      'invalid'
    )),

  assignment_number text,
  assignment_name text not null check (btrim(assignment_name) <> ''),

  manager_name text not null check (btrim(manager_name) <> ''),
  manager_email text not null check (btrim(manager_email) <> ''),
  manager_phone text not null check (btrim(manager_phone) <> ''),

  project_notes text,
  profile_status text not null default 'incomplete'
    check (profile_status in (
      'complete',
      'incomplete',
      'invalid',
      'review_required'
    )),

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint projects_agreement_period_check
    check (agreement_end_date >= agreement_start_date),

  constraint projects_self_contribution_total_check
    check (self_contribution_amount = self_cash_amount + self_in_kind_amount),

  constraint projects_budget_total_check
    check (
      total_project_budget =
      government_subsidy_amount + self_cash_amount + self_in_kind_amount
    )
);

create unique index if not exists projects_company_assignment_number_unique
  on public.projects(company_id, assignment_number)
  where assignment_number is not null;

create unique index if not exists projects_id_company_id_unique
  on public.projects(id, company_id);

create index if not exists projects_company_id_idx
  on public.projects(company_id);

create index if not exists projects_deleted_at_idx
  on public.projects(deleted_at);

create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "Authenticated users can read projects"
on public.projects
for select
to authenticated
using (true);

create policy "Authenticated users can insert projects"
on public.projects
for insert
to authenticated
with check (true);

create policy "Authenticated users can update projects"
on public.projects
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete projects"
on public.projects
for delete
to authenticated
using (true);

comment on table public.projects is
  'FuManager project and agreement context owned by a company.';
