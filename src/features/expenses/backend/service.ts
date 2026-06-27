import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import type { Database, Json } from "@/lib/supabase/types";
import {
  EXPENSE_FUNDING_SOURCE_OPTIONS,
  getBudgetCategoryPolicySortOrder,
  isImmediateForwardExpenseStage,
  type ExpenseStageKey,
} from "@/features/domain/contracts";
import { expenseErrorCodes } from "./error";
import {
  ExpenseCreateInputSchema,
  ExpenseDetailResponseSchema,
  ExpenseEvidenceDeleteResponseSchema,
  ExpenseEvidenceFileResponseSchema,
  ExpenseEvidenceListResponseSchema,
  ExpenseEvidenceSignedUrlResponseSchema,
  ExpenseEvidenceUploadInputSchema,
  EXPENSE_EVIDENCE_BUCKET,
  ExpenseHistoryResponseSchema,
  ExpensePageResponseSchema,
  ExpenseResponseSchema,
  ExpenseStageUpdateInputSchema,
  ExpenseUpdateInputSchema,
  getEvidenceFileMetadata,
  type ExpenseDetailResponse,
  type ExpenseEvidenceFileResponse,
  type ExpenseEvidenceListResponse,
  type ExpenseEvidenceSignedUrlResponse,
  type ExpenseEvidenceUploadInput,
  type ExpenseHistoryResponse,
  type ExpensePageResponse,
  type ExpenseResponse,
  type ExpenseCreateInput,
  type ExpenseStageUpdateInput,
  type ExpenseUpdateInput,
} from "./schema";

type ExpenseCategoryOption = {
  categoryKey: string;
  categoryName: string;
  sortOrder: number;
};

type ExpenseCategoryGroup = {
  categoryKey: string;
  categoryName: string;
  expenseCount: number;
  totalAmount: number;
  expenses: Array<{ id: string; title: string; amount: number; stageKey: ExpenseStageKey }>;
};

type ExpenseErrorCode = (typeof expenseErrorCodes)[keyof typeof expenseErrorCodes];
type EvidenceRow = Database["public"]["Tables"]["expense_evidence_files"]["Row"];
type EvidenceFileLike = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type?: string;
};

type ResolveProjectBudgetCategoryResult =
  | { data: string }
  | { error: unknown }
  | { unavailable: true };

const defaultFundingSourceKey = "government_subsidy" as const;
const stageFieldKeys = {
  approvalReference: "approval_reference",
  deliverableMemo: "deliverable_memo",
  executionMemo: "execution_memo",
  executionRequestMemo: "execution_request_memo",
  preApprovalMemo: "pre_approval_memo",
} as const;

type ExpenseRow = {
  id: string;
  project_id: string;
  project_budget_category_id: string;
  category_key: string;
  funding_source_key?: string | null;
  title: string;
  amount: number;
  stage_key: string;
  expected_spend_date: string | null;
  vendor_name?: string | null;
  memo: string | null;
  pre_approval_status?: string | null;
  execution_progress_status?: string | null;
  execution_request_status?: string | null;
  execution_request_date?: string | null;
  stage_fields?: unknown;
  deleted_at?: string | null;
};

const resolveFundingSourceKey = (fundingSourceKey: string | null | undefined, stageFields: unknown) => {
  if (fundingSourceKey === "government_subsidy" || fundingSourceKey === "self_cash" || fundingSourceKey === "self_in_kind") {
    return fundingSourceKey;
  }

  if (!stageFields || typeof stageFields !== "object" || Array.isArray(stageFields)) {
    return defaultFundingSourceKey;
  }

  const raw = (stageFields as Record<string, unknown>).funding_source_key;
  return raw === "government_subsidy" || raw === "self_cash" || raw === "self_in_kind"
    ? raw
    : defaultFundingSourceKey;
};

