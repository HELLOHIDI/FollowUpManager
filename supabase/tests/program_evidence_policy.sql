begin;

select plan(8);

select ok(
  exists(select 1 from storage.buckets where id = 'program-policy-documents' and public = false),
  'program policy documents bucket is private'
);

insert into public.companies (
  id,
  company_name,
  business_type,
  company_size,
  business_registration_number,
  corporate_registration_number,
  founded_at,
  profile_status
) values (
  '10000000-0000-0000-0000-000000000001',
  'Policy Test Company',
  'corporation',
  'small_enterprise',
  '1234567890',
  '1234567890123',
  '2024-01-01',
  'complete'
);

insert into public.projects (
  id,
  company_id,
  project_name,
  host_institution,
  agreement_start_date,
  agreement_end_date,
  government_subsidy_amount,
  self_cash_amount,
  self_in_kind_amount,
  self_contribution_amount,
  total_project_budget,
  assignment_number,
  assignment_name,
  manager_name,
  manager_email,
  manager_phone,
  profile_status
) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Policy Test Project',
  'Institution',
  '2026-01-01',
  '2026-12-31',
  1000000,
  100000,
  0,
  100000,
  1100000,
  'POLICY-1',
  'Policy Test Assignment',
  'Manager',
  'manager@example.com',
  null,
  'complete'
);

insert into public.program_policy_versions (
  id,
  project_id,
  version_number,
  status,
  operation_status,
  extraction_status,
  confirmed_by,
  confirmed_at,
  confirmed_summary
) values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  1,
  'confirmed',
  'confirmed_policy',
  'succeeded',
  '2a9d9ca7-50b5-4f59-bd52-a65cc8c9756e',
  now(),
  '{"categoryCount":1,"subcategoryCount":0,"evidenceRequirementCount":1}'::jsonb
);

select throws_ok(
  $$
  update public.program_policy_versions
  set version_number = 2
  where id = '30000000-0000-0000-0000-000000000001'
  $$,
  'P0001',
  'confirmed or archived program policy versions are immutable',
  'confirmed policy version cannot be mutated'
);

select throws_ok(
  $$
  insert into public.program_policy_categories (
    policy_version_id,
    category_key,
    category_name,
    review_status
  ) values (
    '30000000-0000-0000-0000-000000000001',
    'material_cost',
    'Material cost',
    'auto_confident'
  )
  $$,
  'P0001',
  'confirmed or archived program policy child rows are immutable',
  'confirmed policy child rows cannot be inserted'
);

update public.program_policy_versions
set
  archived_at = now(),
  status = 'archived'
where id = '30000000-0000-0000-0000-000000000001';

select throws_ok(
  $$
  update public.program_policy_versions
  set version_number = 3
  where id = '30000000-0000-0000-0000-000000000001'
  $$,
  'P0001',
  'confirmed or archived program policy versions are immutable',
  'archived policy version remains immutable'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'program_policy_versions'
      and policyname = 'Authenticated users can manage program policy versions'
  ),
  'authenticated app path has a policy table RLS policy'
);

select ok(
  has_function_privilege('authenticated', 'public.confirm_program_policy_version(uuid, uuid, uuid, jsonb)', 'EXECUTE'),
  'authenticated app path can execute atomic policy confirmation'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'policy_snapshot'
  ),
  'expenses have policy snapshot column'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'confirmed_policy_version_id'
  ),
  'projects reference the confirmed policy version'
);

select * from finish();

rollback;
