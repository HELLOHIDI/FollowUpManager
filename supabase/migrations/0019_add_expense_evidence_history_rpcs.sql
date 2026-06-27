-- Add atomic evidence metadata/history helpers for Slice 5.

create or replace function public.create_expense_evidence_with_history(
  p_id uuid,
  p_company_id uuid,
  p_project_id uuid,
  p_expense_id uuid,
  p_document_key text,
  p_requirement_key text,
  p_original_file_name text,
  p_stored_file_name text,
  p_storage_path text,
  p_file_size bigint,
  p_mime_type text,
  p_file_extension text,
  p_uploaded_by uuid default null
)
returns public.expense_evidence_files
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row public.expense_evidence_files%rowtype;
begin
  perform 1
  from public.expenses e
  join public.projects p on p.id = e.project_id
  where e.id = p_expense_id
    and e.project_id = p_project_id
    and p.company_id = p_company_id
    and e.deleted_at is null
    and p.deleted_at is null;

  if not found then
    raise exception 'EXPENSE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  insert into public.expense_evidence_files (
    id,
    company_id,
    project_id,
    expense_id,
    document_key,
    requirement_key,
    original_file_name,
    stored_file_name,
    storage_bucket,
    storage_path,
    file_size,
    mime_type,
    file_extension,
    uploaded_by
  )
  values (
    p_id,
    p_company_id,
    p_project_id,
    p_expense_id,
    p_document_key,
    nullif(btrim(coalesce(p_requirement_key, '')), ''),
    p_original_file_name,
    p_stored_file_name,
    'expense-evidence',
    p_storage_path,
    p_file_size,
    p_mime_type,
    p_file_extension,
    p_uploaded_by
  )
  returning * into inserted_row;

  insert into public.expense_history_events (
    expense_id,
    event_type,
    changed_by,
    summary,
    after_value
  )
  values (
    p_expense_id,
    'evidence_uploaded',
    p_uploaded_by,
    'Evidence file uploaded.',
    jsonb_build_object(
      'evidenceId', inserted_row.id,
      'documentKey', inserted_row.document_key,
      'originalFileName', inserted_row.original_file_name,
      'fileSize', inserted_row.file_size,
      'mimeType', inserted_row.mime_type
    )
  );

  return inserted_row;
end;
$$;

create or replace function public.delete_expense_evidence_with_history(
  p_evidence_id uuid,
  p_project_id uuid,
  p_expense_id uuid,
  p_changed_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_row public.expense_evidence_files%rowtype;
begin
  update public.expense_evidence_files
  set deleted_at = now()
  where id = p_evidence_id
    and project_id = p_project_id
    and expense_id = p_expense_id
    and deleted_at is null
  returning * into deleted_row;

  if not found then
    raise exception 'EVIDENCE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

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
    'evidence_deleted',
    p_changed_by,
    'Evidence file deleted.',
    jsonb_build_object(
      'evidenceId', deleted_row.id,
      'documentKey', deleted_row.document_key,
      'originalFileName', deleted_row.original_file_name,
      'fileSize', deleted_row.file_size,
      'mimeType', deleted_row.mime_type
    ),
    jsonb_build_object('deletedAt', deleted_row.deleted_at)
  );

  return deleted_row.id;
end;
$$;

revoke execute on function public.create_expense_evidence_with_history(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.create_expense_evidence_with_history(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  text,
  uuid
) to service_role;

revoke execute on function public.delete_expense_evidence_with_history(
  uuid,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;

grant execute on function public.delete_expense_evidence_with_history(
  uuid,
  uuid,
  uuid,
  uuid
) to service_role;

comment on function public.create_expense_evidence_with_history is
  'Creates expense evidence metadata and appends one evidence_uploaded history event atomically.';

comment on function public.delete_expense_evidence_with_history is
  'Soft deletes expense evidence metadata and appends one evidence_deleted history event atomically.';
