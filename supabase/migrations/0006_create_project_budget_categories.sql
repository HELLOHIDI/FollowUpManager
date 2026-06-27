-- Migration: create project budget categories

create table if not exists public.project_budget_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category_key text not null references public.budget_category_policy_templates(category_key),
  budget_amount bigint not null default 0 check (budget_amount >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_budget_categories_project_category_unique
    unique (project_id, category_key),
  constraint project_budget_categories_id_project_category_unique
    unique (id, project_id, category_key)
);

create index if not exists project_budget_categories_project_id_idx
  on public.project_budget_categories(project_id);

create index if not exists project_budget_categories_category_key_idx
  on public.project_budget_categories(category_key);

create index if not exists project_budget_categories_deleted_at_idx
  on public.project_budget_categories(deleted_at);

create trigger project_budget_categories_set_updated_at
before update on public.project_budget_categories
for each row
execute function public.set_updated_at();

alter table public.project_budget_categories enable row level security;

create policy "Authenticated users can read project budget categories"
on public.project_budget_categories
for select
to authenticated
using (true);

create policy "Authenticated users can insert project budget categories"
on public.project_budget_categories
for insert
to authenticated
with check (true);

create policy "Authenticated users can update project budget categories"
on public.project_budget_categories
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete project budget categories"
on public.project_budget_categories
for delete
to authenticated
using (true);

comment on table public.project_budget_categories is
  'Project-specific budget plan and category classification basis.';