const readStageField = (stageFields: unknown, key: string) => {
  if (!stageFields || typeof stageFields !== "object" || Array.isArray(stageFields)) {
    return null;
  }
  const value = (stageFields as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
};

const mapStageFields = (stageFields: unknown) => ({
  approvalReference: readStageField(stageFields, stageFieldKeys.approvalReference),
  deliverableMemo: readStageField(stageFields, stageFieldKeys.deliverableMemo),
  executionMemo: readStageField(stageFields, stageFieldKeys.executionMemo),
  executionRequestMemo: readStageField(stageFields, stageFieldKeys.executionRequestMemo),
  preApprovalMemo: readStageField(stageFields, stageFieldKeys.preApprovalMemo),
});

const toDatabaseStageFields = (stageFields: ExpenseUpdateInput["stageFields"]) =>
  Object.fromEntries(
    Object.entries(stageFieldKeys)
      .map(([apiKey, databaseKey]) => [databaseKey, stageFields[apiKey as keyof typeof stageFieldKeys] ?? null])
      .filter(([, value]) => value !== null && value !== ""),
  );

const mapCategoryOptions = (rows: Array<{ category_key: string; category_name: string }>) =>
  rows
    .map((row) => ({
      categoryKey: row.category_key,
      categoryName: row.category_name,
      sortOrder: getBudgetCategoryPolicySortOrder(row.category_key),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.categoryKey.localeCompare(right.categoryKey));

const resolveProjectBudgetCategoryId = async (
  client: SupabaseClient<Database>,
  projectId: string,
  categoryKey: string,
): Promise<ResolveProjectBudgetCategoryResult> => {
  const { data: categoryRow, error: categoryError } = await client
    .from("project_budget_categories")
    .select("id, deleted_at, is_active")
    .eq("project_id", projectId)
    .eq("category_key", categoryKey)
    .maybeSingle();

  if (categoryError) {
    return { error: categoryError };
  }

  if (categoryRow && !categoryRow.deleted_at && categoryRow.is_active) {
    return { data: categoryRow.id };
  }

  if (categoryRow) {
    return { unavailable: true };
  }

  const { data: templateRow, error: templateError } = await client
    .from("budget_category_policy_templates")
    .select("category_key, is_active")
    .eq("category_key", categoryKey)
    .maybeSingle();

  if (templateError) {
    return { error: templateError };
  }

  if (!templateRow || !templateRow.is_active) {
    return { unavailable: true };
  }

  const { data: insertedRow, error: insertError } = await client
    .from("project_budget_categories")
    .insert({
      project_id: projectId,
      category_key: categoryKey,
      sort_order: getBudgetCategoryPolicySortOrder(categoryKey),
      is_active: true,
    })
    .select("id")
    .single();

  if (!insertError && insertedRow) {
    return { data: insertedRow.id };
  }

  const { data: retryRow, error: retryError } = await client
    .from("project_budget_categories")
    .select("id, deleted_at, is_active")
    .eq("project_id", projectId)
    .eq("category_key", categoryKey)
    .maybeSingle();

  if (retryError) {
    return { error: retryError };
  }

  if (retryRow && !retryRow.deleted_at && retryRow.is_active) {
    return { data: retryRow.id };
  }

  return { error: insertError ?? new Error("failed to create project budget category") };
};

const mapExpenseResponse = (row: ExpenseRow) =>
  ExpenseResponseSchema.safeParse({
    id: row.id,
    projectId: row.project_id,
    projectBudgetCategoryId: row.project_budget_category_id,
    categoryKey: row.category_key,
    fundingSourceKey: resolveFundingSourceKey(row.funding_source_key, row.stage_fields),
    title: row.title,
    amount: row.amount,
    stageKey: row.stage_key,
    expectedSpendDate: row.expected_spend_date,
    vendorName: row.vendor_name ?? null,
    memo: row.memo,
    preApprovalStatus: row.pre_approval_status ?? null,
    executionProgressStatus: row.execution_progress_status ?? null,
    executionRequestStatus: row.execution_request_status ?? null,
    executionRequestDate: row.execution_request_date ?? null,
    stageFields: mapStageFields(row.stage_fields),
  });

const mapHistoryResponse = (
  rows: Array<{
    after_value: Record<string, unknown> | null;
    before_value: Record<string, unknown> | null;
    changed_at: string;
    changed_by: string | null;
    event_type: string;
    expense_id: string;
    id: string;
    summary: string;
  }>,
) =>
  ExpenseHistoryResponseSchema.safeParse({
    events: rows.map((row) => ({
      afterValue: row.after_value,
      beforeValue: row.before_value,
      changedAt: row.changed_at,
      changedBy: row.changed_by,
      eventType: row.event_type,
      expenseId: row.expense_id,
      id: row.id,
      summary: row.summary,
    })),
  });

const selectExpenseDetailColumns =
  "id, project_id, project_budget_category_id, category_key, funding_source_key, title, amount, stage_key, expected_spend_date, vendor_name, memo, pre_approval_status, execution_progress_status, execution_request_status, execution_request_date, deleted_at, stage_fields";

const selectLegacyExpenseDetailColumns =
  "id, project_id, project_budget_category_id, category_key, title, amount, stage_key, expected_spend_date, vendor_name, memo, pre_approval_status, execution_progress_status, execution_request_status, execution_request_date, deleted_at, stage_fields";
const selectEvidenceColumns =
  "id, project_id, expense_id, document_key, requirement_key, original_file_name, file_size, mime_type, file_extension, uploaded_at, deleted_at, storage_path";

type ExpenseSelectResult = {
  data: ExpenseRow | null;
  error: unknown;
};

const isMissingFundingSourceColumnError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; details?: unknown; message?: unknown };
  const text = [candidate.code, candidate.details, candidate.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return text.includes("funding_source_key") && (text.includes("PGRST204") || text.includes("42703") || text.includes("schema cache"));
};

const isStaleStageError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; details?: unknown; message?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const details = typeof candidate.details === "string" ? candidate.details : "";

  return candidate.code === "P0002" && `${message} ${details}`.includes("EXPENSE_NOT_FOUND_OR_STALE_STAGE");
};

const sanitizeStoredFileName = (fileName: string) => {
  const trimmed = fileName.trim();
  const extension = trimmed.split(".").pop()?.toLowerCase() ?? "file";
  const base = trimmed.slice(0, Math.max(0, trimmed.length - extension.length - 1));
  const safeBase = base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return `${safeBase || "evidence"}.${extension}`;
};

const duplicateKey = (row: Pick<EvidenceRow, "document_key" | "file_size" | "mime_type" | "original_file_name">) =>
  [row.document_key, row.original_file_name.trim().toLowerCase(), row.file_size ?? "", row.mime_type ?? ""].join("\u001f");

const mapEvidenceResponse = (row: EvidenceRow, duplicateStatus: "none" | "possible_duplicate" = "none") =>
  ExpenseEvidenceFileResponseSchema.safeParse({
    documentKey: row.document_key,
    duplicateStatus,
    expenseId: row.expense_id,
    fileExtension: row.file_extension ?? "",
    fileSize: row.file_size ?? 0,
    id: row.id,
    mimeType: row.mime_type ?? "",
    originalFileName: row.original_file_name,
    projectId: row.project_id,
    requirementKey: row.requirement_key ?? null,
    uploadedAt: row.uploaded_at,
  });

const resolveActiveExpenseContext = async (client: SupabaseClient<Database>, projectId: string, expenseId: string) => {
  const [projectResult, expenseResult] = await Promise.all([
    client.from("projects").select("id, company_id, deleted_at").eq("id", projectId).maybeSingle(),
    client.from("expenses").select("id, project_id, deleted_at").eq("id", expenseId).eq("project_id", projectId).maybeSingle(),
  ]);

  if (projectResult.error || expenseResult.error) {
    return failure(500, expenseErrorCodes.fetchError, "지출 정보를 확인하지 못했습니다.");
  }

  if (!projectResult.data || projectResult.data.deleted_at || !expenseResult.data || expenseResult.data.deleted_at) {
    return failure(404, expenseErrorCodes.notFound, "지출을 찾을 수 없습니다.");
  }

  return success({ companyId: projectResult.data.company_id });
};

const getActiveEvidenceRow = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
  evidenceId: string,
): Promise<HandlerResult<EvidenceRow, ExpenseErrorCode>> => {
  const context = await resolveActiveExpenseContext(client, projectId, expenseId);
  if (context.ok === false) {
    return failure(context.status, context.error.code, context.error.message, context.error.details);
  }

  const { data, error } = await client
    .from("expense_evidence_files")
    .select(selectEvidenceColumns)
    .eq("id", evidenceId)
    .eq("project_id", projectId)
    .eq("expense_id", expenseId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return failure(500, expenseErrorCodes.fetchError, "증빙 파일을 불러오지 못했습니다.");
  }

  if (!data) {
    return failure(404, expenseErrorCodes.notFound, "증빙 파일을 찾을 수 없습니다.");
  }

  return success(data as EvidenceRow);
};

