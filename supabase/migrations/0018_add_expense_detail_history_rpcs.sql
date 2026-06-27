-- Add atomic expense detail/history mutation helpers for Slice 4.

alter table public.expense_history_events
  drop constraint if exists expense_history_events_event_type_check;

alter table public.expense_history_events
  add constraint expense_history_events_event_type_check
  check (event_type in (
    'expense_created',
    'expense_updated',
    'stage_changed',
    'category_changed',
    'amount_changed',
    'approval_status_changed',
    'execution_status_changed',
    'execution_request_status_changed',
    'evidence_uploaded',
    'evidence_deleted',
    'memo_updated',
    'stage_field_updated'
  ));

create or replace function public.update_expense_with_history(
  p_expense_id uuid,
  p_project_id uuid,
  p_project_budget_category_id uuid,
  p_category_key text,
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
    project_budget_category_id = p_project_budget_category_id,
    category_key = p_category_key,
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

create or replace function public.update_expense_stage_with_history(
  p_expense_id uuid,
  p_project_id uuid,
  p_current_stage_key text,
  p_target_stage_key text,
  p_changed_by uuid default null
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.expenses%rowtype;
begin
  update public.expenses
  set
    stage_key = p_target_stage_key,
    updated_at = now()
  where id = p_expense_id
    and project_id = p_project_id
    and stage_key = p_current_stage_key
    and deleted_at is null
  returning * into updated_row;

  if not found then
    raise exception 'EXPENSE_NOT_FOUND_OR_STALE_STAGE'
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
    'stage_changed',
    p_changed_by,
    'Expense stage changed.',
    jsonb_build_object('stageKey', p_current_stage_key),
    jsonb_build_object('stageKey', p_target_stage_key)
  );

  return updated_row;
end;
$$;

revoke execute on function public.update_expense_with_history(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  date,
  text,
  text,
  text,
  text,
  text,
  date,
  jsonb,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.update_expense_with_history(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  date,
  text,
  text,
  text,
  text,
  text,
  date,
  jsonb,
  uuid,
  text
) to service_role;

revoke execute on function public.update_expense_stage_with_history(
  uuid,
  uuid,
  text,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.update_expense_stage_with_history(
  uuid,
  uuid,
  text,
  text,
  uuid
) to service_role;

comment on function public.update_expense_with_history is
  'Updates Slice 4 expense detail fields and appends one summarized expense_updated history event atomically.';

comment on function public.update_expense_stage_with_history is
  'Updates an expense stage and appends one stage_changed history event atomically.';
