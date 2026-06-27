-- Migration: seed project budget categories from active policy templates

create or replace function public.budget_category_sort_order(category_key text)
returns integer
language sql
immutable
as $$
  select case category_key
    when 'material_cost' then 1
    when 'outsourcing_cost' then 2
    when 'equipment_software' then 3
    when 'intangible_asset_ip' then 4
    when 'labor_cost' then 5
    when 'service_fee' then 6
    when 'travel_expense' then 7
    when 'training_cost' then 8
    when 'advertising_cost' then 9
    else 999
  end;
$$;

create or replace function public.seed_project_budget_categories(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_budget_categories (project_id, category_key, sort_order)
  select
    target_project_id,
    templates.category_key,
    templates.sort_order
  from (
    select
      category_key,
      row_number() over (
        order by public.budget_category_sort_order(category_key), category_key
      ) - 1 as sort_order
    from public.budget_category_policy_templates
    where is_active = true
  ) templates
  on conflict (project_id, category_key) do nothing;
end;
$$;

create or replace function public.projects_seed_budget_categories_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_project_budget_categories(new.id);
  return new;
end;
$$;

drop trigger if exists projects_seed_budget_categories on public.projects;
create trigger projects_seed_budget_categories
after insert on public.projects
for each row
execute function public.projects_seed_budget_categories_trigger();

insert into public.project_budget_categories (project_id, category_key, sort_order)
select
  project_rows.id,
  templates.category_key,
  templates.sort_order
from public.projects project_rows
cross join (
  select
    category_key,
    row_number() over (
      order by public.budget_category_sort_order(category_key), category_key
    ) - 1 as sort_order
  from public.budget_category_policy_templates
  where is_active = true
) templates
left join public.project_budget_categories existing
  on existing.project_id = project_rows.id
 and existing.category_key = templates.category_key
where project_rows.deleted_at is null
  and existing.id is null;
