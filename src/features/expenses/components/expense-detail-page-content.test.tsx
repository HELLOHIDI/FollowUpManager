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
const projectQueryMocks = vi.hoisted(() => ({
  useProjectEvidenceDocumentsQuery: vi.fn(),
  useProjectEvidenceTemplateDownloadsQuery: vi.fn(),
}));

vi.mock("../hooks/use-expenses-query", () => queryMocks);
vi.mock("@/features/projects/hooks/use-projects", () => projectQueryMocks);
vi.mock("@/features/projects/api", () => ({
  getProjectDocumentSignedUrl: vi.fn(),
}));
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
  projectQueryMocks.useProjectEvidenceDocumentsQuery.mockReturnValue({
    data: null,
    isError: false,
    isPending: false,
  });
  projectQueryMocks.useProjectEvidenceTemplateDownloadsQuery.mockReturnValue({
    data: [],
    isError: false,
    isPending: false,
  });
};

describe("ExpenseDetailPageContent", () => {
  it("returns to the operation dashboard and renders collapsible stage sections", () => {
    mockLoadedQueries();

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    expect(screen.getByRole("link", { name: "돌아가기" })).toHaveAttribute("href", `/projects/${projectId}`);
    expect(screen.getByText("지출 상세")).toBeInTheDocument();
    expect(screen.getAllByText("사업비 등록").length).toBeGreaterThan(0);
    expect(screen.getAllByText("사전 승인").length).toBeGreaterThan(0);
    expect(screen.getAllByText("집행 수행").length).toBeGreaterThan(0);
    expect(screen.getAllByText("집행 요청").length).toBeGreaterThan(0);
    expect(screen.getAllByText("집행 완료").length).toBeGreaterThan(0);
    expect(screen.getAllByText("파일 추가")).toHaveLength(1);
    const preApprovalButton = screen.getAllByText("사전 승인").map((node) => node.closest("button")).find(Boolean);
    expect(preApprovalButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(preApprovalButton as HTMLButtonElement);
    expect(screen.getAllByText("파일 추가")).toHaveLength(2);
    expect(screen.queryByText("검증 메시지")).not.toBeInTheDocument();
    expect(screen.queryByText("변경 이력")).not.toBeInTheDocument();
    expect(screen.queryByText("Checklist")).not.toBeInTheDocument();
    expect(screen.queryByText("현재 요약")).not.toBeInTheDocument();
  });

  it("keeps stage evidence in the main detail flow without validation or history sections", () => {
    mockLoadedQueries();

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    const detailCard = screen.getByText("지출 상세").closest("section");
    expect(detailCard).not.toBeNull();
    expect(within(detailCard as HTMLElement).getAllByText("증빙 파일")).toHaveLength(1);
    expect(within(detailCard as HTMLElement).queryByText("검증 메시지")).not.toBeInTheDocument();
    expect(within(detailCard as HTMLElement).queryByText("변경 이력")).not.toBeInTheDocument();
  });

  it("saves only the simplified checklist and memo for an editable stage", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockLoadedQueries({ stageKey: "execution_completed" }, mutateAsync);

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    expect(screen.getByLabelText("사전준비")).toBeInTheDocument();
    expect(screen.getByLabelText("담당자 확인")).toBeInTheDocument();
    expect(screen.getByLabelText("PMS 등록")).toBeInTheDocument();
    expect(screen.getByLabelText("최종 승인")).toBeInTheDocument();
    expect(document.getElementById("expense-stage-execution_completed-memo")).toBeInTheDocument();
    expect(screen.queryByLabelText("승인 상태")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("사전준비"));
    fireEvent.change(document.getElementById("expense-stage-execution_completed-memo") as HTMLTextAreaElement, { target: { value: "확인 완료" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      stageFields: expect.objectContaining({
        stageChecklists: expect.objectContaining({
          execution_completed: expect.objectContaining({ memo: "확인 완료", prepared: true }),
        }),
      }),
    }));
  });

  it("shows linked institution templates inside a single policy evidence row", () => {
    mockLoadedQueries({
      policySnapshot: {
        evidence_requirements: [
          { evidence_key: "tax_invoice", evidence_name: "세금계산서" },
          { evidence_key: "contract", evidence_name: "계약서" },
        ],
      },
    });
    projectQueryMocks.useProjectEvidenceTemplateDownloadsQuery.mockReturnValue({
      data: [{
        documentKey: "contract",
        documentTypeId: "66666666-6666-4666-8666-666666666666",
        fileSize: 1024,
        id: "77777777-7777-4777-8777-777777777777",
        originalFileName: "기관_계약서_양식.docx",
        sortOrder: 0,
      }],
      isError: false,
      isPending: false,
    });

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    expect(screen.getByText("양식 1개")).toBeInTheDocument();
    expect(screen.queryByText("기관_계약서_양식.docx")).not.toBeInTheDocument();
    const contractRow = screen.getAllByText("계약서").map((node) => node.closest("button")).find(Boolean);
    fireEvent.click(contractRow as HTMLButtonElement);
    expect(screen.getByText("기관_계약서_양식.docx")).toBeInTheDocument();
  });

  it("keeps non-execution stages on snapshot evidence options when project templates exist", () => {
    mockLoadedQueries({
      policySnapshot: {
        evidence_requirements: [
          { evidence_key: "pre_approval_form", evidence_name: "Pre approval form" },
        ],
      },
    });
    projectQueryMocks.useProjectEvidenceDocumentsQuery.mockReturnValue({
      data: {
        documentTypes: [{
          displayName: "Execution template",
          documentKey: "execution_template",
          id: "66666666-6666-4666-8666-666666666666",
          projectId,
          sortOrder: 0,
          source: "custom",
          stageKey: "execution_request",
        }],
        links: [],
      },
      isError: false,
      isPending: false,
    });

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    expect(screen.getAllByText("Pre approval form").length).toBeGreaterThan(0);
    const executionRequestButton = screen.getAllByText("집행 요청").map((node) => node.closest("button")).find(Boolean);
    expect(executionRequestButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(executionRequestButton as HTMLButtonElement);
    expect(screen.getAllByText("Execution template").length).toBeGreaterThan(0);
  });

  it("normalizes a cleared expected date before saving", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockLoadedQueries(
      {
        expectedSpendDate: "2026-07-01",
        stageKey: "execution_request",
      },
      mutateAsync,
    );

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    fireEvent.change(screen.getByDisplayValue("2026-07-01"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
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
    fireEvent.change(screen.getByLabelText("파일 선택"), { target: { files: [file] } });

    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledWith({
      documentKey: "receipt",
      file,
      requirementKey: "payment_bundle",
    }));
    expect(screen.queryAllByText("파일 추가")).toHaveLength(0);
  });

  it("opens and deletes uploaded policy evidence files", async () => {
    const deleteMutateAsync = vi.fn().mockResolvedValue({});
    const signedUrlMutateAsync = vi.fn().mockResolvedValue({ signedUrl: "https://example.test/receipt.pdf" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
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
        files: [{
          documentKey: "receipt",
          duplicateStatus: "unique",
          expenseId,
          fileExtension: "pdf",
          fileSize: 1024,
          id: "33333333-3333-4333-8333-333333333333",
          mimeType: "application/pdf",
          originalFileName: "receipt.pdf",
          projectId,
          requirementKey: "payment_bundle",
          uploadedAt: "2026-07-01T00:00:00.000Z",
        }],
        policySnapshotHash: "hash",
        requirements: [{
          acceptedDocuments: [{ documentKey: "receipt", label: "Receipt", uploaded: true }],
          changedAt: null,
          changedBy: null,
          conditionText: null,
          evidenceName: "Payment bundle",
          fulfillmentType: "single",
          requirementKey: "payment_bundle",
          requirementType: "required",
          status: "uploaded",
          uploadedCount: 1,
          waivedReason: null,
        }],
        unclassifiedFiles: [],
      },
      {
        deleteMutation: {
          isPending: false,
          mutateAsync: deleteMutateAsync,
        },
        signedUrlMutation: {
          isPending: false,
          mutateAsync: signedUrlMutateAsync,
        },
      },
    );

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    fireEvent.click(screen.getByRole("button", { name: "receipt.pdf 열기" }));
    await waitFor(() => expect(signedUrlMutateAsync).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333"));
    expect(openSpy).toHaveBeenCalledWith("https://example.test/receipt.pdf", "_blank", "noopener,noreferrer");

    fireEvent.click(screen.getByRole("button", { name: "receipt.pdf 삭제" }));
    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333"));
    openSpy.mockRestore();
  });
});
