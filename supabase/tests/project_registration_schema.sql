\set ON_ERROR_STOP on

begin;
select plan(8);

do $$
declare
  bucket_public boolean;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name in ('self_cash_ratio', 'self_in_kind_ratio', 'budget_composition_status')
  ) then
    raise exception 'removed ratio columns still exist';
  end if;

  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'projects'
        and column_name = 'assignment_number') <> 'NO' then
    raise exception 'assignment_number must be required';
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

select pass('removed columns, assignment requirement, privileges, bucket privacy, and policy absence are valid');
select ok((select relrowsecurity from pg_class where oid = 'public.project_documents'::regclass), 'project_documents RLS is enabled');
select is((select file_size_limit from storage.buckets where id = 'project-documents'), 20971520::bigint, 'bucket size limit is 20MB');
select is((select cardinality(allowed_mime_types) from storage.buckets where id = 'project-documents'), 11, 'bucket has exact canonical MIME count');

insert into public.companies (company_name, business_type, company_size, business_registration_number, founded_at, profile_status)
values ('Project Schema Company', 'sole_proprietor', 'small_enterprise', '5555555555', current_date, 'complete');

insert into public.projects (
  company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, self_cash_amount, self_in_kind_amount, self_contribution_amount,
  total_project_budget, assignment_number, assignment_name, manager_name, manager_email, profile_status
)
select id, 'Schema Project', 'Schema Host', current_date, current_date, 100, 20, 30, 50, 150,
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
  $$insert into public.projects (
      company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
      government_subsidy_amount, self_contribution_amount, total_project_budget,
      assignment_number, assignment_name, manager_name, manager_phone, profile_status
    ) select id, 'Duplicate', 'Host', current_date, current_date, 1, 0, 1,
      'SCHEMA-001', 'Duplicate Assignment', 'Manager', '010-0000-0000', 'complete'
      from public.companies where business_registration_number = '5555555555'$$,
  '23505', null, 'assignment number is unique within a company'
);
select * from finish();
rollback;
