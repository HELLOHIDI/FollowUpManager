-- Migration: allow Blan assignees on companies

alter table public.companies
  drop constraint if exists companies_account_manager_check;

alter table public.companies
  add constraint companies_account_manager_check
    check (account_manager in (
      '정현정',
      '박종열',
      '류희재',
      '허진석',
      '이영준',
      '주재형',
      '이정준',
      '손명훈',
      '이하승'
    ));