const fetchExpenseDetailRow = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
): Promise<ExpenseSelectResult> => {
  const result = await client
    .from("expenses")
    .select(selectExpenseDetailColumns)
    .eq("id", expenseId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!isMissingFundingSourceColumnError(result.error)) {
    return result as ExpenseSelectResult;
  }

  const fallbackResult = await client
    .from("expenses")
    .select(selectLegacyExpenseDetailColumns)
    .eq("id", expenseId)
    .eq("project_id", projectId)
    .maybeSingle();

  return fallbackResult as ExpenseSelectResult;
};

export const listProjectExpensesPage = async (
  client: SupabaseClient<Database>,
  projectId: string,
): Promise<HandlerResult<ExpensePageResponse, ExpenseErrorCode>> => {
  const [projectResult, templatesResult, expensesResult, activeExpenseCountResult] = await Promise.all([
    client
      .from("projects")
      .select("id, project_name, deleted_at")
      .eq("id", projectId)
      .is("deleted_at", null)
      .maybeSingle(),
    client
      .from("budget_category_policy_templates")
      .select("category_key, category_name")
      .eq("is_active", true)
      .order("category_key", { ascending: true }),
    client
      .from("project_expenses_by_category")
      .select("category_key, category_name, sort_order, expense_id, title, amount, stage_key")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("category_key", { ascending: true })
      .order("created_at", { ascending: true })
      .order("expense_id", { ascending: true }),
    client
      .from("expenses")
      .select("id, deleted_at", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);

  if (projectResult.error || templatesResult.error || expensesResult.error || activeExpenseCountResult.error) {
    return failure(500, expenseErrorCodes.fetchError, "지출 목록을 불러오지 못했습니다.");
  }

  if (!projectResult.data) {
    return failure(404, expenseErrorCodes.notFound, "프로젝트를 찾을 수 없습니다.");
  }

  const categoryOptions = mapCategoryOptions(templatesResult.data ?? []);
  if (categoryOptions.length === 0) {
    return failure(409, expenseErrorCodes.integrity, "비목 정책 정보를 확인해 주세요.");
  }

  const expenseRows = Array.isArray(expensesResult.data) ? expensesResult.data : [];
  const grouped = new Map<string, ExpenseCategoryGroup>();
  for (const row of expenseRows) {
    const category = grouped.get(row.category_key) ?? {
      categoryKey: row.category_key,
      categoryName: row.category_name,
      expenseCount: 0,
      totalAmount: 0,
      expenses: [],
    };
    category.expenses.push({
      id: row.expense_id,
      title: row.title,
      amount: row.amount,
      stageKey: row.stage_key as ExpenseStageKey,
    });
    category.expenseCount += 1;
    category.totalAmount += row.amount;
    grouped.set(row.category_key, category);
  }

  if ((activeExpenseCountResult.count ?? 0) !== expenseRows.length) {
    return failure(409, expenseErrorCodes.integrity, "비목별 지출 데이터를 확인해 주세요.");
  }

  const response = ExpensePageResponseSchema.safeParse({
    project: {
      id: projectResult.data.id,
      name: projectResult.data.project_name,
    },
    categoryOptions,
    fundingSourceOptions: EXPENSE_FUNDING_SOURCE_OPTIONS,
    categories: [...grouped.values()],
  });

  return response.success
    ? success(response.data)
    : failure(409, expenseErrorCodes.integrity, "비목별 지출 데이터를 확인해 주세요.");
};

export const createExpense = async (
  client: SupabaseClient<Database>,
  projectId: string,
  input: ExpenseCreateInput,
): Promise<HandlerResult<ExpenseResponse, ExpenseErrorCode>> => {
  const parsed = ExpenseCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure(400, expenseErrorCodes.invalidBody, "지출 입력값을 확인해 주세요.", parsed.error.flatten());
  }

  const { data: projectRow, error: projectError } = await client
    .from("projects")
    .select("id, deleted_at")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectError) {
    return failure(500, expenseErrorCodes.fetchError, "지출을 등록하지 못했습니다.");
  }

  if (!projectRow) {
    return failure(404, expenseErrorCodes.notFound, "프로젝트를 찾을 수 없습니다.");
  }

  const resolvedCategory = await resolveProjectBudgetCategoryId(client, projectId, parsed.data.categoryKey);
  if ("error" in resolvedCategory) {
    return failure(500, expenseErrorCodes.fetchError, "지출을 등록하지 못했습니다.");
  }

  if ("unavailable" in resolvedCategory) {
    return failure(409, expenseErrorCodes.categoryMismatch, "선택한 비목을 사용할 수 없습니다.");
  }

  const { data, error } = await client
    .from("expenses")
    .insert({
      project_id: projectId,
      project_budget_category_id: resolvedCategory.data,
      category_key: parsed.data.categoryKey,
      funding_source_key: parsed.data.fundingSourceKey,
      stage_fields: {},
      title: parsed.data.title,
      amount: parsed.data.amount,
      stage_key: "budget_registration" as ExpenseStageKey,
      expected_spend_date: parsed.data.expectedSpendDate ?? null,
      memo: parsed.data.memo ?? null,
    })
    .select(selectExpenseDetailColumns)
    .single();

  if (error || !data) {
    return failure(500, expenseErrorCodes.fetchError, "지출을 등록하지 못했습니다.");
  }

  const response = mapExpenseResponse(data);

  return response.success
    ? success(response.data, 201)
    : failure(409, expenseErrorCodes.integrity, "지출 응답 형식을 확인해 주세요.");
};

