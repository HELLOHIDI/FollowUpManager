-- Align the expense domain and expose the read-only Operation Dashboard Slice 1 snapshot.

begin;
set lock_timeout = '10s';

do $$
declare
  incompatible_count integer;
  incompatible_ids text;
begin
  select count(*), string_agg(id::text, ',' order by id)
  into incompatible_count, incompatible_ids
  from public.expenses
  where (
    select count(distinct value)
    from unnest(array[expected_amount, approved_amount, contract_amount, final_amount]) value
    where value is not null
  ) <> 1;

  if incompatible_count > 0 then
    raise exception 'expenses incompatible with canonical amount: count=%, ids=%',
      incompatible_count, incompatible_ids;
  end if;
end
$$;

drop view public.project_kpi_summary;
drop view public.project_category_amount_summary;
drop view public.project_kanban_stage_summary;
drop view public.project_expenses_by_category;
drop view public.project_expenses_by_stage;

alter table public.expenses add column amount bigint;

update public.expenses
set amount = coalesce(expected_amount, approved_amount, contract_amount, final_amount);

do $$
begin
  if exists (
    select 1 from public.expenses
    where amount is null or amount < 0 or amount > 9007199254740991
  ) then
    raise exception 'canonical expense amount backfill failed validation';
  end if;
end
$$;

alter table public.expenses drop constraint if exists expenses_stage_key_check;
update public.expenses set stage_key = 'budget_registration' where stage_key = 'sales_completed';

alter table public.expenses
  alter column amount set not null,
  add constraint expenses_amount_safe_check
    check (amount between 0 and 9007199254740991),
  add constraint expenses_stage_key_check
    check (stage_key in (
      'budget_registration',
      'pre_approval',
      'execution_in_progress',
      'execution_request',
      'execution_completed'
    )),
  drop column expected_amount,
  drop column approved_amount,
  drop column contract_amount,
  drop column final_amount;

revoke insert, update, delete on table public.expenses from authenticated;
revoke insert, update, delete on table public.project_budget_categories from authenticated;
revoke insert, update, delete on table public.budget_category_policy_templates from authenticated;
grant select on table public.expenses to authenticated;
grant select on table public.project_budget_categories to authenticated;
grant select on table public.budget_category_policy_templates to authenticated;
grant select on table public.projects to authenticated;
grant select, insert, update, delete on table public.expenses to service_role;
grant select, insert, update, delete on table public.project_budget_categories to service_role;
grant select, insert, update, delete on table public.budget_category_policy_templates to service_role;

lock table public.project_budget_categories in access exclusive mode;

create table public.project_budget_category_budget_archive (
  original_category_id uuid primary key,
  project_id uuid not null,
  category_key text not null,
  budget_amount bigint not null,
  source_created_at timestamptz not null,
  source_updated_at timestamptz not null,
  source_deleted_at timestamptz,
  migration_version text not null default '0015',
  archived_at timestamptz not null default transaction_timestamp()
);

revoke all on table public.project_budget_category_budget_archive from public, anon, authenticated;
grant select on table public.project_budget_category_budget_archive to service_role;

insert into public.project_budget_category_budget_archive (
  original_category_id,
  project_id,
  category_key,
  budget_amount,
  source_created_at,
  source_updated_at,
  source_deleted_at
)
select id, project_id, category_key, budget_amount, created_at, updated_at, deleted_at
from public.project_budget_categories;

do $$
begin
  if (select count(*) from public.project_budget_category_budget_archive)
      <> (select count(*) from public.project_budget_categories)
    or exists (
      select 1
      from public.project_budget_categories source
      left join public.project_budget_category_budget_archive archive
        on archive.original_category_id = source.id
      where archive.original_category_id is null
        or archive.project_id is distinct from source.project_id
        or archive.category_key is distinct from source.category_key
        or archive.budget_amount is distinct from source.budget_amount
        or archive.source_created_at is distinct from source.created_at
        or archive.source_updated_at is distinct from source.updated_at
        or archive.source_deleted_at is distinct from source.deleted_at
    ) then
    raise exception 'project category budget archive verification failed';
  end if;
