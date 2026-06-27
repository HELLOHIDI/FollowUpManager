\set ON_ERROR_STOP on

do $$
declare
  removed_column text;
begin
  foreach removed_column in array array[
    'business_region_sido',
    'business_region_sigungu',
    'business_address_detail',
    'business_condition',
    'business_type_detail'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'companies'
        and column_name = removed_column
    ) then
      raise exception 'removed companies column still exists: %', removed_column;
    end if;
  end loop;

  if (
    select column_default is not null
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'profile_status'
  ) then
    raise exception 'companies.profile_status must not have a default';
  end if;
end
$$;

do $$
declare
  corporate_definition text;
  founded_definition text;
  profile_definition text;
  consistency_definition text;
begin
  select pg_get_constraintdef(oid)
    into corporate_definition
  from pg_constraint
  where conrelid = 'public.companies'::regclass
    and conname = 'companies_corporate_registration_number_check';

  select pg_get_constraintdef(oid)
    into founded_definition
  from pg_constraint
  where conrelid = 'public.companies'::regclass
    and conname = 'companies_founded_at_check';

  select pg_get_constraintdef(oid)
    into profile_definition
  from pg_constraint
  where conrelid = 'public.companies'::regclass
    and conname = 'companies_profile_status_check';

  select pg_get_constraintdef(oid)
    into consistency_definition
  from pg_constraint
  where conrelid = 'public.companies'::regclass
    and conname = 'companies_profile_status_consistency_check';

  if corporate_definition is null
    or corporate_definition not like '%{13}%'
    or corporate_definition not like '%sole_proprietor%'
  then
    raise exception 'unexpected corporate number constraint: %', corporate_definition;
  end if;

  if founded_definition is null or founded_definition not like '%Asia/Seoul%' then
    raise exception 'unexpected founded date constraint: %', founded_definition;
  end if;

  if profile_definition is null
    or profile_definition not like '%complete%'
    or profile_definition not like '%review_required%'
  then
    raise exception 'unexpected profile status constraint: %', profile_definition;
  end if;

  if consistency_definition is null or consistency_definition not like '%unknown%' then
    raise exception 'unexpected profile consistency constraint: %', consistency_definition;
  end if;
end
$$;

begin;

select plan(1);

do $$
begin
  if not has_table_privilege('authenticated', 'public.companies', 'SELECT') then
    raise exception 'authenticated must be able to select companies';
  end if;

  if has_table_privilege('authenticated', 'public.companies', 'INSERT')
    or has_table_privilege('authenticated', 'public.companies', 'UPDATE')
    or has_table_privilege('authenticated', 'public.companies', 'DELETE')
  then
    raise exception 'authenticated must not mutate companies directly';
  end if;

  if not has_table_privilege('service_role', 'public.companies', 'SELECT')
    or not has_table_privilege('service_role', 'public.companies', 'INSERT')
    or not has_table_privilege('service_role', 'public.companies', 'UPDATE')
    or not has_table_privilege('service_role', 'public.companies', 'DELETE')
  then
    raise exception 'service_role is missing required company privileges';
  end if;
end
$$;

insert into public.companies (
  company_name,
  business_type,
  company_size,
  business_registration_number,
  corporate_registration_number,
  founded_at,
  profile_status
) values
  ('Schema Corporation', 'corporation', 'small_enterprise', '1234567890', '1234567890123', current_date, 'complete'),
  ('Schema Proprietor', 'sole_proprietor', 'unknown', '0987654321', null, current_date, 'review_required');

do $$
begin
  begin
    insert into public.companies (
      company_name,
      business_type,
      company_size,
      business_registration_number,
      corporate_registration_number,
      founded_at,
      profile_status
    ) values (
      'Invalid Corporation',
      'corporation',
      'small_enterprise',
      '1111111111',
      '123',
      current_date,
      'complete'
    );
    raise exception 'short corporate registration number was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.companies (
      company_name,
      business_type,
      company_size,
      business_registration_number,
      corporate_registration_number,
      founded_at,
      profile_status
    ) values (
      'Invalid Status',
      'sole_proprietor',
      'unknown',
      '2222222222',
      null,
      current_date,
      'complete'
    );
    raise exception 'inconsistent profile status was accepted';
  exception
    when check_violation then null;
  end;
end
$$;

select pass('company registration schema and constraints are valid');
select * from finish();

rollback;