export const getExpenseDetail = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
): Promise<HandlerResult<ExpenseDetailResponse, ExpenseErrorCode>> => {
  const [expenseResult, templatesResult] = await Promise.all([
    fetchExpenseDetailRow(client, projectId, expenseId),
    client
      .from("budget_category_policy_templates")
      .select("category_key, category_name")
      .eq("is_active", true)
      .order("category_key", { ascending: true }),
  ]);

  if (expenseResult.error || templatesResult.error) {
    return failure(500, expenseErrorCodes.fetchError, "지출 정보를 불러오지 못했습니다.");
  }

  if (!expenseResult.data || expenseResult.data.deleted_at) {
    return failure(404, expenseErrorCodes.notFound, "지출을 찾을 수 없습니다.");
  }

  const expense = mapExpenseResponse(expenseResult.data);
  if (!expense.success) {
    return failure(409, expenseErrorCodes.integrity, "지출 응답 형식을 확인해 주세요.");
  }

  const response = ExpenseDetailResponseSchema.safeParse({
    ...expense.data,
    categoryOptions: mapCategoryOptions(templatesResult.data ?? []),
  });

  return response.success
    ? success(response.data)
    : failure(409, expenseErrorCodes.integrity, "지출 응답 형식을 확인해 주세요.");
};

