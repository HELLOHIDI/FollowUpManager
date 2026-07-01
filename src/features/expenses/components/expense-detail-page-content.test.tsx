import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ExpenseDetailResponse } from "../backend/schema";
import { ExpenseDetailPageContent } from "./expense-detail-page-content";

const queryMocks = vi.hoisted(() => ({
  useExpenseDetailMutations: vi.fn(),
  useExpenseDetailQuery: vi.fn(),
  useExpenseEvidenceMutations: vi.fn(),
  useExpenseEvidenceQuery: vi.fn(),
  useExpenseHistoryQuery: vi.fn(),
  useExpenseStageMutation: vi.fn(),
}));

vi.mock("../hooks/use-expenses-query", () => queryMocks);
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/lib/remote/api-client", () => ({
  extractApiErrorMessage: () => "API request failed.",
}));
vi.mock("@/components/product-shell", () => ({
  EmptyPanel: ({ title }: { title: string }) => <div>{title}</div>,
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
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => <button {...props}>{children}</button>,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));
vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const expenseId = "22222222-2222-4222-8222-222222222222";

const detailData: ExpenseDetailResponse = {
  amount: 300,
  categoryOptions: [{ categoryKey: "material_cost", categoryName: "Materials", sortOrder: 0 }],
  categoryKey: "material_cost",
  executionProgressStatus: null,
  executionRequestDate: null,
  executionRequestStatus: null,
  expectedSpendDate: null,
  fundingSourceKey: "government_subsidy",
  id: expenseId,
  memo: null,
  preApprovalStatus: null,
  projectBudgetCategoryId: "44444444-4444-4444-8444-444444444444",
  projectId,
  stageFields: {},
  stageKey: "budget_registration",
  title: "Prototype parts",
  vendorName: null,
};

const mockLoadedQueries = (
  overrides: Partial<ExpenseDetailResponse> = {},
  mutateAsync = vi.fn(),
  evidenceData: Record<string, unknown> = { files: [], policySnapshotHash: null, requirements: [], unclassifiedFiles: [] },
  evidenceMutations: Record<string, unknown> = {},
) => {
  queryMocks.useExpenseDetailQuery.mockReturnValue({
    data: { ...detailData, ...overrides },
    isError: false,
    isPending: false,
  });
  queryMocks.useExpenseHistoryQuery.mockReturnValue({
    data: { events: [] },
    isError: false,
    isPending: false,
  });
  queryMocks.useExpenseEvidenceQuery.mockReturnValue({
    data: evidenceData,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  });
  queryMocks.useExpenseDetailMutations.mockReturnValue({
    updateMutation: {
      isPending: false,
      mutateAsync,
    },
  });
  queryMocks.useExpenseEvidenceMutations.mockReturnValue({
    deleteMutation: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
    relinkMutation: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
    signedUrlMutation: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
    uploadMutation: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
    waiveRequirementMutation: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
    ...evidenceMutations,
  });
  queryMocks.useExpenseStageMutation.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  });
};

describe("ExpenseDetailPageContent", () => {
  it("returns to the operation dashboard and renders the long-card stage flow", () => {
    mockLoadedQueries();

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    expect(screen.getByRole("link", { name: "돌아가기" })).toHaveAttribute("href", `/projects/${projectId}`);
    expect(screen.getByText("지출 상세")).toBeInTheDocument();
    expect(screen.getAllByText("사업비 등록").length).toBeGreaterThan(0);
    expect(screen.getAllByText("사전 승인").length).toBeGreaterThan(0);
    expect(screen.getAllByText("집행 수행").length).toBeGreaterThan(0);
    expect(screen.getAllByText("집행 요청").length).toBeGreaterThan(0);
    expect(screen.getAllByText("집행 완료").length).toBeGreaterThan(0);
    expect(screen.getAllByText("파일 추가")).toHaveLength(5);
    expect(screen.getByText("검증 메시지")).toBeInTheDocument();
    expect(screen.getByText("변경 이력")).toBeInTheDocument();
    expect(screen.queryByText("Checklist")).not.toBeInTheDocument();
    expect(screen.queryByText("현재 요약")).not.toBeInTheDocument();
  });

  it("keeps evidence, validation, and history inside the main detail flow", () => {
    mockLoadedQueries();

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    const detailCard = screen.getByText("지출 상세").closest("section");
    expect(detailCard).not.toBeNull();
    expect(within(detailCard as HTMLElement).getAllByText("증빙 파일")).toHaveLength(5);
    expect(within(detailCard as HTMLElement).getByText("검증 메시지")).toBeInTheDocument();
    expect(within(detailCard as HTMLElement).getByText("변경 이력")).toBeInTheDocument();
  });

  it("normalizes cleared date inputs to null before saving", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockLoadedQueries(
      {
        executionRequestDate: "2026-07-10",
        expectedSpendDate: "2026-07-01",
        stageKey: "execution_request",
      },
      mutateAsync,
    );

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    fireEvent.change(screen.getByDisplayValue("2026-07-01"), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("2026-07-10"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        executionRequestDate: null,
        expectedSpendDate: null,
      }),
    );
  });

  it("uploads directly from a policy-backed evidence checklist row", async () => {
    const uploadMutateAsync = vi.fn().mockResolvedValue({});
    mockLoadedQueries(
      {
        policySnapshot: {
          category_key: "material_cost",
          category_name: "Materials",
          evidence_requirements: [{
            accepted_documents: [{ documentKey: "receipt", label: "Receipt" }],
            condition_text: null,
            document_key: "receipt",
            evidence_key: "payment_bundle",
            evidence_name: "Payment bundle",
            fulfillment_type: "single",
            requirement_type: "required",
            sort_order: 0,
            source_reference: {},
          }],
        },
      },
      vi.fn(),
      {
        files: [],
        policySnapshotHash: "hash",
        requirements: [{
          acceptedDocuments: [{ documentKey: "receipt", label: "Receipt", uploaded: false }],
          changedAt: null,
          changedBy: null,
          conditionText: null,
          evidenceName: "Payment bundle",
          fulfillmentType: "single",
          requirementKey: "payment_bundle",
          requirementType: "required",
          status: "not_uploaded",
          uploadedCount: 0,
          waivedReason: null,
        }],
        unclassifiedFiles: [],
      },
      {
        uploadMutation: {
          isPending: false,
          mutateAsync: uploadMutateAsync,
        },
      },
    );

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    const file = new File(["pdf"], "receipt.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Receipt"), { target: { files: [file] } });

    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledWith({
      documentKey: "receipt",
      file,
      requirementKey: "payment_bundle",
    }));
    expect(screen.queryAllByText("?뚯씪 異붽?")).toHaveLength(0);
  });
});