end
$$;

alter table public.project_budget_categories drop column budget_amount;

update public.budget_category_policy_templates
set category_name = case category_key
  when 'material_cost' then '재료비'
  when 'outsourcing_cost' then '외주용역비'
  when 'equipment_software' then '장비·소프트웨어비'
  when 'intangible_asset_ip' then '무형자산·지식재산권비'
  when 'labor_cost' then '인건비'
  when 'service_fee' then '지급수수료'
  when 'travel_expense' then '여비교통비'
  when 'training_cost' then '교육훈련비'
  when 'advertising_cost' then '광고선전비'
end,
updated_at = now();

create view public.project_kpi_summary
with (security_invoker = true)
as
select
  p.id as project_id,
  p.company_id,
  p.project_name,
  p.total_project_budget,
  coalesce(sum(e.amount) filter (where e.stage_key = 'execution_completed' and e.deleted_at is null), 0)::bigint as actual_spent_amount,
  (p.total_project_budget - coalesce(sum(e.amount) filter (where e.stage_key = 'execution_completed' and e.deleted_at is null), 0))::bigint as remaining_budget_amount,
  case when p.total_project_budget > 0 then
    round(coalesce(sum(e.amount) filter (where e.stage_key = 'execution_completed' and e.deleted_at is null), 0)::numeric / p.total_project_budget::numeric, 6)
  else 0::numeric end as spent_ratio,
  count(e.id) filter (where e.deleted_at is null)::integer as expense_count
from public.projects p
left join public.expenses e on e.project_id = p.id
where p.deleted_at is null
group by p.id, p.company_id, p.project_name, p.total_project_budget;

create view public.project_category_amount_summary
with (security_invoker = true)
as
select
  e.project_id,
  e.project_budget_category_id,
  e.category_key,
  template.category_name,
  category.sort_order,
  count(e.id)::integer as expense_count,
  sum(e.amount)::bigint as total_amount,
  coalesce(sum(e.amount) filter (where e.stage_key = 'execution_completed'), 0)::bigint as actual_spent_amount
from public.expenses e
join public.project_budget_categories category
  on category.id = e.project_budget_category_id
  and category.deleted_at is null
  and category.is_active
join public.budget_category_policy_templates template
  on template.category_key = e.category_key
  and template.is_active
where e.deleted_at is null
group by e.project_id, e.project_budget_category_id, e.category_key, template.category_name, category.sort_order;

create view public.project_kanban_stage_summary
with (security_invoker = true)
as
select e.project_id, e.stage_key, count(e.id)::integer as expense_count,
  sum(e.amount)::bigint as total_amount,
  coalesce(sum(e.amount) filter (where e.stage_key = 'execution_completed'), 0)::bigint as actual_spent_amount
from public.expenses e
where e.deleted_at is null
group by e.project_id, e.stage_key;

create view public.project_expenses_by_category
with (security_invoker = true)
as
select e.project_id, e.category_key, template.category_name, category.sort_order,
  e.project_budget_category_id, e.id as expense_id, e.title, e.amount, e.stage_key,
  e.created_at, e.updated_at
from public.expenses e
join public.project_budget_categories category
  on category.id = e.project_budget_category_id
  and category.deleted_at is null
  and category.is_active
join public.budget_category_policy_templates template
  on template.category_key = e.category_key
  and template.is_active
where e.deleted_at is null;

create view public.project_expenses_by_stage
with (security_invoker = true)
as
select e.project_id, e.stage_key, e.id as expense_id, e.title, e.category_key,
  e.project_budget_category_id, e.amount, e.created_at, e.updated_at
from public.expenses e
where e.deleted_at is null;

grant select on public.project_kpi_summary to authenticated;
grant select on public.project_category_amount_summary to authenticated;
grant select on public.project_kanban_stage_summary to authenticated;
grant select on public.project_expenses_by_category to authenticated;
grant select on public.project_expenses_by_stage to authenticated;

create function public.enforce_project_completed_spend_cap()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_project_id uuid := coalesce(new.project_id, old.project_id);
  target_expense_id uuid := coalesce(new.id, old.id);
  budget bigint;
  completed_spend numeric;
