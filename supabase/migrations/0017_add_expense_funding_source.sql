-- Add funding source classification to expenses.

alter table public.expenses
  add column if not exists funding_source_key text not null default 'government_subsidy'
    check (funding_source_key in ('government_subsidy', 'self_cash', 'self_in_kind'));

update public.expenses
set funding_source_key = coalesce(funding_source_key, 'government_subsidy');

comment on column public.expenses.funding_source_key is
  'Classifies the expense amount as government subsidy, self cash, or self in-kind.';
