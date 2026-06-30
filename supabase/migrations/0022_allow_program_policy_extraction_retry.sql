-- Allow a failed policy extraction version to be re-extracted into a draft.

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
      and status in ('confirmed', 'archived')
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
      item ->> 'reviewStatus',
      coalesce(item -> 'sourceReference', '{}'::jsonb)
    );
  end loop;
end;
$$;

revoke execute on function public.replace_program_policy_draft(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_program_policy_draft(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;
