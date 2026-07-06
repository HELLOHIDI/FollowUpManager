import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@/features/dashboard/backend/schema";
import { dashboardKeys } from "@/features/dashboard/hooks/dashboard-keys";
import { useExpenseStageMutation } from "./use-expenses-query";

const api = vi.hoisted(() => ({
  createExpenseEvidenceSignedUrlRequest: vi.fn(),
  createExpenseRequest: vi.fn(),
  deleteExpenseEvidenceRequest: vi.fn(),
  fetchProjectExpenseDetail: vi.fn(),
  fetchProjectExpenseEvidence: vi.fn(),
  fetchProjectExpenseHistory: vi.fn(),
  fetchProjectExpensesPage: vi.fn(),
  relinkExpenseEvidenceRequest: vi.fn(),
  updateExpenseRequest: vi.fn(),
  updateExpenseStageRequest: vi.fn(),
  uploadExpenseEvidenceRequest: vi.fn(),
  waiveExpenseEvidenceRequirementRequest: vi.fn(),
}));

vi.mock("../api", () => api);

const projectId = "11111111-1111-4111-8111-111111111111";
const expenseId = "22222222-2222-4222-8222-222222222222";
const dashboard: DashboardResponse = {
  categories: [{
    categoryKey: "material_cost",
    categoryName: "Materials",
    expenseCount: 1,
    expenses: [{ amount: 250, id: expenseId, stageKey: "execution_request", title: "Parts" }],
    totalAmount: 250,
  }],
  kpis: { burnRatio: 0, remainingAmount: 1000, spentAmount: 0, totalBudget: 1000 },
  project: { id: projectId, name: "Project" },
};

const setup = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(dashboardKeys.project(projectId), dashboard);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, ...renderHook(() => useExpenseStageMutation(projectId), { wrapper }) };
};

describe("useExpenseStageMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates dashboard KPIs optimistically when an expense reaches completion", async () => {
    api.updateExpenseStageRequest.mockReturnValue(new Promise(() => {}));
    const { queryClient, result } = setup();

    result.current.mutate({ expenseId, input: { targetStageKey: "execution_completed" } });

    await waitFor(() => {
      expect(queryClient.getQueryData<DashboardResponse>(dashboardKeys.project(projectId))?.kpis).toMatchObject({
        burnRatio: 0.25,
        remainingAmount: 750,
        spentAmount: 250,
      });
    });
  });

  it("rolls back optimistic dashboard KPIs when the stage update fails", async () => {
    api.updateExpenseStageRequest.mockRejectedValue(new Error("failed"));
    const { queryClient, result } = setup();

    await expect(result.current.mutateAsync({ expenseId, input: { targetStageKey: "execution_completed" } })).rejects.toThrow("failed");

    expect(queryClient.getQueryData<DashboardResponse>(dashboardKeys.project(projectId))?.kpis).toEqual(dashboard.kpis);
  });
});
