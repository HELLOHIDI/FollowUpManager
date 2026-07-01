alter table public.program_policy_evidence_requirements
  add column if not exists sort_order integer not null default 0;

create or replace function public.replace_program_policy_draft(
  p_policy_version_id uuid,
  p_categories jsonb,
  p_subcategories jsonb,
  p_evidence_requirements jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  category_id uuid;
  subcategory_id uuid;
begin
  if exists (
    select 1
    from public.program_policy_versions
    where id = p_policy_version_id
      and (
        status in ('confirmed', 'archived')
        or operation_status = 'extraction_failed'
        or extraction_status = 'failed'
      )
  ) then
    raise exception 'POLICY_VERSION_NOT_EDITABLE'
      using errcode = 'P0002';
  end if;

  delete from public.program_policy_evidence_requirements
  where policy_version_id = p_policy_version_id;

  delete from public.program_policy_subcategories
  where policy_version_id = p_policy_version_id;

  delete from public.program_policy_categories
  where policy_version_id = p_policy_version_id;

  for item in select value from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) loop
    insert into public.program_policy_categories (
      policy_version_id,
      category_key,
      category_name,
      raw_category_name,
      review_status,
      sort_order,
      source_reference
    ) values (
      p_policy_version_id,
      item ->> 'categoryKey',
      item ->> 'categoryName',
      nullif(item ->> 'rawCategoryName', ''),
      item ->> 'reviewStatus',
      coalesce(nullif(item ->> 'sortOrder', '')::integer, 0),
      coalesce(item -> 'sourceReference', '{}'::jsonb)
    );
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_subcategories, '[]'::jsonb)) loop
    select id
    into category_id
    from public.program_policy_categories
    where policy_version_id = p_policy_version_id
      and category_key = item ->> 'categoryKey';

    if category_id is null then
      raise exception 'POLICY_CATEGORY_NOT_FOUND'
        using errcode = 'P0002';
    end if;

    insert into public.program_policy_subcategories (
      policy_version_id,
      category_id,
      subcategory_key,
      subcategory_name,
      raw_subcategory_name,
      review_status,
      sort_order,
      source_reference
    ) values (
      p_policy_version_id,
      category_id,
      item ->> 'subcategoryKey',
      item ->> 'subcategoryName',
      nullif(item ->> 'rawSubcategoryName', ''),
      item ->> 'reviewStatus',
      coalesce(nullif(item ->> 'sortOrder', '')::integer, 0),
      coalesce(item -> 'sourceReference', '{}'::jsonb)
    );
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_evidence_requirements, '[]'::jsonb)) loop
    category_id := null;
    subcategory_id := null;

    if nullif(item ->> 'categoryKey', '') is not null then
      select id
      into category_id
      from public.program_policy_categories
      where policy_version_id = p_policy_version_id
        and category_key = item ->> 'categoryKey';

      if category_id is null then
        raise exception 'POLICY_CATEGORY_NOT_FOUND'
          using errcode = 'P0002';
      end if;
    end if;

    if nullif(item ->> 'subcategoryKey', '') is not null then
      select subcategories.id
      into subcategory_id
      from public.program_policy_subcategories subcategories
      join public.program_policy_categories categories
        on categories.id = subcategories.category_id
      where subcategories.policy_version_id = p_policy_version_id
        and categories.category_key = item ->> 'categoryKey'
        and subcategories.subcategory_key = item ->> 'subcategoryKey';

      if subcategory_id is null then
        raise exception 'POLICY_SUBCATEGORY_NOT_FOUND'
          using errcode = 'P0002';
      end if;
    end if;

    insert into public.program_policy_evidence_requirements (
      policy_version_id,
      category_id,
      subcategory_id,
      evidence_key,
      evidence_name,
      document_key,
      requirement_type,
      fulfillment_type,
      condition_text,
      sort_order,
      review_status,
      source_reference
    ) values (
      p_policy_version_id,
      category_id,
      subcategory_id,
      item ->> 'evidenceKey',
      item ->> 'evidenceName',
      coalesce(nullif(item ->> 'documentKey', ''), item ->> 'evidenceKey'),
      item ->> 'requirementType',
      item ->> 'fulfillmentType',
      nullif(item ->> 'conditionText', ''),
      coalesce(nullif(item ->> 'sortOrder', '')::integer, 0),
      item ->> 'reviewStatus',
      coalesce(item -> 'sourceReference', '{}'::jsonb)
    );
  end loop;
end;
$$;

revoke execute on function public.replace_program_policy_draft(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_program_policy_draft(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;

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
              'sort_order', evidence.sort_order,
              'source_reference', coalesce(evidence.source_reference, '{}'::jsonb)
            )
            order by
              case
                when evidence.category_id is null and evidence.subcategory_id is null then 0
                when evidence.subcategory_id is null then 1
                else 2
              end,
              evidence.sort_order,
              evidence.evidence_key
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