export const getExpenseHistory = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
): Promise<HandlerResult<ExpenseHistoryResponse, ExpenseErrorCode>> => {
  const { data: expenseRow, error: expenseError } = await client
    .from("expenses")
    .select("id, deleted_at")
    .eq("id", expenseId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (expenseError) {
    return failure(500, expenseErrorCodes.fetchError, "지출 이력을 불러오지 못했습니다.");
  }

  if (!expenseRow || expenseRow.deleted_at) {
    return failure(404, expenseErrorCodes.notFound, "지출을 찾을 수 없습니다.");
  }

  const { data, error } = await client
    .from("expense_history_events")
    .select("id, expense_id, event_type, changed_by, changed_at, summary, before_value, after_value")
    .eq("expense_id", expenseId)
    .order("changed_at", { ascending: false })
    .limit(10);

  if (error) {
    return failure(500, expenseErrorCodes.fetchError, "지출 이력을 불러오지 못했습니다.");
  }

  const response = mapHistoryResponse((data ?? []) as Parameters<typeof mapHistoryResponse>[0]);
  return response.success
    ? success(response.data)
    : failure(409, expenseErrorCodes.integrity, "지출 이력 응답 형식을 확인해 주세요.");
};

export const updateExpense = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
  input: ExpenseUpdateInput,
): Promise<HandlerResult<ExpenseResponse, ExpenseErrorCode>> => {
  const parsed = ExpenseUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure(400, expenseErrorCodes.invalidBody, "지출 입력값을 확인해 주세요.", parsed.error.flatten());
  }

  const { data: existingRow, error: fetchError } = await fetchExpenseDetailRow(client, projectId, expenseId);

  if (fetchError) {
    return failure(500, expenseErrorCodes.fetchError, "지출을 수정하지 못했습니다.");
  }

  if (!existingRow || existingRow.deleted_at) {
    return failure(404, expenseErrorCodes.notFound, "지출을 찾을 수 없습니다.");
  }

  const existing = mapExpenseResponse(existingRow);
  if (!existing.success) {
    return failure(409, expenseErrorCodes.integrity, "지출 응답 형식을 확인해 주세요.");
  }

  const resolvedCategory = await resolveProjectBudgetCategoryId(client, projectId, parsed.data.categoryKey);
  if ("error" in resolvedCategory) {
    return failure(500, expenseErrorCodes.fetchError, "지출을 수정하지 못했습니다.");
  }

  if ("unavailable" in resolvedCategory) {
    return failure(409, expenseErrorCodes.categoryMismatch, "선택한 비목을 사용할 수 없습니다.");
  }

  const { data, error } = await client.rpc("update_expense_with_history", {
    p_amount: parsed.data.amount,
    p_category_key: parsed.data.categoryKey,
    p_changed_by: null,
    p_execution_progress_status: parsed.data.executionProgressStatus,
    p_execution_request_date: parsed.data.executionRequestDate,
    p_execution_request_status: parsed.data.executionRequestStatus,
    p_expected_spend_date: parsed.data.expectedSpendDate,
    p_expense_id: expenseId,
    p_funding_source_key: parsed.data.fundingSourceKey,
    p_history_summary: "지출 정보를 수정했습니다.",
    p_memo: parsed.data.memo,
    p_pre_approval_status: parsed.data.preApprovalStatus,
    p_project_budget_category_id: resolvedCategory.data,
    p_project_id: projectId,
    p_stage_fields: toDatabaseStageFields(parsed.data.stageFields) as Json,
    p_title: parsed.data.title,
    p_vendor_name: parsed.data.vendorName,
  });

  if (error || !data) {
    return failure(500, expenseErrorCodes.fetchError, "지출을 수정하지 못했습니다.");
  }

  const response = mapExpenseResponse(data);
  return response.success
    ? success(response.data)
    : failure(409, expenseErrorCodes.integrity, "지출 응답 형식을 확인해 주세요.");
};

