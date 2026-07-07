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
  it("renders the vertical stepper workbench with read-only evidence", () => {
    mockLoadedQueries({
      policySnapshot: {
        evidence_requirements: [
          { accepted_documents: [{ documentKey: "receipt", label: "Receipt" }], evidence_key: "payment_bundle", evidence_name: "Payment bundle" },
        ],
      },
    });

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    expect(screen.getByRole("link", { name: "\ub3cc\uc544\uac00\uae30" })).toHaveAttribute("href", `/projects/${projectId}`);
    expect(screen.getByRole("list", { name: "\uc9c0\ucd9c 5\ub2e8\uacc4 \uc9c4\ud589 \uc0c1\ud0dc" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 \uc0ac\uc5c5\ube44 \ub4f1\ub85d/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("\uc5c5\ubb34\uc808\ucc28")).toBeInTheDocument();
    expect(screen.getByLabelText("\uc0ac\uc804 \uc900\ube44")).toBeInTheDocument();
    expect(screen.getByLabelText("\ub2f4\ub2f9\uc790 \ud655\uc778")).toBeInTheDocument();
    expect(screen.getByText("\uae30\uc5c5\uc591\uc2dd")).toBeInTheDocument();
    expect(screen.getByText("\ud544\uc694 \uc99d\ube59\uc11c\ub958")).toBeInTheDocument();
    expect(screen.getAllByText("Payment bundle").length).toBeGreaterThan(0);
    expect(screen.queryByText("\ud30c\uc77c \uc120\ud0dd")).not.toBeInTheDocument();
    expect(screen.queryByText("\ud30c\uc77c \ucd94\uac00")).not.toBeInTheDocument();
    expect(screen.queryByText("\uc0ad\uc81c")).not.toBeInTheDocument();
  });

  it("previews a step click and moves only through the explicit button", async () => {
    const stageMutateAsync = vi.fn().mockResolvedValue({});
    mockLoadedQueries();
    queryMocks.useExpenseStageMutation.mockReturnValue({
      isPending: false,
      mutateAsync: stageMutateAsync,
    });

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    fireEvent.click(screen.getByRole("button", { name: /2 \uc0ac\uc804 \uc2b9\uc778/ }));

    expect(screen.getAllByRole("heading", { name: "\uc0ac\uc804 \uc2b9\uc778" }).length).toBeGreaterThan(0);
    expect(stageMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "\uc774 \ub2e8\uacc4\ub85c \uc774\ub3d9" }));

    await waitFor(() => expect(stageMutateAsync).toHaveBeenCalledWith({
      expenseId,
      input: { targetStageKey: "pre_approval" },
    }));
  });

  it("keeps enterprise forms collapsed by default and exposes rows after opening", () => {
    mockLoadedQueries();
    projectQueryMocks.useProjectEvidenceTemplateDownloadsQuery.mockReturnValue({
      data: [{
        documentKey: "contract",
        documentTypeId: "66666666-6666-4666-8666-666666666666",
        fileSize: 1024,
        id: "77777777-7777-4777-8777-777777777777",
        originalFileName: "company-form.docx",
        sortOrder: 0,
      }],
      isError: false,
      isPending: false,
    });

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    expect(screen.queryByText("company-form.docx")).not.toBeVisible();
    fireEvent.click(screen.getByText("\uae30\uc5c5\uc591\uc2dd"));
    expect(screen.getByText("company-form.docx")).toBeVisible();
    expect(screen.getByRole("button", { name: "company-form.docx \ubcf4\uae30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "company-form.docx \ub2e4\uc6b4\ub85c\ub4dc" })).toBeInTheDocument();
  });

  it("normalizes cleared date inputs to null before saving", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockLoadedQueries(
      {
        executionRequestDate: "2026-07-10",
        expectedSpendDate: "2026-07-01",
        stageFields: {
          procedures: {
            execution_request: {
              preparation: { completedDate: "2026-07-02" },
            },
          },
        },
        stageKey: "execution_request",
      },
      mutateAsync,
    );

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    fireEvent.change(screen.getByDisplayValue("2026-07-01"), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("2026-07-02"), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("2026-07-10"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "\uc800\uc7a5" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        executionRequestDate: null,
        expectedSpendDate: null,
        stageFields: expect.objectContaining({
          procedures: expect.objectContaining({
            execution_request: expect.objectContaining({
              preparation: expect.objectContaining({ completedDate: null }),
            }),
          }),
        }),
      }),
    );
  });

  it("opens uploaded evidence as read-only without delete controls", async () => {
    const signedUrlMutateAsync = vi.fn().mockResolvedValue({ signedUrl: "https://example.test/receipt.pdf" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    mockLoadedQueries(
      {
        policySnapshot: {
          evidence_requirements: [{
            accepted_documents: [{ documentKey: "receipt", label: "Receipt" }],
            evidence_key: "payment_bundle",
            evidence_name: "Payment bundle",
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
        signedUrlMutation: {
          isPending: false,
          mutateAsync: signedUrlMutateAsync,
        },
      },
    );

    render(<ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />);

    expect(screen.queryByText("\uc0ad\uc81c")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "receipt.pdf" }));
    await waitFor(() => expect(signedUrlMutateAsync).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333"));
    expect(openSpy).toHaveBeenCalledWith("https://example.test/receipt.pdf", "_blank", "noopener,noreferrer");
    openSpy.mockRestore();
  });
});
