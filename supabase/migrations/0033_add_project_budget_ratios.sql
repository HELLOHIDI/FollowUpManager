alter table public.projects
  add column government_subsidy_ratio numeric(5, 2),
  add column self_cash_ratio numeric(5, 2),
  add column self_in_kind_ratio numeric(5, 2);

with ratio_source as (
  select
    id,
    case when total_project_budget > 0 then round(government_subsidy_amount::numeric * 100 / total_project_budget, 2) else 100 end as subsidy_ratio,
    case when total_project_budget > 0 then round(self_cash_amount::numeric * 100 / total_project_budget, 2) else 0 end as cash_ratio
  from public.projects
)
update public.projects projects
set
  government_subsidy_ratio = ratio_source.subsidy_ratio,
  self_cash_ratio = ratio_source.cash_ratio,
  self_in_kind_ratio = 100 - ratio_source.subsidy_ratio - ratio_source.cash_ratio
from ratio_source
where projects.id = ratio_source.id;

alter table public.projects
  alter column government_subsidy_ratio set not null,
  alter column government_subsidy_ratio set default 100,
  alter column self_cash_ratio set not null,
  alter column self_cash_ratio set default 0,
  alter column self_in_kind_ratio set not null,
  alter column self_in_kind_ratio set default 0,
  add constraint projects_budget_ratio_range_check
    check (
      government_subsidy_ratio between 0 and 100
      and self_cash_ratio between 0 and 100
      and self_in_kind_ratio between 0 and 100
    ),
  add constraint projects_budget_ratio_total_check
    check (government_subsidy_ratio + self_cash_ratio + self_in_kind_ratio = 100);
