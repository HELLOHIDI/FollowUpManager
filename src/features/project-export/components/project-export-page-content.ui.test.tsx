import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProjectExportPageContent } from "./project-export-page-content";

const queryMocks = vi.hoisted(() => ({
  useProjectExportQuery: vi.fn(),
}));

vi.mock("../hooks/use-project-export-query", () => queryMocks);
vi.mock("@/lib/remote/api-client", () => ({
  extractApiErrorCode: (error: { code?: string } | null | undefined) => error?.code ?? null,
}));
vi.mock("@/components/product-shell", () => ({
  EmptyPanel: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  PageHeading: ({
    actions,
    backHref,
    description,
    title,
  }: {
    actions?: ReactNode;
    backHref?: string;
    description?: string;
    title: string;
  }) => (
    <header>
      {backHref ? <a href={backHref}>돌아가기</a> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
    </header>
  ),
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const baseData = {
  categoryOptions: [{ categoryKey: "material_cost", categoryName: "재료비" }],
  filters: { category: null, from: null, stage: null, to: null },
  project: { id: projectId, name: "Export Project" },
  rows: [],
  stageOptions: [
    { stageKey: "budget_registration", label: "사업비 등록" },
    { stageKey: "pre_approval", label: "사전 승인" },
    { stageKey: "execution_in_progress", label: "집행 수행" },
    { stageKey: "execution_request", label: "집행 요청" },
    { stageKey: "execution_completed", label: "집행 완료" },
  ],
};

describe("ProjectExportPageContent UI", () => {
  it("defaults to all period, all categories, and all stages", () => {
    queryMocks.useProjectExportQuery.mockReturnValue({
      data: baseData,
      error: null,
      isFetching: false,
      isPending: false,
    });

    render(<ProjectExportPageContent projectId={projectId} />);

    expect(queryMocks.useProjectExportQuery).toHaveBeenCalledWith(projectId, {});
    const filters = screen.getByLabelText("선택된 내보내기 필터");
    expect(within(filters).getByText("전체 기간")).toBeInTheDocument();
    expect(within(filters).getByText("전체 비목")).toBeInTheDocument();
    expect(within(filters).getByText("전체 단계")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CSV 다운로드/ })).toBeDisabled();
  });

  it("renders selected filter chips and canonical stage labels after filter changes", () => {
    queryMocks.useProjectExportQuery.mockReturnValue({
      data: {
        ...baseData,
        rows: [
          {
            amount: 100,
            categoryKey: "material_cost",
            categoryName: "재료비",
            createdAt: "2026-06-24T00:00:00.000Z",
            expectedSpendDate: "2026-06-30",
            executionRequestDate: null,
            fundingSourceKey: "government_subsidy",
            id: "22222222-2222-4222-8222-222222222222",
            memo: null,
            stageKey: "budget_registration",
            stageLabel: "사업비 등록",
            title: "시제품 재료",
            vendorName: "Vendor",
          },
        ],
      },
      error: null,
      isFetching: false,
      isPending: false,
    });

    render(<ProjectExportPageContent projectId={projectId} />);

    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-06-01" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-06-30" } });
    fireEvent.change(screen.getByLabelText("비목"), { target: { value: "material_cost" } });
    fireEvent.change(screen.getByLabelText("단계"), { target: { value: "budget_registration" } });

    const filters = screen.getByLabelText("선택된 내보내기 필터");
    expect(within(filters).getByText("2026-06-01 ~ 2026-06-30")).toBeInTheDocument();
    expect(within(filters).getByText("재료비")).toBeInTheDocument();
    expect(within(filters).getByText("사업비 등록")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CSV 다운로드/ })).toBeEnabled();
    expect(screen.getByText("시제품 재료")).toBeInTheDocument();
  });
});
