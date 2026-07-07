alter table public.companies
  drop constraint if exists companies_business_registration_number_key;

create unique index if not exists companies_business_registration_number_active_unique
  on public.companies(business_registration_number)
  where deleted_at is null;

drop index if exists public.projects_company_assignment_number_unique;

create unique index if not exists projects_company_assignment_number_unique
  on public.projects(company_id, assignment_number)
  where assignment_number is not null and deleted_at is null;
