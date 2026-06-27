\set ON_ERROR_STOP on

begin;
select plan(25);

select has_column('public', 'expenses', 'amount', 'expenses has canonical amount');
select col_not_null('public', 'expenses', 'amount', 'canonical amount is required');
select has_check('public', 'expenses', 'expenses has amount/stage checks');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name in ('expected_amount', 'approved_amount', 'contract_amount', 'final_amount')), 0, 'legacy amount columns are absent');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'project_budget_categories' and column_name = 'budget_amount'), 0, 'active category budget is absent');

insert into public.companies (id, company_name, business_type, company_size, business_registration_number, founded_at, profile_status)
values ('10000000-0000-4000-8000-000000000001', 'Dashboard Company', 'sole_proprietor', 'small_enterprise', '7777777777', current_date, 'complete');
insert into public.projects (
  id, company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, self_cash_amount, self_in_kind_amount, self_contribution_amount,
  total_project_budget, assignment_number, assignment_name, manager_name, manager_email, profile_status
) values (
  '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Dashboard Project', 'Host', current_date, current_date,
  70, 10, 20, 30, 100, 'DASH-001', 'Dashboard Assignment', 'Manager', 'manager@example.com', 'complete'
);

select is(
  (select count(*)::integer from public.project_budget_categories where project_id = '10000000-0000-4000-8000-000000000002'),
  (select count(*)::integer from public.budget_category_policy_templates where is_active),
  'project categories are seeded from active templates'
);

select lives_ok($$
  with category as (
    select id as project_budget_category_id
    from public.project_budget_categories
    where project_id = '10000000-0000-4000-8000-000000000002'
      and category_key = 'material_cost'
  )
  insert into public.expenses (project_id, project_budget_category_id, category_key, title, stage_key, amount)
  select
    '10000000-0000-4000-8000-000000000002',
    category.project_budget_category_id,
    'material_cost',
    stages.title,
    stages.stage_key,
    stages.amount
  from category
  cross join (
    values
      ('Budget', 'budget_registration', 10),
      ('Approval', 'pre_approval', 20),
      ('Progress', 'execution_in_progress', 0),
      ('Request', 'execution_request', 30),
      ('Complete', 'execution_completed', 40)
  ) as stages(title, stage_key, amount)
$$, 'all five stages are accepted');
select throws_ok($$insert into public.expenses (project_id, project_budget_category_id, category_key, title, stage_key, amount) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'material_cost', 'Legacy', 'sales_completed', 1)$$, '23514', null, 'legacy stage is rejected');
select throws_ok($$insert into public.expenses (project_id, project_budget_category_id, category_key, title, stage_key, amount) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'material_cost', 'Unsafe', 'budget_registration', 9007199254740992)$$, '23514', null, 'unsafe amount is rejected');

select is((select actual_spent_amount from public.project_kpi_summary where project_id = '10000000-0000-4000-8000-000000000002'), 40::bigint, 'completed-only spend is authoritative');
select is((select remaining_budget_amount from public.project_kpi_summary where project_id = '10000000-0000-4000-8000-000000000002'), 60::bigint, 'remaining is not clamped');
select is((select spent_ratio from public.project_kpi_summary where project_id = '10000000-0000-4000-8000-000000000002'), 0.4::numeric, 'ratio uses total project budget');
select is((select expense_count from public.project_kpi_summary where project_id = '10000000-0000-4000-8000-000000000002'), 5, 'active expense count is exact');
select is((select expense_count from public.project_category_amount_summary where project_id = '10000000-0000-4000-8000-000000000002'), 5, 'category count equals children');
select is((select total_amount from public.project_category_amount_summary where project_id = '10000000-0000-4000-8000-000000000002'), 100::bigint, 'category total uses canonical amount');
select is((select category_name from public.project_category_amount_summary where project_id = '10000000-0000-4000-8000-000000000002'), '재료비', 'Korean policy name is projected');
select ok((public.get_project_dashboard_snapshot('10000000-0000-4000-8000-000000000002')->>'integrityCode') is null, 'snapshot is valid');
select is(jsonb_array_length(public.get_project_dashboard_snapshot('10000000-0000-4000-8000-000000000002')->'expenseRows'), 5, 'snapshot returns every active child');

select ok(not has_table_privilege('authenticated', 'public.expenses', 'INSERT, UPDATE, DELETE'), 'authenticated expense writes are revoked');
select ok(not has_table_privilege('authenticated', 'public.project_budget_categories', 'INSERT, UPDATE, DELETE'), 'authenticated category writes are revoked');
select ok(not has_table_privilege('authenticated', 'public.budget_category_policy_templates', 'INSERT, UPDATE, DELETE'), 'authenticated policy writes are revoked');
select ok(
  not exists (
    select 1 from pg_class relation,
      lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) privilege
    where relation.oid = 'public.project_budget_category_budget_archive'::regclass
      and privilege.grantee = 0 and privilege.privilege_type = 'SELECT'
  )
  and not has_table_privilege('anon', 'public.project_budget_category_budget_archive', 'SELECT')
  and not has_table_privilege('authenticated', 'public.project_budget_category_budget_archive', 'SELECT'),
  'archive is inaccessible to untrusted roles'
);
select ok((
  select language.lanname = 'sql' and procedure.provolatile = 's' and not procedure.prosecdef
  from pg_proc procedure join pg_language language on language.oid = procedure.prolang
  where procedure.oid = 'public.get_project_dashboard_snapshot(uuid)'::regprocedure
) and has_function_privilege('authenticated', 'public.get_project_dashboard_snapshot(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_project_dashboard_snapshot(uuid)', 'EXECUTE'),
  'snapshot function is SQL STABLE SECURITY INVOKER and scoped'
);
select throws_ok($$insert into public.expenses (project_id, project_budget_category_id, category_key, title, stage_key, amount) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'material_cost', 'Overflow', 'execution_completed', 70)$$, '23514', 'PROJECT_COMPLETED_SPEND_EXCEEDS_BUDGET', 'completed spend cannot exceed project budget');
select throws_ok($$update public.projects set government_subsidy_amount = 0, total_project_budget = 30 where id = '10000000-0000-4000-8000-000000000002'$$, '23514', 'PROJECT_BUDGET_BELOW_COMPLETED_SPEND', 'budget cannot be reduced below completed spend');

select * from finish();
rollback;
