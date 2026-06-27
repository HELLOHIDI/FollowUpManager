import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success } from "@/backend/http/response";
import type { Database } from "@/lib/supabase/types";
import { dashboardErrorCodes } from "./error";
import { DashboardResponseSchema, DashboardSnapshotSchema } from "./schema";

export const getProjectDashboard = async (
  client: SupabaseClient<Database>,
  projectId: string,
) => {
  const { data, error } = await client.rpc("get_project_dashboard_snapshot", { project_id: projectId });
  if (error) {
    return failure(500, dashboardErrorCodes.fetchError, "대시보드를 불러오지 못했습니다.");
  }

  const parsed = DashboardSnapshotSchema.safeParse(data);
  if (!parsed.success) {
    return failure(409, dashboardErrorCodes.integrity, "대시보드 데이터 무결성을 확인해 주세요.");
  }
  const snapshot = parsed.data;
  if (!snapshot.project || !snapshot.kpis) {
    return failure(404, dashboardErrorCodes.notFound, "프로젝트를 찾을 수 없습니다.");
  }
  if (snapshot.integrityCode || snapshot.activeExpenseCount !== snapshot.expenseRows.length) {
    return failure(409, dashboardErrorCodes.integrity, "대시보드 데이터 무결성을 확인해 주세요.");
  }

  const grouped = new Map<string, {
    categoryKey: string;
    categoryName: string;
    expenseCount: number;
    totalAmount: number;
    expenses: Array<{ id: string; title: string; amount: number; stageKey: typeof snapshot.expenseRows[number]["stageKey"] }>;
  }>();
  for (const row of snapshot.expenseRows) {
    const category = grouped.get(row.categoryKey) ?? {
      categoryKey: row.categoryKey,
      categoryName: row.categoryName,
      expenseCount: 0,
      totalAmount: 0,
      expenses: [],
    };
    category.expenses.push({ id: row.id, title: row.title, amount: row.amount, stageKey: row.stageKey });
    category.expenseCount += 1;
    category.totalAmount += row.amount;
    grouped.set(row.categoryKey, category);
  }

  const response = DashboardResponseSchema.safeParse({
    project: snapshot.project,
    kpis: snapshot.kpis,
    categories: [...grouped.values()],
  });
  return response.success
    ? success(response.data)
    : failure(409, dashboardErrorCodes.integrity, "대시보드 데이터 무결성을 확인해 주세요.");
};
