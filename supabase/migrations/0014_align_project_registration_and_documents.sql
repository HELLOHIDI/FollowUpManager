-- Align projects with the final-only registration contract and add private project documents.

do $$
begin
  if exists (
    select 1
    from pg_attribute attribute
    join pg_depend dependency
      on dependency.refclassid = 'pg_class'::regclass
      and dependency.refobjid = attribute.attrelid
      and dependency.refobjsubid = attribute.attnum
    where attribute.attrelid = 'public.projects'::regclass
      and attribute.attname in ('self_cash_ratio', 'self_in_kind_ratio', 'budget_composition_status')
      and dependency.deptype = 'n'
      and dependency.classid not in ('pg_constraint'::regclass, 'pg_class'::regclass)
  ) then
    raise exception 'projects ratio/status columns have downstream dependencies';
  end if;

  if exists (
    select 1 from public.projects
    where assignment_number is null
      or btrim(assignment_number) = ''
      or (nullif(btrim(manager_email), '') is null and nullif(btrim(manager_phone), '') is null)
      or total_project_budget <= 0
      or self_contribution_amount <> self_cash_amount + self_in_kind_amount
      or total_project_budget <> government_subsidy_amount + self_cash_amount + self_in_kind_amount
      or greatest(
        government_subsidy_amount,
        self_cash_amount,
        self_in_kind_amount,
        self_contribution_amount,
        total_project_budget
      ) > 9007199254740991
      or profile_status <> 'complete'
  ) then
    raise exception 'projects contain rows incompatible with the final registration contract';
  end if;
end
$$;

alter table public.projects
  drop constraint if exists projects_assignment_number_check,
  drop constraint if exists projects_manager_contact_check,
  drop constraint if exists projects_amount_safe_check,
  drop constraint if exists projects_profile_status_check,
  drop constraint if exists projects_budget_total_check,
  alter column assignment_number set not null,
  alter column manager_email drop not null,
  alter column manager_phone drop not null,
  alter column profile_status set default 'complete',
  drop column self_cash_ratio restrict,
  drop column self_in_kind_ratio restrict,
  drop column budget_composition_status restrict,
  add constraint projects_assignment_number_check
    check (btrim(assignment_number) <> ''),
  add constraint projects_manager_contact_check
    check (
      nullif(btrim(manager_email), '') is not null
      or nullif(btrim(manager_phone), '') is not null
    ),
  add constraint projects_amount_safe_check
    check (
      government_subsidy_amount between 0 and 9007199254740991
      and self_cash_amount between 0 and 9007199254740991
      and self_in_kind_amount between 0 and 9007199254740991
      and self_contribution_amount between 0 and 9007199254740991
      and total_project_budget between 1 and 9007199254740991
    ),
  add constraint projects_budget_total_check
    check (
      total_project_budget =
      government_subsidy_amount + self_cash_amount + self_in_kind_amount
      and total_project_budget > 0
    ),
  add constraint projects_profile_status_check
    check (profile_status = 'complete');

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'project-documents',
  'project-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  project_id uuid not null,
  original_file_name text not null check (btrim(original_file_name) <> ''),
  stored_file_name text not null check (btrim(stored_file_name) <> ''),
  storage_bucket text not null default 'project-documents'
    check (storage_bucket = 'project-documents'),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  file_size bigint not null check (file_size between 1 and 20971520),
  mime_type text not null check (btrim(mime_type) <> ''),
  file_extension text not null check (btrim(file_extension) <> ''),
  upload_status text not null default 'uploading'
    check (upload_status in ('uploading', 'ready')),
  ready_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_documents_project_company_fk
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete restrict,
  constraint project_documents_ready_at_check
    check (
      (upload_status = 'uploading' and ready_at is null)
      or (upload_status = 'ready' and ready_at is not null)
    )
);

create index project_documents_project_id_idx on public.project_documents(project_id);
create index project_documents_company_id_idx on public.project_documents(company_id);
create index project_documents_visible_idx
  on public.project_documents(project_id, created_at)
  where upload_status = 'ready' and deleted_at is null;

create trigger project_documents_set_updated_at
before update on public.project_documents
for each row execute function public.set_updated_at();

create function public.enforce_project_document_terminal_state()
returns trigger
language plpgsql
as $$
begin
  if old.deleted_at is not null and new is distinct from old then
    raise exception 'deleted project documents are terminal';
  end if;
  if old.upload_status = 'ready' and new.upload_status <> 'ready' then
    raise exception 'ready project documents cannot return to uploading';
  end if;
  return new;
end;
$$;

create trigger project_documents_enforce_terminal_state
before update on public.project_documents
for each row execute function public.enforce_project_document_terminal_state();

alter table public.project_documents enable row level security;

revoke all on table public.project_documents from anon, authenticated;
grant select, insert, update, delete on table public.project_documents to service_role;

revoke all on table public.projects from anon;
revoke insert, update, delete on table public.projects from authenticated;
grant select on table public.projects to authenticated;
grant select, insert, update, delete on table public.projects to service_role;

comment on table public.project_documents is
  'Private institution-provided documents attached to a project.';
