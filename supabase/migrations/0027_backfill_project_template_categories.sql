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
  locked_project public.projects%rowtype;
  confirmed_row public.program_policy_versions%rowtype;
  active_expense_count integer;
  confirmed_category_count integer;
begin
  select * into locked_project
  from public.projects
  where id = p_project_id and deleted_at is null
  for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*)::integer into active_expense_count
  from public.expenses
  where project_id = p_project_id and deleted_at is null;

  if active_expense_count > 0 then
    raise exception 'POLICY_REPLACEMENT_BLOCKED_ACTIVE_EXPENSES' using errcode = 'P0001';
  end if;

  select count(*)::integer into confirmed_category_count
  from public.program_policy_categories categories
  join public.program_policy_versions versions on versions.id = categories.policy_version_id
  where versions.id = p_policy_version_id and versions.project_id = p_project_id;

  if confirmed_category_count = 0 then
    raise exception 'POLICY_CATEGORIES_REQUIRED' using errcode = 'P0002';
  end if;

  update public.program_policy_versions
  set archived_at = now(), status = 'archived'
  where project_id = p_project_id and status = 'confirmed';

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
    raise exception 'POLICY_VERSION_NOT_READY' using errcode = 'P0002';
  end if;

  update public.project_budget_categories
  set deleted_at = now(), is_active = false
  where project_id = p_project_id and deleted_at is null;

  insert into public.project_budget_categories (project_id, category_key, sort_order, is_active)
  select p_project_id, categories.category_key, categories.sort_order, true
  from public.program_policy_categories categories
  where categories.policy_version_id = p_policy_version_id
  order by categories.sort_order, categories.category_key
  on conflict (project_id, category_key) do update
  set deleted_at = null, is_active = true, sort_order = excluded.sort_order;

  insert into public.project_evidence_document_types (
    project_id,
    category_key,
    category_name,
    document_key,
    display_name,
    source,
    stage_key,
    sort_order
  )
  select distinct on (coalesce(requirements.document_key, requirements.evidence_key))
    p_project_id,
    categories.category_key,
    categories.category_name,
    coalesce(requirements.document_key, requirements.evidence_key),
    coalesce(requirements.evidence_name, coalesce(requirements.document_key, requirements.evidence_key)),
    'policy',
    'execution_request',
    requirements.sort_order
  from public.program_policy_evidence_requirements requirements
  left join public.program_policy_categories categories on categories.id = requirements.category_id
  where requirements.policy_version_id = p_policy_version_id
    and coalesce(requirements.document_key, requirements.evidence_key) is not null
  order by coalesce(requirements.document_key, requirements.evidence_key), requirements.sort_order, requirements.evidence_name
  on conflict (project_id, document_key) do update
  set
    category_key = excluded.category_key,
    category_name = excluded.category_name,
    display_name = excluded.display_name,
    deleted_at = null,
    sort_order = excluded.sort_order;

  update public.projects
  set confirmed_policy_version_id = p_policy_version_id
  where id = p_project_id;

  return confirmed_row;
end;
$$;

with evidence_categories as (
  select distinct on (versions.project_id, coalesce(requirements.document_key, requirements.evidence_key))
    versions.project_id,
    coalesce(requirements.document_key, requirements.evidence_key) as document_key,
    categories.category_key,
    categories.category_name
  from public.program_policy_versions versions
  join public.program_policy_evidence_requirements requirements on requirements.policy_version_id = versions.id
  left join public.program_policy_categories categories on categories.id = requirements.category_id
  where versions.status = 'confirmed'
    and coalesce(requirements.document_key, requirements.evidence_key) is not null
  order by versions.project_id, coalesce(requirements.document_key, requirements.evidence_key), requirements.sort_order, requirements.evidence_name
)
update public.project_evidence_document_types types
set
  category_key = evidence_categories.category_key,
  category_name = evidence_categories.category_name
from evidence_categories
where types.project_id = evidence_categories.project_id
  and types.document_key = evidence_categories.document_key
  and types.source = 'policy'
  and types.deleted_at is null;
