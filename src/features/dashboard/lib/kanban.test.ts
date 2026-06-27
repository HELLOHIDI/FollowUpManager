import { describe, expect, it } from "vitest";
import type { DashboardResponse } from "../backend/schema";
import { selectDashboardKanbanColumns } from "./kanban";

const dashboard: DashboardResponse = {
  project: { id: "11111111-1111-4111-8111-111111111111", name: "Project" },
  kpis: {
    totalBudget: 1000,
    spentAmount: 300,
    remainingAmount: 700,
    burnRatio: 0.3,
  },
  categories: [
    {
      categoryKey: "material_cost",
      categoryName: "Materials",
      expenseCount: 2,
      totalAmount: 300,
      expenses: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Prototype parts",
          amount: 100,
          stageKey: "budget_registration",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          title: "Supplier payment",
          amount: 200,
          stageKey: "execution_request",
        },
      ],
    },
  ],
};

describe("selectDashboardKanbanColumns", () => {
  it("derives all five kanban stages from the dashboard DTO", () => {
    const columns = selectDashboardKanbanColumns(dashboard);

    expect(columns.map((column) => column.stageKey)).toEqual([
      "budget_registration",
      "pre_approval",
      "execution_in_progress",
      "execution_request",
      "execution_completed",
    ]);
    expect(columns[0]).toMatchObject({
      stageKey: "budget_registration",
      nextStageKey: "pre_approval",
      expenseCount: 1,
      totalAmount: 100,
    });
    expect(columns[0].expenses[0]).toMatchObject({
      categoryKey: "material_cost",
      categoryName: "Materials",
      title: "Prototype parts",
    });
    expect(columns[3]).toMatchObject({
      stageKey: "execution_request",
      nextStageKey: "execution_completed",
      expenseCount: 1,
      totalAmount: 200,
    });
    expect(columns[4].nextStageKey).toBeNull();
  });
});