export const updateExpenseStage = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
  input: ExpenseStageUpdateInput,
): Promise<HandlerResult<ExpenseResponse, ExpenseErrorCode>> => {
  const parsed = ExpenseStageUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure(400, expenseErrorCodes.invalidBody, "지출 입력값을 확인해 주세요.", parsed.error.flatten());
  }

  const { data: existingRow, error: fetchError } = await fetchExpenseDetailRow(client, projectId, expenseId);

  if (fetchError) {
    return failure(500, expenseErrorCodes.fetchError, "지출 단계를 수정하지 못했습니다.");
  }

  if (!existingRow || existingRow.deleted_at) {
    return failure(404, expenseErrorCodes.notFound, "지출을 찾을 수 없습니다.");
  }

  const currentStageKey = existingRow.stage_key as ExpenseStageKey;
  if (!isImmediateForwardExpenseStage(currentStageKey, parsed.data.targetStageKey)) {
    return failure(409, expenseErrorCodes.invalidStageTransition, "지출은 바로 다음 단계로만 이동할 수 있습니다.");
  }

  const { data, error } = await client.rpc("update_expense_stage_with_history", {
    p_changed_by: null,
    p_current_stage_key: currentStageKey,
    p_expense_id: expenseId,
    p_project_id: projectId,
    p_target_stage_key: parsed.data.targetStageKey,
  });

  if (error || !data) {
    if (isStaleStageError(error)) {
      return failure(409, expenseErrorCodes.invalidStageTransition, "지출 단계가 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
    }
    return failure(500, expenseErrorCodes.fetchError, "지출 단계를 수정하지 못했습니다.");
  }

  const response = mapExpenseResponse(data);
  return response.success
    ? success(response.data)
    : failure(409, expenseErrorCodes.integrity, "지출 응답 형식을 확인해 주세요.");
};

