import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPageContent } from "./dashboard-page-content";

const query = vi.hoisted(() => ({
  useDashboardQuery: vi.fn(),
}));

vi.mock("../hooks/use-dashboard-query", () => query);
vi.mock("@/lib/remote/api-client", () => ({
  extractApiErrorCode: (error: { code?: string } | null | undefined) => error?.code ?? null,
}));
vi.mock("@/components/product-shell", () => ({
  EmptyPanel: ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  ),
  LocalNavPills: () => <nav data-testid="local-nav" />,
  PageHeading: ({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) => (
    <header>
      {eyebrow ? <span>{eyebrow}</span> : null}
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));
vi.mock("./dashboard-kpis", () => ({
  DashboardKpis: ({ kpis }: { kpis: { totalBudget: number } }) => <div data-testid="dashboard-kpis">{kpis.totalBudget}</div>,
}));
vi.mock("./category-expense-list", () => ({
  CategoryExpenseList: ({ categories }: { categories: Array<{ categoryKey: string }> }) => (
    <div data-testid="category-expense-list">{categories.map((category) => category.categoryKey).join(",")}</div>
  ),
}));
vi.mock("./dashboard-kanban-board", () => ({
  DashboardKanbanBoard: ({ projectId }: { projectId: string }) => <div data-testid="dashboard-kanban-board">{projectId}</div>,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const baseData = {
  categories: [],
  kpis: { burnRatio: 0, remainingAmount: 100, spentAmount: 0, totalBudget: 100 },
  project: { id: "11111111-1111-4111-8111-111111111111", name: "Dashboard Project" },
};
const projectId = "11111111-1111-4111-8111-111111111111";
const renderPage = (state: Parameters<typeof query.useDashboardQuery.mockReturnValue>[0]) => {
  query.useDashboardQuery.mockReturnValue(state);
  render(<DashboardPageContent projectId={projectId} />);
};

describe("DashboardPageContent", () => {
  it("shows a loading skeleton while the query is pending", () => {
    renderPage({ error: null, isLoading: true, isPending: true });

    expect(screen.getByLabelText("대시보드 로딩 중")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-kpis")).not.toBeInTheDocument();
  });

  it("keeps cached dashboard content visible during a background refresh", () => {
    renderPage({ data: baseData, error: null, isFetching: true, isLoading: true, isPending: false });

    expect(screen.queryByLabelText("대시보드 로딩 중")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard Project" })).toBeInTheDocument();
  });

  it("shows the not-found state when the dashboard project is missing", () => {
    renderPage({ error: { code: "DASHBOARD_PROJECT_NOT_FOUND" }, isLoading: false });

    expect(screen.getByText("프로젝트를 찾을 수 없습니다")).toBeInTheDocument();
  });

  it("shows the integrity state with a retry action", () => {
    const refetch = vi.fn();
    renderPage({
      error: { code: "DASHBOARD_INTEGRITY_ERROR" },
      isLoading: false,
      refetch,
    });

    expect(screen.getByText("대시보드 데이터 확인이 필요합니다")).toBeInTheDocument();
    screen.getByRole("button", { name: "다시 시도" }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the generic error state for unknown failures", () => {
    renderPage({
      error: { code: "SOMETHING_ELSE" },
      isLoading: false,
      refetch: vi.fn(),
    });

    expect(screen.getByText("대시보드를 불러오지 못했습니다")).toBeInTheDocument();
  });

  it("renders the success layout and kanban board when data is available", () => {
    renderPage({ data: baseData, error: null, isLoading: false });

    expect(screen.getByRole("heading", { name: "Dashboard Project" })).toBeInTheDocument();
    expect(screen.getByTestId("local-nav")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-kpis")).toHaveTextContent("100");
    expect(screen.getByTestId("category-expense-list")).toHaveTextContent("");
    expect(screen.getByTestId("dashboard-kanban-board")).toHaveTextContent(projectId);
  });
});
