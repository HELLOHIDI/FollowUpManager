create table public.project_evidence_document_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_key text not null check (document_key ~ '^[a-z0-9_]+$'),
  display_name text not null check (btrim(display_name) <> ''),
  source text not null check (source in ('policy', 'custom')),
  stage_key text not null default 'execution_request' check (stage_key = 'execution_request'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint project_evidence_document_types_project_key_unique unique (project_id, document_key)
);

create table public.project_document_template_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_type_id uuid not null references public.project_evidence_document_types(id) on delete cascade,
  project_document_id uuid not null references public.project_documents(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint project_document_template_links_unique unique (document_type_id, project_document_id)
);

create trigger project_evidence_document_types_set_updated_at
before update on public.project_evidence_document_types
for each row execute function public.set_updated_at();

alter table public.project_evidence_document_types enable row level security;
alter table public.project_document_template_links enable row level security;

revoke all on table public.project_evidence_document_types from anon, authenticated;
revoke all on table public.project_document_template_links from anon, authenticated;

grant select, insert, update, delete on table public.project_evidence_document_types to authenticated;
grant select, insert, update, delete on table public.project_document_template_links to authenticated;
grant select, insert, update, delete on table public.project_evidence_document_types to service_role;
grant select, insert, update, delete on table public.project_document_template_links to service_role;

create policy "Authenticated users can manage project evidence document types"
  on public.project_evidence_document_types
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage project document template links"
  on public.project_document_template_links
  for all
  to authenticated
  using (true)
  with check (true);

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

    if document_type ? 'id' and nullif(document_type->>'id', '') is not null then
      update public.project_evidence_document_types
      set
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
        document_key,
        display_name,
        source,
        stage_key,
        sort_order
      ) values (
        p_project_id,
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
          'documentKey', types.document_key,
          'displayName', types.display_name,
          'source', types.source,
          'stageKey', types.stage_key,
          'sortOrder', types.sort_order
        )
        order by types.sort_order, types.display_name, types.document_key
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

revoke execute on function public.save_project_evidence_template_setup(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_project_evidence_template_setup(uuid, jsonb, jsonb) to authenticated, service_role;
