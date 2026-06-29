-- Program-specific evidence policy foundation.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'program-policy-documents',
  'program-policy-documents',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.program_policy_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'needs_review'
    check (status in ('draft_extracted', 'needs_review', 'ready_to_confirm', 'confirmed', 'archived')),
  operation_status text not null default 'draft_needs_review'
    check (operation_status in ('legacy_fallback', 'draft_needs_review', 'confirmed_policy', 'extraction_failed')),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'succeeded', 'failed')),
  extraction_failure_reason text,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  confirmed_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(confirmed_summary) = 'object'),
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_policy_versions_project_version_unique unique (project_id, version_number),
  constraint program_policy_versions_confirmed_metadata_check
    check (
      (status = 'confirmed' and operation_status = 'confirmed_policy' and confirmed_by is not null and confirmed_at is not null)
      or (status = 'archived' and operation_status = 'confirmed_policy' and confirmed_by is not null and confirmed_at is not null)
      or (status not in ('confirmed', 'archived') and operation_status <> 'confirmed_policy')
    ),
  constraint program_policy_versions_archived_metadata_check
    check ((status = 'archived' and archived_at is not null) or (status <> 'archived'))
);

create unique index program_policy_versions_one_active_confirmed_idx
  on public.program_policy_versions(project_id)
  where status = 'confirmed';

create index program_policy_versions_project_status_idx
  on public.program_policy_versions(project_id, status, created_at desc);

create table public.program_policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.program_policy_versions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('primary', 'reference')),
  original_file_name text not null check (btrim(original_file_name) <> ''),
  storage_bucket text not null default 'program-policy-documents'
    check (storage_bucket = 'program-policy-documents'),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  file_size bigint not null check (file_size between 1 and 20971520),
  upload_status text not null default 'uploading'
    check (upload_status in ('uploading', 'ready')),
  ready_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_policy_documents_ready_at_check
    check (
      (upload_status = 'uploading' and ready_at is null)
      or (upload_status = 'ready' and ready_at is not null)
    )
);

create unique index program_policy_documents_one_primary_idx
  on public.program_policy_documents(policy_version_id)
  where role = 'primary';

create index program_policy_documents_project_idx
  on public.program_policy_documents(project_id, created_at desc);

