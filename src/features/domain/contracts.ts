import type { Database } from "@/lib/supabase/types";

type PublicTables = Database["public"]["Tables"];
type PublicViews = Database["public"]["Views"];

export const DOMAIN_RESOURCE_ORDER = [
  "companies",
  "projects",
  "project_budget_categories",
  "expenses",
  "expense_evidence_files",
  "expense_history_events",
] as const satisfies readonly (keyof PublicTables)[];

export const DASHBOARD_VIEW_NAMES = [
  "project_kpi_summary",
  "project_category_amount_summary",
  "project_kanban_stage_summary",
  "project_expenses_by_category",
  "project_expenses_by_stage",
] as const satisfies readonly (keyof PublicViews)[];

export const EXPENSE_STAGES = [
  { key: "budget_registration", label: "사업비 등록" },
  { key: "pre_approval", label: "사전 승인" },
  { key: "execution_in_progress", label: "집행 수행" },
  { key: "execution_request", label: "집행 요청" },
  { key: "execution_completed", label: "집행 완료" },
] as const;

export type ExpenseStageKey = (typeof EXPENSE_STAGES)[number]["key"];

const expenseStageOrder = new Map(
  EXPENSE_STAGES.map(({ key }, index) => [key, index] as const),
);

export const getExpenseStageIndex = (stageKey: ExpenseStageKey) =>
  expenseStageOrder.get(stageKey) ?? -1;

export const getNextExpenseStageKey = (stageKey: ExpenseStageKey) => {
  const nextStage = EXPENSE_STAGES[getExpenseStageIndex(stageKey) + 1];
  return nextStage?.key ?? null;
};

export const isImmediateForwardExpenseStage = (
  currentStageKey: ExpenseStageKey,
  targetStageKey: ExpenseStageKey,
) => getNextExpenseStageKey(currentStageKey) === targetStageKey;

export const isDifferentExpenseStage = (
  currentStageKey: ExpenseStageKey,
  targetStageKey: ExpenseStageKey,
) => currentStageKey !== targetStageKey;

export const BUDGET_CATEGORY_POLICY_KEYS = [
  "material_cost",
  "outsourcing_cost",
  "equipment_software",
  "intangible_asset_ip",
  "labor_cost",
  "service_fee",
  "travel_expense",
  "training_cost",
  "advertising_cost",
] as const;

export type BudgetCategoryKey = (typeof BUDGET_CATEGORY_POLICY_KEYS)[number];

const budgetCategoryPolicySortOrder = new Map(
  BUDGET_CATEGORY_POLICY_KEYS.map((key, index) => [key, index] as const),
);

export const getBudgetCategoryPolicySortOrder = (categoryKey: string) =>
  budgetCategoryPolicySortOrder.get(categoryKey as BudgetCategoryKey) ??
  Number.MAX_SAFE_INTEGER;

export const EXPENSE_FUNDING_SOURCE_KEYS = [
  "government_subsidy",
  "self_cash",
  "self_in_kind",
  "government_subsidy+self_cash",
  "government_subsidy+self_in_kind",
  "self_cash+self_in_kind",
  "government_subsidy+self_cash+self_in_kind",
] as const;

export type ExpenseFundingSourceKey =
  (typeof EXPENSE_FUNDING_SOURCE_KEYS)[number];

export const EXPENSE_FUNDING_SOURCE_BASE_KEYS = [
  "government_subsidy",
  "self_cash",
  "self_in_kind",
] as const;

export type ExpenseFundingSourceBaseKey =
  (typeof EXPENSE_FUNDING_SOURCE_BASE_KEYS)[number];

export const EXPENSE_FUNDING_SOURCE_OPTIONS = [
  { fundingSourceKey: "government_subsidy", label: "정부지원금" },
  { fundingSourceKey: "self_cash", label: "현금" },
  { fundingSourceKey: "self_in_kind", label: "현물" },
  { fundingSourceKey: "government_subsidy+self_cash", label: "정부지원금 + 현금" },
  { fundingSourceKey: "government_subsidy+self_in_kind", label: "정부지원금 + 현물" },
  { fundingSourceKey: "self_cash+self_in_kind", label: "현금 + 현물" },
  { fundingSourceKey: "government_subsidy+self_cash+self_in_kind", label: "정부지원금 + 현금 + 현물" },
] as const satisfies ReadonlyArray<{
  fundingSourceKey: ExpenseFundingSourceKey;
  label: string;
}>;

export type CompanyRecord = PublicTables["companies"]["Row"];
export type ProjectRecord = PublicTables["projects"]["Row"];
export type ProjectBudgetCategoryRecord =
  PublicTables["project_budget_categories"]["Row"];
export type ExpenseRecord = PublicTables["expenses"]["Row"];
export type ExpenseEvidenceRecord =
  PublicTables["expense_evidence_files"]["Row"];
export type ExpenseHistoryRecord =
  PublicTables["expense_history_events"]["Row"];

export type ProjectKpiRecord = PublicViews["project_kpi_summary"]["Row"];
export type ProjectCategoryAmountRecord =
  PublicViews["project_category_amount_summary"]["Row"];
export type ProjectKanbanStageRecord =
  PublicViews["project_kanban_stage_summary"]["Row"];
export type ProjectExpenseByCategoryRecord =
  PublicViews["project_expenses_by_category"]["Row"];
export type ProjectExpenseByStageRecord =
  PublicViews["project_expenses_by_stage"]["Row"];
