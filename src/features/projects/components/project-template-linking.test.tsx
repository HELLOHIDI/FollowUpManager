import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { ProjectTemplateLinking } from "./project-template-linking";

const mocks = vi.hoisted(() => ({
  useProjectDocumentsQuery: vi.fn(),
  useProjectEvidenceDocumentsQuery: vi.fn(),
  useProjectMutations: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser-client", () => ({
  createBrowserSupabaseClient: vi.fn(),
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock("../hooks/use-projects", () => ({
  useProjectDocumentsQuery: mocks.useProjectDocumentsQuery,
  useProjectEvidenceDocumentsQuery: mocks.useProjectEvidenceDocumentsQuery,
  useProjectMutations: mocks.useProjectMutations,
}));

describe("ProjectTemplateLinking", () => {
  it("shows loading copy while template files and evidence types load", () => {
    mocks.useProjectDocumentsQuery.mockReturnValue({ isPending: true });
    mocks.useProjectEvidenceDocumentsQuery.mockReturnValue({ isPending: true });
    mocks.useProjectMutations.mockReturnValue({
      deleteDocumentMutation: { mutateAsync: vi.fn() },
      saveEvidenceDocumentsMutation: { isPending: false, mutateAsync: vi.fn() },
      uploadMutation: { mutateAsync: vi.fn() },
    });

    render(<ProjectTemplateLinking projectId="project-1" />);

    expect(screen.getByText("기관 양식 파일을 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.getByText("증빙서류 연결 항목을 불러오는 중입니다.")).toBeInTheDocument();
  });

  it("uploads institution template files dropped on the file area", () => {
    const uploadFile = vi.fn().mockResolvedValue(undefined);
    mocks.useProjectDocumentsQuery.mockReturnValue({ data: [], isPending: false });
    mocks.useProjectEvidenceDocumentsQuery.mockReturnValue({
      data: { documentTypes: [], links: [] },
      isPending: false,
    });
    mocks.useProjectMutations.mockReturnValue({
      deleteDocumentMutation: { mutateAsync: vi.fn() },
      saveEvidenceDocumentsMutation: { isPending: false, mutateAsync: vi.fn() },
      uploadMutation: { mutateAsync: uploadFile },
    });

    render(<ProjectTemplateLinking projectId="project-1" />);

    fireEvent.drop(screen.getByText(/끌어다 놓거나/).closest("div")!, {
      dataTransfer: {
        files: [new File(["template"], "template.pdf", { type: "application/pdf" })],
      },
    });

    expect(uploadFile).toHaveBeenCalledWith({
      file: expect.objectContaining({ name: "template.pdf" }),
      projectId: "project-1",
      purpose: "institution_template",
    });
  });
});