create table public.program_policy_categories (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.program_policy_versions(id) on delete cascade,
  category_key text not null check (category_key ~ '^[a-z0-9_]+$'),
  category_name text not null check (btrim(category_name) <> ''),
  raw_category_name text,
  sort_order integer not null default 0,
  review_status text not null default 'needs_admin_review'
    check (review_status in ('auto_confident', 'needs_admin_review', 'manual_required')),
  source_reference jsonb not null default '{}'::jsonb check (jsonb_typeof(source_reference) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_policy_categories_key_unique unique (policy_version_id, category_key)
);

create table public.program_policy_subcategories (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.program_policy_versions(id) on delete cascade,
  category_id uuid not null references public.program_policy_categories(id) on delete cascade,
  subcategory_key text not null check (subcategory_key ~ '^[a-z0-9_]+$'),
  subcategory_name text not null check (btrim(subcategory_name) <> ''),
  raw_subcategory_name text,
  sort_order integer not null default 0,
  review_status text not null default 'needs_admin_review'
    check (review_status in ('auto_confident', 'needs_admin_review', 'manual_required')),
  source_reference jsonb not null default '{}'::jsonb check (jsonb_typeof(source_reference) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_policy_subcategories_key_unique unique (category_id, subcategory_key)
);

create table public.program_policy_evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.program_policy_versions(id) on delete cascade,
  category_id uuid references public.program_policy_categories(id) on delete cascade,
  subcategory_id uuid references public.program_policy_subcategories(id) on delete cascade,
  evidence_key text not null check (evidence_key ~ '^[a-z0-9_]+$'),
  evidence_name text not null check (btrim(evidence_name) <> ''),
  requirement_type text not null check (requirement_type in ('required', 'conditional', 'optional')),
  fulfillment_type text not null check (fulfillment_type in ('single', 'any_of', 'all_of')),
  condition_text text,
  document_key text check (document_key is null or document_key ~ '^[a-z0-9_]+$'),
  review_status text not null default 'needs_admin_review'
    check (review_status in ('auto_confident', 'needs_admin_review', 'manual_required')),
  source_reference jsonb not null default '{}'::jsonb check (jsonb_typeof(source_reference) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_policy_evidence_requirements_key_unique unique (policy_version_id, evidence_key)
);

alter table public.projects
  add column if not exists confirmed_policy_version_id uuid references public.program_policy_versions(id) on delete set null;

alter table public.expenses
  alter column project_budget_category_id drop not null,
  add column if not exists policy_version_id uuid references public.program_policy_versions(id) on delete restrict,
  add column if not exists policy_snapshot jsonb,
  add column if not exists subcategory_key text,
  add column if not exists subcategory_name text,
  add constraint expenses_category_source_check
    check (
      (policy_version_id is null and project_budget_category_id is not null)
      or (policy_version_id is not null and policy_snapshot is not null and jsonb_typeof(policy_snapshot) = 'object')
    );

create index if not exists expenses_policy_version_id_idx
  on public.expenses(policy_version_id);

create index if not exists expenses_policy_snapshot_category_idx
  on public.expenses(project_id, ((policy_snapshot ->> 'category_key')))
  where policy_version_id is not null and deleted_at is null;

create trigger program_policy_versions_set_updated_at
before update on public.program_policy_versions
for each row execute function public.set_updated_at();

create trigger program_policy_documents_set_updated_at
before update on public.program_policy_documents
for each row execute function public.set_updated_at();

create trigger program_policy_categories_set_updated_at
before update on public.program_policy_categories
for each row execute function public.set_updated_at();

create trigger program_policy_subcategories_set_updated_at
before update on public.program_policy_subcategories
for each row execute function public.set_updated_at();

create trigger program_policy_evidence_requirements_set_updated_at
before update on public.program_policy_evidence_requirements
for each row execute function public.set_updated_at();

create function public.enforce_confirmed_program_policy_version_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('confirmed', 'archived') then
    if new.status = 'archived'
      and old.status = 'confirmed'
      and new.project_id = old.project_id
      and new.version_number = old.version_number
      and new.operation_status = old.operation_status
      and new.extraction_status = old.extraction_status
      and new.extraction_failure_reason is not distinct from old.extraction_failure_reason
      and new.confirmed_by is not distinct from old.confirmed_by
      and new.confirmed_at is not distinct from old.confirmed_at
      and new.confirmed_summary is not distinct from old.confirmed_summary
      and new.created_by is not distinct from old.created_by
      and new.created_at is not distinct from old.created_at
    then
      return new;
    end if;

    raise exception 'confirmed or archived program policy versions are immutable';
  end if;

  return new;
end;
$$;

create trigger program_policy_versions_enforce_confirmed_immutable
before update on public.program_policy_versions
for each row execute function public.enforce_confirmed_program_policy_version_immutable();

create function public.enforce_confirmed_program_policy_child_immutable()
returns trigger
language plpgsql
as $$
declare
  old_status text;
  new_status text;
  old_policy_version_id uuid;
  new_policy_version_id uuid;
begin
  old_policy_version_id := case when tg_op in ('UPDATE', 'DELETE') then old.policy_version_id else null end;
  new_policy_version_id := case when tg_op in ('INSERT', 'UPDATE') then new.policy_version_id else null end;

  if old_policy_version_id is not null then
    select status into old_status from public.program_policy_versions where id = old_policy_version_id;
  end if;

  if new_policy_version_id is not null then
    select status into new_status from public.program_policy_versions where id = new_policy_version_id;
  end if;

  if old_status in ('confirmed', 'archived') or new_status in ('confirmed', 'archived') then
    raise exception 'confirmed or archived program policy child rows are immutable';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger program_policy_documents_enforce_confirmed_immutable
before insert or update or delete on public.program_policy_documents
for each row execute function public.enforce_confirmed_program_policy_child_immutable();

create trigger program_policy_categories_enforce_confirmed_immutable
before insert or update or delete on public.program_policy_categories
for each row execute function public.enforce_confirmed_program_policy_child_immutable();

create trigger program_policy_subcategories_enforce_confirmed_immutable
before insert or update or delete on public.program_policy_subcategories
for each row execute function public.enforce_confirmed_program_policy_child_immutable();

create trigger program_policy_evidence_requirements_enforce_confirmed_immutable
before insert or update or delete on public.program_policy_evidence_requirements
for each row execute function public.enforce_confirmed_program_policy_child_immutable();

alter table public.program_policy_versions enable row level security;
alter table public.program_policy_documents enable row level security;
alter table public.program_policy_categories enable row level security;
alter table public.program_policy_subcategories enable row level security;
alter table public.program_policy_evidence_requirements enable row level security;

revoke all on table public.program_policy_versions from anon, authenticated;
revoke all on table public.program_policy_documents from anon, authenticated;
revoke all on table public.program_policy_categories from anon, authenticated;
revoke all on table public.program_policy_subcategories from anon, authenticated;
revoke all on table public.program_policy_evidence_requirements from anon, authenticated;

grant select, insert, update, delete on table public.program_policy_versions to authenticated;
grant select, insert, update, delete on table public.program_policy_documents to authenticated;
grant select, insert, update, delete on table public.program_policy_categories to authenticated;
grant select, insert, update, delete on table public.program_policy_subcategories to authenticated;
grant select, insert, update, delete on table public.program_policy_evidence_requirements to authenticated;

grant select, insert, update, delete on table public.program_policy_versions to service_role;
grant select, insert, update, delete on table public.program_policy_documents to service_role;
grant select, insert, update, delete on table public.program_policy_categories to service_role;
grant select, insert, update, delete on table public.program_policy_subcategories to service_role;
grant select, insert, update, delete on table public.program_policy_evidence_requirements to service_role;

create policy "Authenticated users can manage program policy versions"
  on public.program_policy_versions
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage program policy documents"
  on public.program_policy_documents
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage program policy categories"
  on public.program_policy_categories
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage program policy subcategories"
  on public.program_policy_subcategories
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage program policy evidence requirements"
  on public.program_policy_evidence_requirements
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read program policy objects"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'program-policy-documents');

create policy "Authenticated users can upload program policy objects"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'program-policy-documents');

create policy "Authenticated users can update program policy objects"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'program-policy-documents')
  with check (bucket_id = 'program-policy-documents');

