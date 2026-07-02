-- Migration: create companies table

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),

  company_name text not null check (btrim(company_name) <> ''),
  business_type text not null
    check (business_type in ('corporation', 'sole_proprietor')),
  company_size text not null
    check (company_size in (
      'medium_enterprise',
      'small_enterprise',
      'micro_business',
      'unknown'
    )),

  business_region_sido text not null check (btrim(business_region_sido) <> ''),
  business_region_sigungu text not null check (btrim(business_region_sigungu) <> ''),
  business_address_detail text,

  business_condition text not null check (btrim(business_condition) <> ''),
  business_type_detail text not null check (btrim(business_type_detail) <> ''),

  business_registration_number text not null unique
    check (business_registration_number ~ '^[0-9]{10}$'),
  corporate_registration_number text
    check (
      corporate_registration_number is null
      or corporate_registration_number ~ '^[0-9]+$'
    ),

  founded_at date not null check (founded_at <= current_date),
  profile_status text not null default 'incomplete'
    check (profile_status in (
      'complete',
      'incomplete',
      'review_required',
      'invalid'
    )),

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_deleted_at_idx
  on public.companies(deleted_at);

create trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

alter table public.companies enable row level security;

create policy "Authenticated users can read companies"
on public.companies
for select
to authenticated
using (true);

create policy "Authenticated users can insert companies"
on public.companies
for insert
to authenticated
with check (true);

create policy "Authenticated users can update companies"
on public.companies
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete companies"
on public.companies
for delete
to authenticated
using (true);

comment on table public.companies is
  'Top-level FuManager management subject for projects, expenses, and evidence.';
