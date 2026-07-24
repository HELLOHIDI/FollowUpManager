import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CategoryExpenseList } from "./category-expense-list";
import { DashboardKpis, formatRatio, formatWon } from "./dashboard-kpis";

const expenseId = "22222222-2222-4222-8222-222222222222";

describe("dashboard presentation", () => {
  it("formats won and ratios consistently", () => {
    expect(formatWon(1234567)).toContain("1,234,567");
    expect(formatWon(1234567)).toContain("원");
    expect(formatRatio(0.125)).toBe("12.5%");
  });

  it("renders accessible KPI labels and values", () => {
    render(<DashboardKpis kpis={{ totalBudget: 1000, spentAmount: 250, remainingAmount: 750, burnRatio: 0.25 }} />);

    expect(screen.getByLabelText(/1,000/)).toBeInTheDocument();
    expect(screen.getByLabelText(/750/)).toBeInTheDocument();
    expect(screen.getByLabelText(/25%/)).toBeInTheDocument();
    expect(screen.getByText("총 사업비")).toBeInTheDocument();
  });

  it("renders category summaries collapsed by default and expands with accessible controls", async () => {
    render(
      <CategoryExpenseList
        projectId="11111111-1111-4111-8111-111111111111"
        categories={[
          {
            categoryKey: "material_cost",
            categoryName: "재료비",
            expenseCount: 2,
            totalAmount: 500,
            expenses: [
              {
                id: expenseId,
                title: "Prototype parts",
                amount: 300,
                stageKey: "execution_request",
              },
              {
                id: "33333333-3333-4333-8333-333333333333",
                title: "Initial materials",
                amount: 200,
                stageKey: "budget_registration",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("재료비")).toBeInTheDocument();
    expect(screen.getByText("사업비 등록 1건")).toBeInTheDocument();
    expect(screen.getByText("집행 요청 1건")).toBeInTheDocument();
    expect(screen.queryByText("사전 승인 0건")).not.toBeInTheDocument();
    expect(screen.queryByText("Prototype parts")).not.toBeInTheDocument();

    const button = screen.getByRole("button", { name: "지출 펼치기" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Prototype parts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Prototype parts/ })).toHaveAttribute(
      "href",
      `/projects/11111111-1111-4111-8111-111111111111/expenses/${expenseId}`,
    );

    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Prototype parts")).not.toBeInTheDocument();
  });

  it("renders the empty state when categories have no active expenses", () => {
    render(
      <CategoryExpenseList
        projectId="11111111-1111-4111-8111-111111111111"
        categories={[
          { categoryKey: "a", categoryName: "A", expenseCount: 0, totalAmount: 0, expenses: [] },
          { categoryKey: "b", categoryName: "B", expenseCount: 0, totalAmount: 0, expenses: [] },
        ]}
      />,
    );

    expect(screen.getByText("등록된 지출이 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "빠른 지출 등록" })).toHaveAttribute(
      "href",
      "/projects/11111111-1111-4111-8111-111111111111/expenses",
    );
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("renders an empty category state without fake groups", () => {
    render(<CategoryExpenseList categories={[]} projectId="11111111-1111-4111-8111-111111111111" />);

    expect(screen.getByText("등록된 지출이 없습니다")).toBeInTheDocument();
  });
});