export const listExpenseEvidence = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
): Promise<HandlerResult<ExpenseEvidenceListResponse, ExpenseErrorCode>> => {
  const context = await resolveActiveExpenseContext(client, projectId, expenseId);
  if (context.ok === false) {
    return failure(context.status, context.error.code, context.error.message, context.error.details);
  }

  const { data, error } = await client
    .from("expense_evidence_files")
    .select(selectEvidenceColumns)
    .eq("project_id", projectId)
    .eq("expense_id", expenseId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return failure(500, expenseErrorCodes.fetchError, "증빙 파일 목록을 불러오지 못했습니다.");
  }

  const rows = ((data ?? []) as EvidenceRow[]);
  const duplicateCounts = new Map<string, number>();
  for (const row of rows) {
    const key = duplicateKey(row);
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }

  const files: ExpenseEvidenceFileResponse[] = [];
  for (const row of rows) {
    const mapped = mapEvidenceResponse(row, (duplicateCounts.get(duplicateKey(row)) ?? 0) > 1 ? "possible_duplicate" : "none");
    if (!mapped.success) {
      return failure(409, expenseErrorCodes.integrity, "증빙 응답 형식을 확인해 주세요.");
    }
    files.push(mapped.data);
  }

  const response = ExpenseEvidenceListResponseSchema.safeParse({ files });
  return response.success
    ? success(response.data)
    : failure(409, expenseErrorCodes.integrity, "증빙 응답 형식을 확인해 주세요.");
};

