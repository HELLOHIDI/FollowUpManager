-- Migration: create expense evidence metadata and private storage bucket setup

insert into storage.buckets (id, name, public)
values ('expense-evidence', 'expense-evidence', false)
on conflict (id) do update
set
  name = excluded.name,
  public = false;

create table if not exists public.expense_evidence_files (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null,
  project_id uuid not null,
  expense_id uuid not null references public.expenses(id) on delete cascade,

  document_key text not null check (btrim(document_key) <> ''),
  requirement_key text,

  original_file_name text not null check (btrim(original_file_name) <> ''),
  stored_file_name text not null check (btrim(stored_file_name) <> ''),
  storage_bucket text not null default 'expense-evidence'
    check (storage_bucket = 'expense-evidence'),
  storage_path text not null unique check (btrim(storage_path) <> ''),

  file_size bigint check (file_size is null or file_size >= 0),
  mime_type text,
  file_extension text,
  file_hash text,
  duplicate_group_key text,

  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint expense_evidence_files_project_company_fk
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete restrict
);

create index if not exists expense_evidence_files_company_id_idx
  on public.expense_evidence_files(company_id);

create index if not exists expense_evidence_files_project_id_idx
  on public.expense_evidence_files(project_id);

create index if not exists expense_evidence_files_expense_id_idx
  on public.expense_evidence_files(expense_id);

create index if not exists expense_evidence_files_document_key_idx
  on public.expense_evidence_files(document_key);

create index if not exists expense_evidence_files_file_hash_idx
  on public.expense_evidence_files(file_hash)
  where file_hash is not null;

create index if not exists expense_evidence_files_deleted_at_idx
  on public.expense_evidence_files(deleted_at);

alter table public.expense_evidence_files enable row level security;

create policy "Authenticated users can read expense evidence files"
on public.expense_evidence_files
for select
to authenticated
using (true);

create policy "Authenticated users can insert expense evidence files"
on public.expense_evidence_files
for insert
to authenticated
with check (true);

create policy "Authenticated users can update expense evidence files"
on public.expense_evidence_files
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete expense evidence files"
on public.expense_evidence_files
for delete
to authenticated
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can read expense evidence objects'
  ) then
    create policy "Authenticated users can read expense evidence objects"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'expense-evidence');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can insert expense evidence objects'
  ) then
    create policy "Authenticated users can insert expense evidence objects"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'expense-evidence');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can update expense evidence objects'
  ) then
    create policy "Authenticated users can update expense evidence objects"
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'expense-evidence')
    with check (bucket_id = 'expense-evidence');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can delete expense evidence objects'
  ) then
    create policy "Authenticated users can delete expense evidence objects"
    on storage.objects
    for delete
    to authenticated
    using (bucket_id = 'expense-evidence');
  end if;
end;
$$;

comment on table public.expense_evidence_files is
  'Metadata for files stored in the private expense-evidence bucket.';
