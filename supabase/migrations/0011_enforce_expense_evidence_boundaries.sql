-- Migration: enforce evidence ownership and server-coordinated write boundaries

alter table public.expenses
  add constraint expenses_id_project_id_unique
  unique (id, project_id);

alter table public.expense_evidence_files
  add constraint expense_evidence_files_expense_project_fk
  foreign key (expense_id, project_id)
  references public.expenses(id, project_id)
  on delete cascade;

drop policy if exists "Authenticated users can insert companies"
  on public.companies;
drop policy if exists "Authenticated users can update companies"
  on public.companies;
drop policy if exists "Authenticated users can delete companies"
  on public.companies;

drop policy if exists "Authenticated users can insert projects"
  on public.projects;
drop policy if exists "Authenticated users can update projects"
  on public.projects;
drop policy if exists "Authenticated users can delete projects"
  on public.projects;

drop policy if exists "Authenticated users can insert budget category policy templates"
  on public.budget_category_policy_templates;
drop policy if exists "Authenticated users can update budget category policy templates"
  on public.budget_category_policy_templates;
drop policy if exists "Authenticated users can delete budget category policy templates"
  on public.budget_category_policy_templates;

drop policy if exists "Authenticated users can insert project budget categories"
  on public.project_budget_categories;
drop policy if exists "Authenticated users can update project budget categories"
  on public.project_budget_categories;
drop policy if exists "Authenticated users can delete project budget categories"
  on public.project_budget_categories;

drop policy if exists "Authenticated users can insert expenses"
  on public.expenses;
drop policy if exists "Authenticated users can update expenses"
  on public.expenses;
drop policy if exists "Authenticated users can delete expenses"
  on public.expenses;

drop policy if exists "Authenticated users can insert expense evidence files"
  on public.expense_evidence_files;
drop policy if exists "Authenticated users can update expense evidence files"
  on public.expense_evidence_files;
drop policy if exists "Authenticated users can delete expense evidence files"
  on public.expense_evidence_files;

drop policy if exists "Authenticated users can insert expense history events"
  on public.expense_history_events;
drop policy if exists "Authenticated users can update expense history events"
  on public.expense_history_events;
drop policy if exists "Authenticated users can delete expense history events"
  on public.expense_history_events;

drop policy if exists "Authenticated users can read expense evidence objects"
  on storage.objects;
drop policy if exists "Authenticated users can insert expense evidence objects"
  on storage.objects;
drop policy if exists "Authenticated users can update expense evidence objects"
  on storage.objects;
drop policy if exists "Authenticated users can delete expense evidence objects"
  on storage.objects;

comment on constraint expense_evidence_files_expense_project_fk
  on public.expense_evidence_files is
  'Prevents evidence metadata from referencing an expense owned by another project.';

