alter table public.project_documents
  add column if not exists document_purpose text not null default 'institution_template'
  check (document_purpose in ('general', 'institution_template'));

alter table public.project_evidence_document_types
  add column if not exists category_key text check (category_key is null or category_key ~ '^[a-z0-9_]+$'),
  add column if not exists category_name text;

create index if not exists project_documents_purpose_visible_idx
  on public.project_documents(project_id, document_purpose, created_at)
  where deleted_at is null and upload_status = 'ready';

create or replace function public.save_project_evidence_template_setup(
  p_project_id uuid,
  p_document_types jsonb,
  p_links jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  document_type jsonb;
  link jsonb;
  submitted_type_ids uuid[] := array[]::uuid[];
  input_document_key text;
  saved_document_key text;
  saved_type_id uuid;
  suffix text;
begin
  if not exists (select 1 from public.projects where id = p_project_id and deleted_at is null) then
    raise exception 'Project not found';
  end if;

  create temporary table if not exists pg_temp.saved_template_types (
    input_key text primary key,
    saved_id uuid not null,
    saved_key text not null
  ) on commit drop;
  truncate pg_temp.saved_template_types;

  for document_type in select value from jsonb_array_elements(coalesce(p_document_types, '[]'::jsonb)) loop
    input_document_key := btrim(document_type->>'documentKey');
    saved_document_key := input_document_key;

    if input_document_key is null or input_document_key !~ '^[a-z0-9_]+$' then
      raise exception 'Invalid document key';
    end if;

    if btrim(document_type->>'displayName') = '' then
      raise exception 'Invalid display name';
    end if;

    if document_type->>'source' not in ('policy', 'custom') then
      raise exception 'Invalid source';
    end if;

    if coalesce(document_type->>'stageKey', 'execution_request') <> 'execution_request' then
      raise exception 'Invalid stage key';
    end if;

    if nullif(document_type->>'categoryKey', '') is not null and document_type->>'categoryKey' !~ '^[a-z0-9_]+$' then
      raise exception 'Invalid category key';
    end if;

    if document_type ? 'id' and nullif(document_type->>'id', '') is not null then
      update public.project_evidence_document_types
      set
        category_key = nullif(document_type->>'categoryKey', ''),
        category_name = nullif(btrim(coalesce(document_type->>'categoryName', '')), ''),
        display_name = btrim(document_type->>'displayName'),
        sort_order = coalesce((document_type->>'sortOrder')::integer, 0),
        deleted_at = null
      where id = (document_type->>'id')::uuid
        and project_id = p_project_id
      returning id, document_key into saved_type_id, saved_document_key;

      if saved_type_id is null then
        raise exception 'Document type not found';
      end if;
    else
      while exists (
        select 1
        from public.project_evidence_document_types
        where project_id = p_project_id
          and document_key = saved_document_key
      ) loop
        suffix := replace(left(gen_random_uuid()::text, 8), '-', '');
        saved_document_key := left(input_document_key, 52) || '_' || suffix;
      end loop;

      insert into public.project_evidence_document_types (
        project_id,
        category_key,
        category_name,
        document_key,
        display_name,
        source,
        stage_key,
        sort_order
      ) values (
        p_project_id,
        nullif(document_type->>'categoryKey', ''),
        nullif(btrim(coalesce(document_type->>'categoryName', '')), ''),
        saved_document_key,
        btrim(document_type->>'displayName'),
        document_type->>'source',
        'execution_request',
        coalesce((document_type->>'sortOrder')::integer, 0)
      )
      returning id into saved_type_id;
    end if;

    submitted_type_ids := array_append(submitted_type_ids, saved_type_id);
    insert into pg_temp.saved_template_types(input_key, saved_id, saved_key)
    values (input_document_key, saved_type_id, saved_document_key)
    on conflict (input_key) do update set saved_id = excluded.saved_id, saved_key = excluded.saved_key;
  end loop;

  for link in select value from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    if not exists (
      select 1
      from public.project_documents
      where id = (link->>'projectDocumentId')::uuid
        and project_id = p_project_id
        and document_purpose = 'institution_template'
        and upload_status = 'ready'
        and deleted_at is null
    ) then
      raise exception 'Invalid project document';
    end if;
  end loop;

  delete from public.project_document_template_links
  where project_id = p_project_id
    and document_type_id = any(submitted_type_ids);

  for link in select value from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    select saved_id into saved_type_id
    from pg_temp.saved_template_types
    where input_key = link->>'documentKey';

    if saved_type_id is null then
      raise exception 'Invalid link document type';
    end if;

    insert into public.project_document_template_links (
      project_id,
      document_type_id,
      project_document_id,
      sort_order
    ) values (
      p_project_id,
      saved_type_id,
      (link->>'projectDocumentId')::uuid,
      coalesce((link->>'sortOrder')::integer, 0)
    )
    on conflict (document_type_id, project_document_id) do update
    set sort_order = excluded.sort_order;
  end loop;

  return (
    select jsonb_build_object(
      'documentTypes',
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', types.id,
          'projectId', types.project_id,
          'categoryKey', types.category_key,
          'categoryName', types.category_name,
          'documentKey', types.document_key,
          'displayName', types.display_name,
          'source', types.source,
          'stageKey', types.stage_key,
          'sortOrder', types.sort_order
        )
        order by types.category_name nulls last, types.sort_order, types.display_name, types.document_key
      ), '[]'::jsonb),
      'links',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'documentTypeId', links.document_type_id,
            'documentKey', linked_types.document_key,
            'projectDocumentId', links.project_document_id,
            'sortOrder', links.sort_order
          )
          order by linked_types.sort_order, links.sort_order
        )
        from public.project_document_template_links links
        join public.project_evidence_document_types linked_types
          on linked_types.id = links.document_type_id
        join public.project_documents documents
          on documents.id = links.project_document_id
        where links.project_id = p_project_id
          and documents.document_purpose = 'institution_template'
          and documents.upload_status = 'ready'
          and documents.deleted_at is null
      ), '[]'::jsonb)
    )
    from public.project_evidence_document_types types
    where types.project_id = p_project_id
      and types.deleted_at is null
  );
end;
$$;

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
  select *
  into locked_project
  from public.projects
  where id = p_project_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select count(*)::integer
  into active_expense_count
  from public.expenses
  where project_id = p_project_id
    and deleted_at is null;

  if active_expense_count > 0 then
    raise exception 'POLICY_REPLACEMENT_BLOCKED_ACTIVE_EXPENSES'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into confirmed_category_count
  from public.program_policy_categories categories
  join public.program_policy_versions versions
    on versions.id = categories.policy_version_id
  where versions.id = p_policy_version_id
    and versions.project_id = p_project_id;

  if confirmed_category_count = 0 then
    raise exception 'POLICY_CATEGORIES_REQUIRED'
      using errcode = 'P0002';
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
    raise exception 'POLICY_VERSION_NOT_READY'
      using errcode = 'P0002';
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
    requirements.category_key,
    categories.category_name,
    coalesce(requirements.document_key, requirements.evidence_key),
    coalesce(requirements.evidence_name, coalesce(requirements.document_key, requirements.evidence_key)),
    'policy',
    'execution_request',
    requirements.sort_order
  from public.program_policy_evidence_requirements requirements
  left join public.program_policy_categories categories
    on categories.id = requirements.category_id
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
