alter table public.projects
  drop constraint if exists projects_assignment_number_check,
  alter column assignment_number drop not null;

alter table public.expenses
  drop constraint if exists expenses_funding_source_key_check,
  add constraint expenses_funding_source_key_check
    check (funding_source_key in (
      'government_subsidy',
      'self_cash',
      'self_in_kind',
      'government_subsidy+self_cash',
      'government_subsidy+self_in_kind',
      'self_cash+self_in_kind',
      'government_subsidy+self_cash+self_in_kind'
    ));

comment on column public.expenses.funding_source_key is
  'Classifies expense funding as one or more of government subsidy, self cash, and self in-kind.';
