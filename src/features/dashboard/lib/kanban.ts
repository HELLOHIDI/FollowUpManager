import {
  EXPENSE_STAGES,
  getNextExpenseStageKey,
  type ExpenseStageKey,
} from "@/features/domain/contracts";
import type { DashboardResponse } from "../backend/schema";

export type DashboardKanbanExpense =
  DashboardResponse["categories"][number]["expenses"][number] & {
    categoryKey: string;
    categoryName: string;
  };

export type DashboardKanbanColumn = {
  stageKey: ExpenseStageKey;
  label: string;
  nextStageKey: ExpenseStageKey | null;
  expenseCount: number;
  totalAmount: number;
  expenses: DashboardKanbanExpense[];
};

export const selectDashboardKanbanColumns = (
  dashboard: DashboardResponse,
): DashboardKanbanColumn[] => {
  const columns = new Map<ExpenseStageKey, DashboardKanbanColumn>(
    EXPENSE_STAGES.map(({ key, label }) => [
      key,
      {
        stageKey: key,
        label,
        nextStageKey: getNextExpenseStageKey(key),
        expenseCount: 0,
        totalAmount: 0,
        expenses: [],
      },
    ]),
  );

  for (const category of dashboard.categories) {
    for (const expense of category.expenses) {
      const column = columns.get(expense.stageKey);
      if (!column) continue;

      column.expenses.push({
        ...expense,
        categoryKey: category.categoryKey,
        categoryName: category.categoryName,
      });
      column.expenseCount += 1;
      column.totalAmount += expense.amount;
    }
  }

  return EXPENSE_STAGES.map(({ key }) => columns.get(key)).filter(
    (column): column is DashboardKanbanColumn => Boolean(column),
  );
};
