import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSetup } from "./project-setup";

const mocks = vi.hoisted(() => ({
  confirmPolicy: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  useProgramPolicyMutations: vi.fn(),
  useProjectPolicyStatusQuery: vi.fn(),
  useProjectQuery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/features/program-evidence-policy/components/program-policy-panel", () => ({
  ProgramPolicyPanel: () => <div data-testid="program-policy-panel" />,
}));

vi.mock("@/lib/supabase/browser-client", () => ({
  createBrowserSupabaseClient: vi.fn(),
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/features/program-evidence-policy/hooks/use-program-policy", () => ({
  useProgramPolicyMutations: mocks.useProgramPolicyMutations,
  useProjectPolicyStatusQuery: mocks.useProjectPolicyStatusQuery,
}));

vi.mock("../hooks/use-projects", () => ({
  useProjectQuery: mocks.useProjectQuery,
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";

describe("ProjectSetup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.confirmPolicy = vi.fn().mockResolvedValue(undefined);
    mocks.push.mockReset();
    mocks.toast.mockReset();
    mocks.useProjectQuery.mockReturnValue({
      data: { projectName: "테스트" },
      isPending: false,
    });
    mocks.useProjectPolicyStatusQuery.mockReturnValue({
      data: {
        latestPolicyVersion: { id: versionId },
        operationStatus: "draft_needs_review",
      },
    });
    mocks.useProgramPolicyMutations.mockReturnValue({
      confirmMutation: {
        isPending: false,
        mutateAsync: mocks.confirmPolicy,
      },
    });
  });

  it("confirms the extracted policy before opening institution template setup", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    render(<ProjectSetup projectId={projectId} />);

    await userEvent.click(screen.getByRole("button", { name: "기관 양식 연결" }));

    expect(mocks.confirmPolicy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith("현재 추출된 정책으로 기관 양식과 연결합니다!");
    expect(mocks.push).toHaveBeenCalledWith(`/settings/company/projects/${projectId}/setup/templates`);
  });
});
