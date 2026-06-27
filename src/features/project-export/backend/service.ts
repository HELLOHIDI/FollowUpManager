import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import { EXPENSE_STAGES } from "@/features/domain/contracts";
import type { Database } from "@/lib/supabase/types";
import { projectExportErrorCodes } from "./error";
import {
  ProjectExportResponseSchema,
  type ProjectExportQuery,
  type ProjectExportResponse,
} from "./schema";

type ProjectExportErrorCode = (typeof projectExportErrorCodes)[keyof typeof projectExportErrorCodes];

type ExpenseExportRow = {
  id: string;
  title: string;
  category_key: string;
  funding_source_key?: string | null;
  amount: number;
  stage_key: string;
  expected_spend_date: string | null;
  execution_request_date?: string | null;
  vendor_name?: string | null;
  memo: string | null;
  created_at: string;
};

const stageLabels = new Map(EXPENSE_STAGES.map((stage) => [stage.key, stage.label]));

const selectExpenseExportColumns =
  "id, title, category_key, funding_source_key, amount, stage_key, expected_spend_date, execution_request_date, vendor_name, memo, created_at";
const selectLegacyExpenseExportColumns =
  "id, title, category_key, amount, stage_key, expected_spend_date, execution_request_date, vendor_name, memo, created_at";

const isMissingFundingSourceColumnError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; details?: unknown; message?: unknown };
  const text = [candidate.code, candidate.details, candidate.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return text.includes("funding_source_key") && (text.includes("PGRST204") || text.includes("42703") || text.includes("schema cache"));
};

const applyExpenseExportFilters = (
  query: any,
  filters: ProjectExportQuery,
) => {
  let filtered = query
    .is("deleted_at", null)
    .order("expected_spend_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (filters.category) {
    filtered = filtered.eq("category_key", filters.category);
  }
  if (filters.stage) {
    filtered = filtered.eq("stage_key", filters.stage);
  }
  if (filters.from) {
    filtered = filtered.gte("expected_spend_date", filters.from);
  }
  if (filters.to) {
    filtered = filtered.lte("expected_spend_date", filters.to);
  }

  return filtered;
};

const fetchExpenseRows = async (
  client: SupabaseClient<Database>,
  projectId: string,
  filters: ProjectExportQuery,
) => {
  const baseQuery = client
    .from("expenses")
    .select(selectExpenseExportColumns)
    .eq("project_id", projectId);
  const result = await applyExpenseExportFilters(baseQuery, filters);

  if (!isMissingFundingSourceColumnError(result.error)) {
    return result as { data: ExpenseExportRow[] | null; error: unknown };
  }

  const fallbackQuery = client
    .from("expenses")
    .select(selectLegacyExpenseExportColumns)
    .eq("project_id", projectId);

  return (await applyExpenseExportFilters(fallbackQuery, filters)) as { data: ExpenseExportRow[] | null; error: unknown };
};

const mapCategoryNames = (rows: Array<{ category_key: string; category_name: string }>) =>
  new Map(rows.map((row) => [row.category_key, row.category_name]));

export const getProjectExport = async (
  client: SupabaseClient<Database>,
  projectId: string,
  filters: ProjectExportQuery,
): Promise<HandlerResult<ProjectExportResponse, ProjectExportErrorCode>> => {
  const [projectResult, categoryResult, expensesResult] = await Promise.all([
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
    fetchExpenseRows(client, projectId, filters),
  ]);

  if (projectResult.error || categoryResult.error || expensesResult.error) {
    return failure(500, projectExportErrorCodes.fetchError, "내보내기 데이터를 불러오지 못했습니다.");
  }

  if (!projectResult.data) {
    return failure(404, projectExportErrorCodes.notFound, "프로젝트를 찾을 수 없습니다.");
  }

  const categoryNames = mapCategoryNames(categoryResult.data ?? []);
  const rows = (expensesResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    categoryKey: row.category_key,
    categoryName: categoryNames.get(row.category_key) ?? row.category_key,
    fundingSourceKey: row.funding_source_key ?? "government_subsidy",
    amount: row.amount,
    stageKey: row.stage_key,
    stageLabel: stageLabels.get(row.stage_key as (typeof EXPENSE_STAGES)[number]["key"]) ?? row.stage_key,
    expectedSpendDate: row.expected_spend_date,
    executionRequestDate: row.execution_request_date ?? null,
    vendorName: row.vendor_name ?? null,
    memo: row.memo,
    createdAt: row.created_at,
  }));

  const response = ProjectExportResponseSchema.safeParse({
    project: {
      id: projectResult.data.id,
      name: projectResult.data.project_name,
    },
    filters: {
      category: filters.category ?? null,
      from: filters.from ?? null,
      stage: filters.stage ?? null,
      to: filters.to ?? null,
    },
    categoryOptions: [...categoryNames.entries()].map(([categoryKey, categoryName]) => ({ categoryKey, categoryName })),
    stageOptions: EXPENSE_STAGES.map((stage) => ({ stageKey: stage.key, label: stage.label })),
    rows,
  });

  return response.success
    ? success(response.data)
    : failure(409, projectExportErrorCodes.integrity, "내보내기 데이터 형식을 확인해 주세요.");
};
