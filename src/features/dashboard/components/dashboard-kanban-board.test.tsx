import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "../backend/schema";
import { DashboardKanbanBoard } from "./dashboard-kanban-board";

const mutationState = vi.hoisted(() => ({
  isPending: false,
  mutate: vi.fn(),
}));
const prefetchExpenseDetail = vi.hoisted(() => vi.fn());

vi.mock("@/features/expenses/hooks/use-expenses-query", () => ({
  useExpenseDetailPrefetch: () => prefetchExpenseDetail,
  useExpenseStageMutation: () => mutationState,
}));

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
      expenseCount: 1,
      totalAmount: 100,
      expenses: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Prototype parts",
          amount: 100,
          stageKey: "budget_registration",
        },
      ],
    },
  ],
};

const projectId = "11111111-1111-4111-8111-111111111111";

const createDataTransfer = () => {
  const store = new Map<string, string>();
  return {
    effectAllowed: "move",
    getData: (type: string) => store.get(type) ?? "",
    setData: (type: string, value: string) => store.set(type, value),
  };
};

describe("DashboardKanbanBoard", () => {
  beforeEach(() => {
    mutationState.isPending = false;
    mutationState.mutate.mockReset();
    prefetchExpenseDetail.mockReset();
  });

  it("renders five stage columns with canonical labels and active expense cards", () => {
    render(<DashboardKanbanBoard dashboard={dashboard} projectId={projectId} />);

    expect(screen.getByTestId("kanban-column-budget_registration")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-pre_approval")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-execution_in_progress")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-execution_request")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-execution_completed")).toBeInTheDocument();
    expect(screen.getByText("사업비 등록")).toBeInTheDocument();
    expect(screen.getByText("사전 승인")).toBeInTheDocument();
    expect(screen.getByText("집행 수행")).toBeInTheDocument();
    expect(screen.getByText("집행 요청")).toBeInTheDocument();
    expect(screen.getByText("집행 완료")).toBeInTheDocument();
    expect(within(screen.getByTestId("kanban-column-budget_registration")).getByText("Prototype parts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Prototype parts/ })).toHaveAttribute(
      "href",
      `/projects/${projectId}/expenses/22222222-2222-4222-8222-222222222222`,
    );
  });

  it("prefetches expense detail on card link intent", async () => {
    render(<DashboardKanbanBoard dashboard={dashboard} projectId={projectId} />);

    const link = screen.getByRole("link", { name: /Prototype parts/ });
    await userEvent.hover(link);
    expect(prefetchExpenseDetail).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");

    prefetchExpenseDetail.mockClear();
    link.focus();
    expect(prefetchExpenseDetail).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
  });

  it("moves a card one stage forward through drag and drop", () => {
    render(<DashboardKanbanBoard dashboard={dashboard} projectId={projectId} />);

    const dataTransfer = createDataTransfer();
    const dragOver = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(dragOver, "dataTransfer", { value: createDataTransfer() });
    const card = screen.getByText("Prototype parts").closest("li");
    expect(card).not.toBeNull();

    fireEvent.dragStart(card as HTMLElement, { dataTransfer });
    screen.getByTestId("kanban-column-pre_approval").dispatchEvent(dragOver);
    fireEvent.drop(screen.getByTestId("kanban-column-pre_approval"), { dataTransfer });

    expect(dragOver.defaultPrevented).toBe(true);
    expect(mutationState.mutate).toHaveBeenCalledWith(
      {
        expenseId: "22222222-2222-4222-8222-222222222222",
        input: { targetStageKey: "pre_approval" },
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(within(screen.getByTestId("kanban-column-pre_approval")).getByText("Prototype parts")).toBeInTheDocument();
  });

  it("rolls back optimistic movement and shows a generic board error on mutation failure", async () => {
    mutationState.mutate.mockImplementation((_variables, options) => options.onError(new Error("failed")));
    render(<DashboardKanbanBoard dashboard={dashboard} projectId={projectId} />);

    await userEvent.click(screen.getByRole("button", { name: /다음 단계/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("지출 단계를 변경하지 못했습니다. 다시 시도해 주세요.");
    expect(within(screen.getByTestId("kanban-column-budget_registration")).getByText("Prototype parts")).toBeInTheDocument();
  });
});
