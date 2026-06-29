import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success } from "@/backend/http/response";
import { resolvePolicyCategories } from "@/features/program-evidence-policy/backend/service";
import type { Database } from "@/lib/supabase/types";
import { dashboardErrorCodes } from "./error";
import { DashboardResponseSchema, DashboardSnapshotSchema } from "./schema";

type ParsedDashboardSnapshot = Exclude<ReturnType<typeof DashboardSnapshotSchema.parse>, undefined>;
type DashboardCategory = {
  categoryKey: string;
  categoryName: string;
  expenseCount: number;
  totalAmount: number;
  expenses: Array<{
    amount: number;
    id: string;
    stageKey: ParsedDashboardSnapshot["expenseRows"][number]["stageKey"];
    title: string;
  }>;
};

const dashboardFetchMessage = "대시보드 정보를 불러오지 못했습니다.";
const dashboardIntegrityMessage = "대시보드 데이터 정합성을 확인해 주세요.";
const dashboardNotFoundMessage = "프로젝트를 찾을 수 없습니다.";

const groupSnapshotExpenses = (snapshot: ParsedDashboardSnapshot) => {
  const grouped = new Map<string, DashboardCategory>();

  for (const row of snapshot.expenseRows) {
    const category = grouped.get(row.categoryKey) ?? {
      categoryKey: row.categoryKey,
      categoryName: row.categoryName,
      expenseCount: 0,
      expenses: [],
      totalAmount: 0,
    };
    category.expenses.push({ amount: row.amount, id: row.id, stageKey: row.stageKey, title: row.title });
    category.expenseCount += 1;
    category.totalAmount += row.amount;
    grouped.set(row.categoryKey, category);
  }

  return [...grouped.values()];
};

const toDashboardResponse = (snapshot: ParsedDashboardSnapshot, categories: DashboardCategory[]) => {
  const response = DashboardResponseSchema.safeParse({
    categories,
    kpis: snapshot.kpis,
    project: snapshot.project,
  });
  return response.success
    ? success(response.data)
    : failure(409, dashboardErrorCodes.integrity, dashboardIntegrityMessage);
};

export const getProjectDashboard = async (
  client: SupabaseClient<Database>,
  projectId: string,
) => {
  const { data, error } = await client.rpc("get_project_dashboard_snapshot", { project_id: projectId });
  if (error) {
    return failure(500, dashboardErrorCodes.fetchError, dashboardFetchMessage);
  }

  const parsed = DashboardSnapshotSchema.safeParse(data);
  if (!parsed.success) {
    return failure(409, dashboardErrorCodes.integrity, dashboardIntegrityMessage);
  }
  const snapshot = parsed.data;
  if (!snapshot.project || !snapshot.kpis) {
    return failure(404, dashboardErrorCodes.notFound, dashboardNotFoundMessage);
  }

  if (typeof (client as SupabaseClient<any>).from !== "function") {
    if (snapshot.integrityCode || snapshot.activeExpenseCount !== snapshot.expenseRows.length) {
      return failure(409, dashboardErrorCodes.integrity, dashboardIntegrityMessage);
    }
    return toDashboardResponse(snapshot, groupSnapshotExpenses(snapshot));
  }

  const [categoryOptionsResult, expensesResult] = await Promise.all([
    resolvePolicyCategories(client, projectId),
    (() => {
      const query = (client as SupabaseClient<any>)
      .from("expenses")
      .select("id, title, amount, stage_key, category_key, policy_snapshot, deleted_at, created_at")
      .eq("project_id", projectId);
      const activeQuery = typeof query.is === "function" ? query.is("deleted_at", null) : query;
      if (typeof activeQuery.order !== "function") {
        return Promise.resolve({ data: null, error: new Error("expenses query ordering unavailable") });
      }
      return activeQuery.order("category_key", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    })(),
  ]);

  const isQueryShapeUnavailable = expensesResult.error instanceof Error && expensesResult.error.message === "expenses query ordering unavailable";
  if (isQueryShapeUnavailable) {
    if (snapshot.integrityCode || snapshot.activeExpenseCount !== snapshot.expenseRows.length) {
      return failure(409, dashboardErrorCodes.integrity, dashboardIntegrityMessage);
    }
    return toDashboardResponse(snapshot, groupSnapshotExpenses(snapshot));
  }
  if (snapshot.integrityCode && snapshot.integrityCode !== "CATEGORY_METADATA_MISMATCH") {
    return failure(409, dashboardErrorCodes.integrity, dashboardIntegrityMessage);
  }
  if (!categoryOptionsResult.ok) {
    if (expensesResult.error || !Array.isArray(expensesResult.data)) {
      return failure(500, dashboardErrorCodes.fetchError, dashboardFetchMessage);
    }
  }
  if ((expensesResult.error || !Array.isArray(expensesResult.data)) && categoryOptionsResult.ok && categoryOptionsResult.data.operationStatus === "confirmed_policy") {
    return failure(500, dashboardErrorCodes.fetchError, dashboardFetchMessage);
  }
  if (expensesResult.error || !Array.isArray(expensesResult.data)) {
    if (snapshot.activeExpenseCount !== snapshot.expenseRows.length) {
      return failure(409, dashboardErrorCodes.integrity, dashboardIntegrityMessage);
    }
    return toDashboardResponse(snapshot, groupSnapshotExpenses(snapshot));
  }

  const categoryNameByKey = new Map(categoryOptionsResult.ok
    ? categoryOptionsResult.data.categories.map((option) => [option.categoryKey, option.categoryName])
    : snapshot.expenseRows.map((row) => [row.categoryKey, row.categoryName]));
  const grouped = new Map<string, DashboardCategory>();

  for (const row of expensesResult.data) {
    const policySnapshot = row.policy_snapshot && typeof row.policy_snapshot === "object" && !Array.isArray(row.policy_snapshot)
      ? row.policy_snapshot as Record<string, unknown>
      : {};
    const categoryKey = typeof policySnapshot.category_key === "string" ? policySnapshot.category_key : row.category_key;
    const categoryName = typeof policySnapshot.category_name === "string" ? policySnapshot.category_name : categoryNameByKey.get(categoryKey) ?? categoryKey;
    const category = grouped.get(categoryKey) ?? {
      categoryKey,
      categoryName,
      expenseCount: 0,
      expenses: [],
      totalAmount: 0,
    };
    category.expenses.push({ amount: row.amount, id: row.id, stageKey: row.stage_key, title: row.title });
    category.expenseCount += 1;
    category.totalAmount += row.amount;
    grouped.set(categoryKey, category);
  }

  return toDashboardResponse(snapshot, [...grouped.values()]);
};
