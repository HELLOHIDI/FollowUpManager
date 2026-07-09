\set ON_ERROR_STOP on

begin;
select plan(9);

do $$
declare
  bucket_public boolean;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name = 'budget_composition_status'
  ) then
    raise exception 'removed budget composition status still exists';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name in ('government_subsidy_ratio', 'self_cash_ratio', 'self_in_kind_ratio')
      and is_nullable <> 'NO'
  ) then
    raise exception 'project budget ratio columns must be non-null';
  end if;

  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'projects'
        and column_name = 'assignment_number') <> 'YES' then
    raise exception 'assignment_number must be optional';
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'projects'
      and indexname = 'projects_company_assignment_number_unique'
  ) then
    raise exception 'assignment_number must not be unique';
  end if;

  if has_table_privilege('authenticated', 'public.project_documents', 'SELECT')
    or has_table_privilege('authenticated', 'public.project_documents', 'INSERT')
    or has_table_privilege('authenticated', 'public.project_documents', 'UPDATE')
    or has_table_privilege('authenticated', 'public.project_documents', 'DELETE') then
    raise exception 'authenticated must not access project_documents directly';
  end if;

  if not has_table_privilege('service_role', 'public.project_documents', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'service_role is missing project_documents privileges';
  end if;

  select public into bucket_public from storage.buckets where id = 'project-documents';
  if bucket_public is distinct from false then
    raise exception 'project-documents bucket must be private';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_documents'
  ) then
    raise exception 'project_documents must have no direct user policies';
  end if;
end
$$;

select pass('budget ratio columns, optional assignment number, privileges, bucket privacy, and policy absence are valid');
select ok((select relrowsecurity from pg_class where oid = 'public.project_documents'::regclass), 'project_documents RLS is enabled');
select is((select file_size_limit from storage.buckets where id = 'project-documents'), 20971520::bigint, 'bucket size limit is 20MB');
select is((select cardinality(allowed_mime_types) from storage.buckets where id = 'project-documents'), 11, 'bucket has exact canonical MIME count');

insert into public.companies (company_name, business_type, company_size, business_registration_number, founded_at, profile_status)
values ('Project Schema Company', 'sole_proprietor', 'small_enterprise', '5555555555', current_date, 'complete');

insert into public.projects (
  company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, government_subsidy_ratio, self_cash_amount, self_cash_ratio, self_in_kind_amount, self_in_kind_ratio, self_contribution_amount,
  total_project_budget, assignment_number, assignment_name, manager_name, manager_email, profile_status
)
select id, 'Schema Project', 'Schema Host', current_date, current_date, 100, 66.67, 20, 13.33, 30, 20, 50, 150,
  'SCHEMA-001', 'Schema Assignment', 'Manager', 'schema@example.com', 'complete'
from public.companies where business_registration_number = '5555555555';

select throws_ok(
  $$update public.projects set total_project_budget = 0 where assignment_number = 'SCHEMA-001'$$,
  '23514', null, 'zero or inconsistent total is rejected'
);
select throws_ok(
  $$update public.projects set government_subsidy_amount = 9007199254740991, total_project_budget = 9007199254741041 where assignment_number = 'SCHEMA-001'$$,
  '23514', null, 'unsafe total is rejected'
);
select throws_ok(
  $$update public.projects set manager_email = null, manager_phone = null where assignment_number = 'SCHEMA-001'$$,
  '23514', null, 'at least one manager contact is required'
);
select throws_ok(
  $$update public.projects set government_subsidy_ratio = 60, self_cash_ratio = 20, self_in_kind_ratio = 30 where assignment_number = 'SCHEMA-001'$$,
  '23514', null, 'budget ratios must total 100 percent'
);
select lives_ok(
  $$insert into public.projects (
      company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
      government_subsidy_amount, government_subsidy_ratio, self_contribution_amount, self_cash_ratio, self_in_kind_ratio, total_project_budget,
      assignment_number, assignment_name, manager_name, manager_phone, profile_status
    ) select id, 'Duplicate', 'Host', current_date, current_date, 1, 100, 0, 0, 0, 1,
      'SCHEMA-001', 'Duplicate Assignment', 'Manager', '010-0000-0000', 'complete'
      from public.companies where business_registration_number = '5555555555'$$,
  'assignment number does not block duplicates'
);
update public.projects
set deleted_at = now()
where assignment_number = 'SCHEMA-001';

insert into public.projects (
  company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, government_subsidy_ratio, self_contribution_amount, self_cash_ratio, self_in_kind_ratio, total_project_budget,
  assignment_number, assignment_name, manager_name, manager_phone, profile_status
)
select id, 'Recreated', 'Host', current_date, current_date, 1, 100, 0, 0, 0, 1,
  'SCHEMA-001', 'Recreated Assignment', 'Manager', '010-0000-0000', 'complete'
from public.companies
where business_registration_number = '5555555555';

select * from finish();
rollback;