begin
  select total_project_budget into budget
  from public.projects where id = target_project_id for update;

  select coalesce(sum(amount), 0) into completed_spend
  from public.expenses
  where project_id = target_project_id
    and id <> target_expense_id
    and deleted_at is null
    and stage_key = 'execution_completed';

  if tg_op <> 'DELETE'
    and new.deleted_at is null
    and new.stage_key = 'execution_completed' then
    completed_spend := completed_spend + new.amount;
  end if;

  if completed_spend > budget then
    raise exception using errcode = '23514', message = 'PROJECT_COMPLETED_SPEND_EXCEEDS_BUDGET';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function public.enforce_project_completed_spend_cap() from public, anon, authenticated;

create trigger expenses_enforce_project_completed_spend_cap
before insert or update or delete on public.expenses
for each row execute function public.enforce_project_completed_spend_cap();

create function public.enforce_project_budget_above_completed_spend()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  completed_spend numeric;
begin
  select coalesce(sum(amount), 0) into completed_spend
  from public.expenses
  where project_id = new.id
    and deleted_at is null
    and stage_key = 'execution_completed';
  if new.total_project_budget < completed_spend then
    raise exception using errcode = '23514', message = 'PROJECT_BUDGET_BELOW_COMPLETED_SPEND';
  end if;
  return new;
end
$$;

revoke all on function public.enforce_project_budget_above_completed_spend() from public, anon, authenticated;

create trigger projects_enforce_budget_above_completed_spend
before update of total_project_budget on public.projects
for each row execute function public.enforce_project_budget_above_completed_spend();

create function public.get_project_dashboard_snapshot(project_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with project_row as (
    select * from public.project_kpi_summary where project_kpi_summary.project_id = get_project_dashboard_snapshot.project_id
  ),
  active_expenses as (
    select count(*)::integer as count
    from public.expenses
    where expenses.project_id = get_project_dashboard_snapshot.project_id and deleted_at is null
  ),
  ordered_rows as (
    select * from public.project_expenses_by_category
    where project_expenses_by_category.project_id = get_project_dashboard_snapshot.project_id
    order by sort_order, category_key, created_at, expense_id
  )
  select case when not exists (select 1 from project_row) then
    jsonb_build_object('project', null, 'kpis', null, 'activeExpenseCount', 0, 'expenseRows', '[]'::jsonb, 'integrityCode', null)
  else jsonb_build_object(
    'project', (select jsonb_build_object('id', project_id, 'name', project_name) from project_row),
    'kpis', (select jsonb_build_object(
      'totalBudget', total_project_budget,
      'spentAmount', actual_spent_amount,
      'remainingAmount', remaining_budget_amount,
      'burnRatio', spent_ratio
    ) from project_row),
    'activeExpenseCount', (select count from active_expenses),
    'expenseRows', coalesce((select jsonb_agg(jsonb_build_object(
      'categoryKey', category_key,
      'categoryName', category_name,
      'categorySortOrder', sort_order,
      'id', expense_id,
      'title', title,
      'amount', amount,
      'stageKey', stage_key
    )) from ordered_rows), '[]'::jsonb),
    'integrityCode', case
      when (select remaining_budget_amount < 0 or spent_ratio > 1 from project_row) then 'INVALID_BUDGET_STATE'
      when (select count from active_expenses) <> (select count(*) from ordered_rows) then 'CATEGORY_METADATA_MISMATCH'
      else null
    end
  ) end;
$$;

revoke all on function public.get_project_dashboard_snapshot(uuid) from public, anon;
grant execute on function public.get_project_dashboard_snapshot(uuid) to authenticated, service_role;

comment on function public.get_project_dashboard_snapshot(uuid) is
  'One-statement, read-only Operation Dashboard Slice 1 snapshot.';
comment on table public.project_budget_category_budget_archive is
  'Non-authoritative 0015 recovery archive. Reverse conversion is safe only before five-stage-only writes; prefer backup restore or a forward fix.';

commit;
