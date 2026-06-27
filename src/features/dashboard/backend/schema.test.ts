import { describe, expect, it } from "vitest";
import { DashboardResponseSchema, DashboardSnapshotSchema } from "./schema";

const project = { id: "11111111-1111-4111-8111-111111111111", name: "운영 사업" };

describe("dashboard schemas", () => {
  it("accepts a valid empty dashboard", () => {
    expect(DashboardResponseSchema.safeParse({
      project,
      kpis: { totalBudget: 100, spentAmount: 0, remainingAmount: 100, burnRatio: 0 },
      categories: [],
    }).success).toBe(true);
  });

  it.each([
    { totalBudget: Number.MAX_SAFE_INTEGER + 1, spentAmount: 0, remainingAmount: 0, burnRatio: 0 },
    { totalBudget: 100, spentAmount: 110, remainingAmount: -10, burnRatio: 1.1 },
  ])("rejects unsafe or invalid KPI values", (kpis) => {
    expect(DashboardResponseSchema.safeParse({ project, kpis, categories: [] }).success).toBe(false);
  });

  it("rejects mismatched category counts and sums", () => {
    expect(DashboardResponseSchema.safeParse({
      project,
      kpis: { totalBudget: 100, spentAmount: 0, remainingAmount: 100, burnRatio: 0 },
      categories: [{
        categoryKey: "material_cost",
        categoryName: "재료비",
        expenseCount: 2,
        totalAmount: 5,
        expenses: [{ id: "22222222-2222-4222-8222-222222222222", title: "자재", amount: 4, stageKey: "budget_registration" }],
      }],
    }).success).toBe(false);
  });

  it("accepts a raw snapshot with a signed remaining value for integrity handling", () => {
    expect(DashboardSnapshotSchema.safeParse({
      project,
      kpis: { totalBudget: 100, spentAmount: 110, remainingAmount: -10, burnRatio: 1.1 },
      activeExpenseCount: 0,
      expenseRows: [],
      integrityCode: "INVALID_BUDGET_STATE",
    }).success).toBe(true);
  });
});