create policy "Authenticated users can delete program policy objects"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'program-policy-documents');

create or replace function public.confirm_program_policy_version(
  p_project_id uuid,
  p_policy_version_id uuid,
  p_confirmed_by uuid,
  p_confirmed_summary jsonb
)
returns public.program_policy_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  confirmed_row public.program_policy_versions%rowtype;
begin
  update public.program_policy_versions
  set
    archived_at = now(),
    status = 'archived'
  where project_id = p_project_id
    and status = 'confirmed';

  update public.program_policy_versions
  set
    confirmed_at = now(),
    confirmed_by = p_confirmed_by,
    confirmed_summary = coalesce(p_confirmed_summary, '{}'::jsonb),
    operation_status = 'confirmed_policy',
    status = 'confirmed'
  where id = p_policy_version_id
    and project_id = p_project_id
    and status = 'ready_to_confirm'
  returning * into confirmed_row;

  if not found then
    raise exception 'POLICY_VERSION_NOT_READY'
      using errcode = 'P0002';
  end if;

  update public.projects
  set confirmed_policy_version_id = p_policy_version_id
  where id = p_project_id;

  if not found then
    raise exception 'PROJECT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  return confirmed_row;
end;
$$;

create or replace function public.update_policy_expense_with_history(
  p_expense_id uuid,
  p_project_id uuid,
  p_category_key text,
  p_subcategory_key text,
  p_subcategory_name text,
  p_policy_version_id uuid,
  p_policy_snapshot jsonb,
  p_funding_source_key text,
  p_title text,
  p_amount bigint,
  p_expected_spend_date date,
  p_vendor_name text,
  p_memo text,
  p_pre_approval_status text,
  p_execution_progress_status text,
  p_execution_request_status text,
  p_execution_request_date date,
  p_stage_fields jsonb,
  p_changed_by uuid default null,
  p_history_summary text default 'Expense details updated.'
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.expenses%rowtype;
  updated_row public.expenses%rowtype;
  history_before jsonb := '{}'::jsonb;
  history_after jsonb := '{}'::jsonb;
begin
  select *
  into current_row
  from public.expenses
  where id = p_expense_id
    and project_id = p_project_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'EXPENSE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if current_row.amount is distinct from p_amount then
    history_before := history_before || jsonb_build_object('amount', current_row.amount);
    history_after := history_after || jsonb_build_object('amount', p_amount);
  end if;

  if current_row.category_key is distinct from p_category_key then
    history_before := history_before || jsonb_build_object('categoryKey', current_row.category_key);
    history_after := history_after || jsonb_build_object('categoryKey', p_category_key);
  end if;

  if current_row.subcategory_key is distinct from p_subcategory_key then
    history_before := history_before || jsonb_build_object('subcategoryKey', current_row.subcategory_key);
    history_after := history_after || jsonb_build_object('subcategoryKey', p_subcategory_key);
  end if;

  if current_row.policy_version_id is distinct from p_policy_version_id then
    history_before := history_before || jsonb_build_object('policyVersionId', current_row.policy_version_id);
    history_after := history_after || jsonb_build_object('policyVersionId', p_policy_version_id);
  end if;

  if current_row.execution_progress_status is distinct from p_execution_progress_status then
    history_before := history_before || jsonb_build_object('executionProgressStatus', current_row.execution_progress_status);
    history_after := history_after || jsonb_build_object('executionProgressStatus', p_execution_progress_status);
  end if;

  if current_row.execution_request_date is distinct from p_execution_request_date then
    history_before := history_before || jsonb_build_object('executionRequestDate', current_row.execution_request_date);
    history_after := history_after || jsonb_build_object('executionRequestDate', p_execution_request_date);
  end if;

  if current_row.execution_request_status is distinct from p_execution_request_status then
    history_before := history_before || jsonb_build_object('executionRequestStatus', current_row.execution_request_status);
    history_after := history_after || jsonb_build_object('executionRequestStatus', p_execution_request_status);
  end if;

  if current_row.expected_spend_date is distinct from p_expected_spend_date then
    history_before := history_before || jsonb_build_object('expectedSpendDate', current_row.expected_spend_date);
    history_after := history_after || jsonb_build_object('expectedSpendDate', p_expected_spend_date);
  end if;

  if current_row.funding_source_key is distinct from p_funding_source_key then
    history_before := history_before || jsonb_build_object('fundingSourceKey', current_row.funding_source_key);
    history_after := history_after || jsonb_build_object('fundingSourceKey', p_funding_source_key);
  end if;

  if current_row.memo is distinct from p_memo then
    history_before := history_before || jsonb_build_object('memo', current_row.memo);
    history_after := history_after || jsonb_build_object('memo', p_memo);
  end if;

  if current_row.pre_approval_status is distinct from p_pre_approval_status then
    history_before := history_before || jsonb_build_object('preApprovalStatus', current_row.pre_approval_status);
    history_after := history_after || jsonb_build_object('preApprovalStatus', p_pre_approval_status);
  end if;

  if coalesce(current_row.stage_fields, '{}'::jsonb) is distinct from coalesce(p_stage_fields, '{}'::jsonb) then
    history_before := history_before || jsonb_build_object('stageFields', coalesce(current_row.stage_fields, '{}'::jsonb));
    history_after := history_after || jsonb_build_object('stageFields', coalesce(p_stage_fields, '{}'::jsonb));
  end if;

  if current_row.title is distinct from p_title then
    history_before := history_before || jsonb_build_object('title', current_row.title);
    history_after := history_after || jsonb_build_object('title', p_title);
  end if;

  if current_row.vendor_name is distinct from p_vendor_name then
    history_before := history_before || jsonb_build_object('vendorName', current_row.vendor_name);
    history_after := history_after || jsonb_build_object('vendorName', p_vendor_name);
  end if;

  update public.expenses
  set
    project_budget_category_id = null,
    category_key = p_category_key,
    subcategory_key = p_subcategory_key,
    subcategory_name = p_subcategory_name,
    policy_version_id = p_policy_version_id,
    policy_snapshot = p_policy_snapshot,
    funding_source_key = p_funding_source_key,
    title = p_title,
    amount = p_amount,
    expected_spend_date = p_expected_spend_date,
    vendor_name = p_vendor_name,
    memo = p_memo,
    pre_approval_status = p_pre_approval_status,
    execution_progress_status = p_execution_progress_status,
    execution_request_status = p_execution_request_status,
    execution_request_date = p_execution_request_date,
    stage_fields = coalesce(p_stage_fields, '{}'::jsonb),
    updated_at = now()
  where id = current_row.id
  returning * into updated_row;

  if coalesce(jsonb_object_length(history_after), 0) > 0 then
    insert into public.expense_history_events (
      expense_id,
      event_type,
      changed_by,
      summary,
      before_value,
      after_value
    )
    values (
      p_expense_id,
      'expense_updated',
      p_changed_by,
      p_history_summary,
      nullif(history_before, '{}'::jsonb),
      history_after
    );
  end if;

  return updated_row;
end;
$$;

revoke execute on function public.confirm_program_policy_version(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_program_policy_version(uuid, uuid, uuid, jsonb) to authenticated, service_role;

revoke execute on function public.update_policy_expense_with_history(
  uuid, uuid, text, text, text, uuid, jsonb, text, text, bigint, date, text, text, text, text, text, date, jsonb, uuid, text
) from public, anon, authenticated;
grant execute on function public.update_policy_expense_with_history(
  uuid, uuid, text, text, text, uuid, jsonb, text, text, bigint, date, text, text, text, text, text, date, jsonb, uuid, text
) to service_role;

comment on table public.program_policy_versions is
  'Versioned program-specific evidence policy extracted from an uploaded PDF and confirmed by an internal operator.';

comment on table public.program_policy_documents is
  'Private policy PDF documents attached to a program policy version.';
