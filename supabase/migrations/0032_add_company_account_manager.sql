-- Migration: require one internal account manager per company

alter table public.companies
  add column if not exists account_manager text not null default '정현정',
  add constraint companies_account_manager_check
    check (account_manager in (
      '정현정',
      '박종열',
      '류희재',
      '허진석',
      '이영준',
      '주재형',
      '이정준'
    ));

comment on column public.companies.account_manager is
  'Internal fixed assignee responsible for one company on the projects home screen.';
