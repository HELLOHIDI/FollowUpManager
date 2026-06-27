-- Migration: common database utilities for GrantFollow domain tables

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Keeps updated_at current for GrantFollow domain tables.';
