-- Migration: create dashboard aggregation views

create or replace view public.project_kpi_summary
with (security_invoker = true)
as
select
  p.id as project_id,
  p.company_id,
  p.project_name,
  p.total_project_budget,
  coalesce(
    sum(e.final_amount) filter (
      where e.stage_key = 'execution_request'
        and e.final_amount is not null
        and e.deleted_at is null
    ),
    0
  )::bigint as actual_spent_amount,
  coalesce(
    sum(e.expected_amount) filter (
      where e.expected_amount is not null
        and e.deleted_at is null
    ),
    0
  )::bigint as expected_amount,
  coalesce(
    sum(e.contract_amount) filter (
      where e.stage_key = 'execution_in_progress'
        and e.contract_amount is not null
        and e.deleted_at is null
    ),
    0
  )::bigint as in_progress_amount,
  count(e.id) filter (where e.deleted_at is null)::integer as expense_count,
  greatest(
    p.total_project_budget - coalesce(
      sum(e.final_amount) filter (
        where e.stage_key = 'execution_request'
          and e.final_amount is not null
          and e.deleted_at is null
      ),
      0
    ),
    0
  )::bigint as remaining_budget_amount,
  case
    when p.total_project_budget > 0 then
      round(
        (
          coalesce(
            sum(e.final_amount) filter (
              where e.stage_key = 'execution_request'
                and e.final_amount is not null
                and e.deleted_at is null
            ),
            0
          )::numeric / p.total_project_budget::numeric
        ),
        4
      )
    else 0
  end as spent_ratio
from public.projects p
left join public.expenses e
  on e.project_id = p.id
where p.deleted_at is null
group by p.id, p.company_id, p.project_name, p.total_project_budget;

create or replace view public.project_category_amount_summary
with (security_invoker = true)
as
select
  pbc.project_id,
  pbc.id as project_budget_category_id,
  pbc.category_key,
  pbc.budget_amount,
  pbc.sort_order,
  coalesce(
    sum(e.expected_amount) filter (
      where e.expected_amount is not null
        and e.deleted_at is null
    ),
    0
  )::bigint as expected_amount,
  coalesce(
    sum(e.final_amount) filter (
      where e.stage_key = 'execution_request'
        and e.final_amount is not null
        and e.deleted_at is null
    ),
    0
  )::bigint as actual_spent_amount,
  greatest(
    pbc.budget_amount - coalesce(
      sum(e.final_amount) filter (
        where e.stage_key = 'execution_request'
          and e.final_amount is not null
          and e.deleted_at is null
      ),
      0
    ),
    0
  )::bigint as remaining_budget_amount,
  count(e.id) filter (where e.deleted_at is null)::integer as expense_count
from public.project_budget_categories pbc
left join public.expenses e
  on e.project_budget_category_id = pbc.id
where pbc.deleted_at is null
group by pbc.project_id, pbc.id, pbc.category_key, pbc.budget_amount, pbc.sort_order;

create or replace view public.project_kanban_stage_summary
with (security_invoker = true)
as
select
  e.project_id,
  e.stage_key,
  count(e.id)::integer as expense_count,
  coalesce(sum(e.expected_amount), 0)::bigint as expected_amount,
  coalesce(sum(e.approved_amount), 0)::bigint as approved_amount,
  coalesce(sum(e.contract_amount), 0)::bigint as contract_amount,
  coalesce(sum(e.final_amount), 0)::bigint as final_amount,
  coalesce(
    sum(e.final_amount) filter (
      where e.stage_key = 'execution_request'
        and e.final_amount is not null
    ),
    0
  )::bigint as actual_spent_amount
from public.expenses e
where e.deleted_at is null
group by e.project_id, e.stage_key;

create or replace view public.project_expenses_by_category
with (security_invoker = true)
as
select
  e.project_id,
  e.category_key,
  e.project_budget_category_id,
  e.id as expense_id,
  e.title,
  e.stage_key,
  e.expected_amount,
  e.approved_amount,
  e.contract_amount,
  e.final_amount,
  e.expected_spend_date,
  e.execution_request_date,
  e.vendor_name,
  e.created_at,
  e.updated_at
from public.expenses e
where e.deleted_at is null;

create or replace view public.project_expenses_by_stage
with (security_invoker = true)
as
select
  e.project_id,
  e.stage_key,
  e.id as expense_id,
  e.title,
  e.category_key,
  e.project_budget_category_id,
  e.expected_amount,
  e.approved_amount,
  e.contract_amount,
  e.final_amount,
  e.expected_spend_date,
  e.execution_request_date,
  e.vendor_name,
  e.created_at,
  e.updated_at
from public.expenses e
where e.deleted_at is null;

grant select on public.project_kpi_summary to authenticated;
grant select on public.project_category_amount_summary to authenticated;
grant select on public.project_kanban_stage_summary to authenticated;
grant select on public.project_expenses_by_category to authenticated;
grant select on public.project_expenses_by_stage to authenticated;

comment on view public.project_kpi_summary is
  'Project dashboard KPI totals. Actual spent uses only execution_request final_amount.';

comment on view public.project_category_amount_summary is
  'Budget category dashboard totals per project.';

comment on view public.project_kanban_stage_summary is
  'Kanban stage counts and stage amount summaries per project.';

comment on view public.project_expenses_by_category is
  'Expense list projection for category-filtered project dashboard surfaces.';

comment on view public.project_expenses_by_stage is
  'Expense list projection for stage-filtered kanban dashboard surfaces.';
