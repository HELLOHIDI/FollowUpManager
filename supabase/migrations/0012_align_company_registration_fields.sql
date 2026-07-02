-- Migration: align companies with the minimum operational registration contract

do $$
declare
  required_constraint text;
begin
  if exists (select 1 from public.companies) then
    raise exception using
      errcode = 'P0001',
      message = 'companies contains rows; migrate existing company data before applying 0012';
  end if;

  foreach required_constraint in array array[
    'companies_corporate_registration_number_check',
    'companies_profile_status_check',
    'companies_founded_at_check'
  ]
  loop
    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.companies'::regclass
        and conname = required_constraint
        and contype = 'c'
    ) then
      raise exception using
        errcode = 'P0001',
        message = format('required companies constraint is missing: %s', required_constraint);
    end if;
  end loop;
end
$$;

alter table public.companies
  drop column business_region_sido,
  drop column business_region_sigungu,
  drop column business_address_detail,
  drop column business_condition,
  drop column business_type_detail;

alter table public.companies
  drop constraint companies_corporate_registration_number_check,
  drop constraint companies_profile_status_check,
  drop constraint companies_founded_at_check,
  alter column profile_status drop default;

alter table public.companies
  add constraint companies_corporate_registration_number_check
    check (
      (business_type = 'corporation'
        and corporate_registration_number ~ '^[0-9]{13}$')
      or
      (business_type = 'sole_proprietor'
        and corporate_registration_number is null)
    ),
  add constraint companies_profile_status_check
    check (profile_status in ('complete', 'review_required')),
  add constraint companies_profile_status_consistency_check
    check (
      (company_size = 'unknown' and profile_status = 'review_required')
      or
      (company_size <> 'unknown' and profile_status = 'complete')
    ),
  add constraint companies_founded_at_check
    check (founded_at <= (now() at time zone 'Asia/Seoul')::date);

comment on table public.companies is
  'Top-level FuManager company registration record using the six-field MVP contract.';