export const uploadExpenseEvidence = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
  userId: string | null,
  input: ExpenseEvidenceUploadInput & { file: EvidenceFileLike },
): Promise<HandlerResult<ExpenseEvidenceFileResponse, ExpenseErrorCode>> => {
  const parsed = ExpenseEvidenceUploadInputSchema.safeParse({
    browserMimeType: input.browserMimeType,
    documentKey: input.documentKey,
    fileSize: input.fileSize,
    originalFileName: input.originalFileName,
    requirementKey: input.requirementKey ?? null,
  });

  if (!parsed.success) {
    return failure(400, expenseErrorCodes.evidenceInvalid, "증빙 파일을 확인해 주세요.", parsed.error.flatten());
  }

  const metadata = getEvidenceFileMetadata(parsed.data);
  if (!metadata) {
    return failure(400, expenseErrorCodes.evidenceInvalid, "증빙 파일 형식을 확인해 주세요.");
  }

  const context = await resolveActiveExpenseContext(client, projectId, expenseId);
  if (context.ok === false) {
    return failure(context.status, context.error.code, context.error.message, context.error.details);
  }

  const evidenceId = randomUUID();
  const sanitizedFileName = sanitizeStoredFileName(parsed.data.originalFileName);
  const storedFileName = `${evidenceId}-${sanitizedFileName}`;
  const storagePath = `companies/${context.data.companyId}/projects/${projectId}/expenses/${expenseId}/${parsed.data.documentKey}/${storedFileName}`;
  const body = new Uint8Array(await input.file.arrayBuffer());

  const upload = await client.storage.from(EXPENSE_EVIDENCE_BUCKET).upload(storagePath, body, {
    contentType: metadata.canonicalMimeType,
    upsert: false,
  });

  if (upload.error) {
    return failure(500, expenseErrorCodes.evidenceStorageError, "증빙 파일을 업로드하지 못했습니다.");
  }

  const { data, error } = await client.rpc("create_expense_evidence_with_history", {
    p_company_id: context.data.companyId,
    p_document_key: parsed.data.documentKey,
    p_expense_id: expenseId,
    p_file_extension: metadata.extension,
    p_file_size: parsed.data.fileSize,
    p_id: evidenceId,
    p_mime_type: metadata.canonicalMimeType,
    p_original_file_name: parsed.data.originalFileName,
    p_project_id: projectId,
    p_requirement_key: parsed.data.requirementKey ?? null,
    p_storage_path: storagePath,
    p_stored_file_name: storedFileName,
    p_uploaded_by: userId,
  });

  if (error || !data) {
    await client.storage.from(EXPENSE_EVIDENCE_BUCKET).remove([storagePath]);
    return failure(500, expenseErrorCodes.fetchError, "증빙 파일 정보를 저장하지 못했습니다.");
  }

  const { data: duplicateRows, error: duplicateError } = await client
    .from("expense_evidence_files")
    .select("id")
    .eq("expense_id", expenseId)
    .eq("document_key", parsed.data.documentKey)
    .eq("original_file_name", parsed.data.originalFileName)
    .eq("file_size", parsed.data.fileSize)
    .eq("mime_type", metadata.canonicalMimeType)
    .is("deleted_at", null);

  if (duplicateError) {
    return failure(500, expenseErrorCodes.fetchError, "증빙 파일 정보를 확인하지 못했습니다.");
  }

  const mapped = mapEvidenceResponse(data as EvidenceRow, (duplicateRows?.length ?? 0) > 1 ? "possible_duplicate" : "none");
  return mapped.success
    ? success(mapped.data, 201)
    : failure(409, expenseErrorCodes.integrity, "증빙 응답 형식을 확인해 주세요.");
};

export const createExpenseEvidenceSignedUrl = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
  evidenceId: string,
): Promise<HandlerResult<ExpenseEvidenceSignedUrlResponse, ExpenseErrorCode>> => {
  const rowResult = await getActiveEvidenceRow(client, projectId, expenseId, evidenceId);
  if (rowResult.ok === false) {
    return failure(rowResult.status, rowResult.error.code, rowResult.error.message, rowResult.error.details);
  }

  const { data, error } = await client.storage.from(EXPENSE_EVIDENCE_BUCKET).createSignedUrl(rowResult.data.storage_path, 60);
  if (error || !data) {
    return failure(500, expenseErrorCodes.evidenceStorageError, "증빙 파일 링크를 만들지 못했습니다.");
  }

  const response = ExpenseEvidenceSignedUrlResponseSchema.safeParse({ signedUrl: data.signedUrl });
  return response.success && response.data.signedUrl
    ? success({ signedUrl: response.data.signedUrl })
    : failure(409, expenseErrorCodes.integrity, "증빙 링크 응답 형식을 확인해 주세요.");
};

export const deleteExpenseEvidence = async (
  client: SupabaseClient<Database>,
  projectId: string,
  expenseId: string,
  evidenceId: string,
  userId: string | null,
): Promise<HandlerResult<{ id: string }, ExpenseErrorCode>> => {
  const rowResult = await getActiveEvidenceRow(client, projectId, expenseId, evidenceId);
  if (rowResult.ok === false) {
    return failure(rowResult.status, rowResult.error.code, rowResult.error.message, rowResult.error.details);
  }

  const { data, error } = await client.rpc("delete_expense_evidence_with_history", {
    p_changed_by: userId,
    p_evidence_id: evidenceId,
    p_expense_id: expenseId,
    p_project_id: projectId,
  });

  if (error) {
    return failure(500, expenseErrorCodes.fetchError, "증빙 파일을 삭제하지 못했습니다.");
  }

  const response = ExpenseEvidenceDeleteResponseSchema.safeParse({ id: data ?? evidenceId });
  return response.success && response.data.id
    ? success({ id: response.data.id })
    : failure(409, expenseErrorCodes.integrity, "증빙 삭제 응답 형식을 확인해 주세요.");
};
