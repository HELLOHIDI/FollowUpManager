import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramPolicyPanel } from "./program-policy-panel";

const hookMocks = vi.hoisted(() => ({
  usePolicyDraftDetailQuery: vi.fn(),
  useProgramPolicyMutations: vi.fn(),
  useProjectPolicyStatusQuery: vi.fn(),
}));

vi.mock("../hooks/use-program-policy", () => hookMocks);
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/lib/supabase/browser-client", () => ({
  createBrowserSupabaseClient: vi.fn(),
  getSupabaseBrowserClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";

const setupLoadedDraft = () => {
  hookMocks.useProjectPolicyStatusQuery.mockReturnValue({
    data: {
      activePolicyVersionId: null,
      latestPolicyVersion: {
        confirmedAt: null,
        confirmedBy: null,
        confirmedSummary: {},
        createdAt: "2026-07-01T00:00:00.000Z",
        extractionFailureReason: null,
        extractionStatus: "succeeded",
        id: versionId,
        operationStatus: "draft_needs_review",
        projectId,
        status: "draft",
        versionNumber: 1,
      },
      operationStatus: "draft_needs_review",
      versions: [],
    },
  });
  hookMocks.usePolicyDraftDetailQuery.mockReturnValue({
    data: {
      blockingErrors: ["Category requires admin review: category_ec9eaceb"],
      categories: [{
        categoryKey: "category_ec9eaceb",
        categoryName: "Materials",
        id: "33333333-3333-4333-8333-333333333333",
        rawCategoryName: "Materials",
        reviewStatus: "needs_admin_review",
        sortOrder: 0,
        sourceReference: {},
      }],
      documents: [],
      evidenceRequirements: [{
        categoryId: "33333333-3333-4333-8333-333333333333",
        categoryKey: "category_ec9eaceb",
        conditionText: null,
        documentKey: "document_abcd1234",
        evidenceKey: "evidence_abcd1234",
        evidenceName: "Payment request (statement continuation)",
        fulfillmentType: "single",
        id: "44444444-4444-4444-8444-444444444444",
        requirementType: "required",
        reviewStatus: "needs_admin_review",
        sourceReference: {},
        subcategoryId: null,
        subcategoryKey: null,
      }],
      subcategories: [],
      version: {
        confirmedAt: null,
        confirmedBy: null,
        confirmedSummary: {},
        createdAt: "2026-07-01T00:00:00.000Z",
        extractionFailureReason: null,
        extractionStatus: "succeeded",
        id: versionId,
        operationStatus: "draft_needs_review",
        projectId,
        status: "draft",
        versionNumber: 1,
      },
    },
    isPending: false,
  });
  hookMocks.useProgramPolicyMutations.mockReturnValue({
    confirmMutation: { isPending: false, mutateAsync: vi.fn() },
    extractMutation: { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() },
    updateDraftMutation: { isPending: false, mutate: vi.fn() },
    uploadMutation: { isPending: false, mutateAsync: vi.fn() },
  });
};

describe("ProgramPolicyPanel", () => {
  it("renders policy draft rows as category-to-evidence table without internal keys", () => {
    setupLoadedDraft();

    render(<ProgramPolicyPanel projectId={projectId} />);

    expect(screen.getByText("비목별 집행 증빙서류")).toBeInTheDocument();
    expect(screen.getByText("집행 증빙서류")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Materials")).toBeInTheDocument();
    expect(screen.getByText("비목 검토가 필요합니다: Materials")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Payment request (statement continuation)")).toBeInTheDocument();
    expect(screen.queryByText("category_ec9eaceb")).not.toBeInTheDocument();
    expect(screen.queryByText("evidence_abcd1234")).not.toBeInTheDocument();
    expect(screen.queryByText("document_abcd1234")).not.toBeInTheDocument();
  });
});
