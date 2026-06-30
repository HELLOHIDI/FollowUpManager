alter table public.project_budget_categories
  drop constraint if exists project_budget_categories_category_key_fkey;

comment on column public.project_budget_categories.category_key is
  'Project-local budget category key. Legacy fallback keys may match templates; confirmed program policy keys are project-specific.';

create or replace function public.enforce_confirmed_program_policy_version_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'confirmed'
    and new.status = 'archived'
    and new.archived_at is not null
    and new.id = old.id
    and new.project_id = old.project_id
    and new.version_number = old.version_number
    and new.operation_status = old.operation_status
    and new.extraction_status = old.extraction_status
    and new.confirmed_by = old.confirmed_by
    and new.confirmed_at = old.confirmed_at
    and new.confirmed_summary = old.confirmed_summary then
    return new;
  end if;

  if old.status in ('confirmed', 'archived') then
    raise exception 'confirmed or archived program policy versions are immutable';
  end if;

  return new;
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

  update public.project_budget_categories
  set
    deleted_at = now(),
    is_active = false
  where project_id = p_project_id
    and deleted_at is null;

  insert into public.project_budget_categories (
    project_id,
    category_key,
    sort_order,
    is_active
  )
  select
    p_project_id,
    categories.category_key,
    categories.sort_order,
    true
  from public.program_policy_categories categories
  where categories.policy_version_id = p_policy_version_id
  order by categories.sort_order, categories.category_key
  on conflict (project_id, category_key) do update
  set
    deleted_at = null,
    is_active = true,
    sort_order = excluded.sort_order;

  update public.projects
  set confirmed_policy_version_id = p_policy_version_id
  where id = p_project_id;

  return confirmed_row;
end;
$$;

revoke execute on function public.confirm_program_policy_version(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_program_policy_version(uuid, uuid, uuid, jsonb) to authenticated, service_role;

create or replace function public.create_expense_with_policy_lock(
  p_project_id uuid,
  p_category_key text,
  p_subcategory_key text,
  p_funding_source_key text,
  p_title text,
  p_amount bigint,
  p_expected_spend_date date,
  p_memo text
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_project public.projects%rowtype;
  confirmed_version public.program_policy_versions%rowtype;
  policy_category public.program_policy_categories%rowtype;
  policy_subcategory public.program_policy_subcategories%rowtype;
  legacy_category_id uuid;
  inserted_row public.expenses%rowtype;
  policy_snapshot jsonb;
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

  if locked_project.confirmed_policy_version_id is not null then
    select *
    into confirmed_version
    from public.program_policy_versions
    where id = locked_project.confirmed_policy_version_id
      and project_id = p_project_id
      and status = 'confirmed';

    if found then
      select *
      into policy_category
      from public.program_policy_categories
      where policy_version_id = confirmed_version.id
        and category_key = p_category_key;

      if not found then
        raise exception 'EXPENSE_CATEGORY_UNAVAILABLE'
          using errcode = 'P0001';
      end if;

      if p_subcategory_key is not null then
        select *
        into policy_subcategory
        from public.program_policy_subcategories
        where policy_version_id = confirmed_version.id
          and category_id = policy_category.id
          and subcategory_key = p_subcategory_key;

        if not found then
          raise exception 'EXPENSE_CATEGORY_UNAVAILABLE'
            using errcode = 'P0001';
        end if;
      elsif exists (
        select 1
        from public.program_policy_subcategories
        where policy_version_id = confirmed_version.id
          and category_id = policy_category.id
      ) then
        raise exception 'EXPENSE_CATEGORY_UNAVAILABLE'
          using errcode = 'P0001';
      end if;

      select jsonb_build_object(
        'category_key', policy_category.category_key,
        'category_name', policy_category.category_name,
        'subcategory_key', case when p_subcategory_key is null then null else policy_subcategory.subcategory_key end,
        'subcategory_name', case when p_subcategory_key is null then null else policy_subcategory.subcategory_name end,
        'evidence_requirements', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'condition_text', evidence.condition_text,
              'document_key', evidence.document_key,
              'evidence_key', evidence.evidence_key,
              'evidence_name', evidence.evidence_name,
              'fulfillment_type', evidence.fulfillment_type,
              'requirement_type', evidence.requirement_type,
              'source_reference', coalesce(evidence.source_reference, '{}'::jsonb)
            )
            order by evidence.evidence_key
          ) filter (
            where evidence.id is not null
              and (
                (evidence.category_id is null and evidence.subcategory_id is null)
                or (
                  evidence.category_id = policy_category.id
                  and (
                    evidence.subcategory_id is null
                    or evidence.subcategory_id = case when p_subcategory_key is null then null else policy_subcategory.id end
                  )
                )
              )
          ),
          '[]'::jsonb
        )
      )
      into policy_snapshot
      from public.program_policy_evidence_requirements evidence
      where evidence.policy_version_id = confirmed_version.id;

      insert into public.expenses (
        project_id,
        project_budget_category_id,
        category_key,
        subcategory_key,
        subcategory_name,
        policy_version_id,
        policy_snapshot,
        funding_source_key,
        title,
        amount,
        stage_key,
        expected_spend_date,
        memo,
        stage_fields
      )
      values (
        p_project_id,
        null,
        policy_category.category_key,
        case when p_subcategory_key is null then null else policy_subcategory.subcategory_key end,
        case when p_subcategory_key is null then null else policy_subcategory.subcategory_name end,
        confirmed_version.id,
        policy_snapshot,
        p_funding_source_key,
        p_title,
        p_amount,
        'budget_registration',
        p_expected_spend_date,
        p_memo,
        '{}'::jsonb
      )
      returning * into inserted_row;

      return inserted_row;
    end if;
  end if;

  select id
  into legacy_category_id
  from public.project_budget_categories
  where project_id = p_project_id
    and category_key = p_category_key
    and deleted_at is null
    and is_active
  limit 1;

  if legacy_category_id is null then
    if not exists (
      select 1
      from public.budget_category_policy_templates
      where category_key = p_category_key
        and is_active
    ) then
      raise exception 'EXPENSE_CATEGORY_UNAVAILABLE'
        using errcode = 'P0001';
    end if;

    insert into public.project_budget_categories (
      project_id,
      category_key,
      sort_order,
      is_active
    )
    values (
      p_project_id,
      p_category_key,
      0,
      true
    )
    on conflict (project_id, category_key) do update
    set
      deleted_at = null,
      is_active = true
    returning id into legacy_category_id;
  end if;

  insert into public.expenses (
    project_id,
    project_budget_category_id,
    category_key,
    policy_version_id,
    policy_snapshot,
    funding_source_key,
    title,
    amount,
    stage_key,
    expected_spend_date,
    memo,
    stage_fields
  )
  values (
    p_project_id,
    legacy_category_id,
    p_category_key,
    null,
    null,
    p_funding_source_key,
    p_title,
    p_amount,
    'budget_registration',
    p_expected_spend_date,
    p_memo,
    '{}'::jsonb
  )
  returning * into inserted_row;

  return inserted_row;
end;
$$;

revoke execute on function public.create_expense_with_policy_lock(uuid, text, text, text, text, bigint, date, text) from public, anon, authenticated;
grant execute on function public.create_expense_with_policy_lock(uuid, text, text, text, text, bigint, date, text) to authenticated, service_role;
