import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyResponse } from "../lib/dto";
import { CompanySettings } from "./company-settings";

const api = vi.hoisted(() => ({
  createCompanyRequest: vi.fn(),
  fetchCompanies: vi.fn(),
  updateCompanyRequest: vi.fn(),
}));
const dashboardApi = vi.hoisted(() => ({
  fetchProjectDashboard: vi.fn(),
}));
const projectApi = vi.hoisted(() => ({
  createProjectRequest: vi.fn(),
  deleteProjectDocumentRequest: vi.fn(),
  fetchCompanyProjects: vi.fn(),
  fetchProject: vi.fn(),
  fetchProjectDocuments: vi.fn(),
  updateProjectRequest: vi.fn(),
  uploadProjectDocuments: vi.fn(),
  uploadProjectDocument: vi.fn(),
}));
const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("../api", () => api);
vi.mock("@/features/dashboard/api", () => dashboardApi);
vi.mock("@/features/projects/api", () => projectApi);
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/remote/api-client", () => ({
  extractApiErrorCode: (error: { code?: string }) => error?.code ?? null,
  extractApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const company = (overrides: Partial<CompanyResponse> = {}): CompanyResponse => ({
  businessRegistrationNumber: "1234567890",
  businessType: "sole_proprietor",
  companyName: "기존 기업",
  companySize: "small_enterprise",
  corporateRegistrationNumber: null,
  createdAt: "2026-06-22T00:00:00.000Z",
  foundedAt: "2020-01-01",
  id: "11111111-1111-4111-8111-111111111111",
  profileStatus: "complete",
  updatedAt: "2026-06-22T00:00:00.000Z",
  ...overrides,
});

const project = {
  agreementEndDate: "2026-12-31",
  agreementStartDate: "2026-01-01",
  assignmentName: "Grant Project",
  assignmentNumber: "A-001",
  companyId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-06-22T00:00:00.000Z",
  governmentSubsidyAmount: 700,
  hostInstitution: "KISED",
  id: "22222222-2222-4222-8222-222222222222",
  managerEmail: null,
  managerName: "PM",
  managerPhone: null,
  profileStatus: "complete" as const,
  projectName: "Fast Dashboard Project",
  projectNotes: null,
  selfCashAmount: 200,
  selfContributionAmount: 300,
  selfInKindAmount: 100,
  totalProjectBudget: 1000,
  updatedAt: "2026-06-22T00:00:00.000Z",
};

const renderSettings = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<CompanySettings />, { wrapper: Wrapper });
};

describe("CompanySettings", () => {
  beforeEach(() => {
    api.createCompanyRequest.mockReset();
    api.fetchCompanies.mockReset();
    api.updateCompanyRequest.mockReset();
    dashboardApi.fetchProjectDashboard.mockReset();
    projectApi.createProjectRequest.mockReset();
    projectApi.deleteProjectDocumentRequest.mockReset();
    projectApi.fetchCompanyProjects.mockReset();
    projectApi.fetchProject.mockReset();
    projectApi.fetchProjectDocuments.mockReset();
    projectApi.updateProjectRequest.mockReset();
    projectApi.uploadProjectDocuments.mockReset();
    projectApi.uploadProjectDocument.mockReset();
    router.push.mockReset();
  });

  it("keeps the new-company form open when existing companies are present", async () => {
    api.fetchCompanies.mockResolvedValue([company()]);
    renderSettings();

    expect(await screen.findByRole("heading", { name: "기업 정보 수정" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "기업 추가" }));

    expect(screen.getByRole("heading", { name: "새 기업 등록" })).toBeInTheDocument();
    expect(screen.getByLabelText("기업명")).toHaveValue("");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "새 기업 등록" })).toBeInTheDocument();
    });
  });

  it("requires the 13-digit corporate number only for corporations and creates a company", async () => {
    const created = company({
      businessRegistrationNumber: "9876543210",
      businessType: "corporation",
      companyName: "신규 법인",
      corporateRegistrationNumber: "1234567890123",
      id: "33333333-3333-4333-8333-333333333333",
    });
    api.fetchCompanies
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    api.createCompanyRequest.mockResolvedValue(created);
    renderSettings();

    const user = userEvent.setup();
    expect(await screen.findByText("등록된 기업이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByLabelText("법인등록번호")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("기업명"), "신규 법인");
    await user.selectOptions(screen.getByLabelText("회사 형태"), "corporation");
    await user.selectOptions(screen.getByLabelText("기업규모"), "small_enterprise");
    await user.type(screen.getByLabelText("사업자등록번호"), "987-65-43210");
    await user.type(screen.getByLabelText("설립일"), "2020-01-01");
    await user.type(screen.getByLabelText("법인등록번호"), "123456-7890123");
    await user.click(screen.getByRole("button", { name: "기업 등록" }));

    await waitFor(() => {
      expect(api.createCompanyRequest.mock.calls[0]?.[0]).toEqual({
        businessRegistrationNumber: "9876543210",
        businessType: "corporation",
        companyName: "신규 법인",
        companySize: "small_enterprise",
        corporateRegistrationNumber: "1234567890123",
        foundedAt: "2020-01-01",
      });
    });
    expect(await screen.findByRole("heading", { name: "기업 정보 수정" })).toBeInTheDocument();
  });

  it("attaches a registration conflict to the business-number field", async () => {
    api.fetchCompanies.mockResolvedValue([]);
    api.createCompanyRequest.mockRejectedValue({
      code: "COMPANY_REGISTRATION_NUMBER_CONFLICT",
    });
    renderSettings();
    const user = userEvent.setup();

    await screen.findByText("등록된 기업이 없습니다.");
    await user.type(screen.getByLabelText("기업명"), "중복 기업");
    await user.selectOptions(screen.getByLabelText("기업규모"), "small_enterprise");
    await user.type(screen.getByLabelText("사업자등록번호"), "1234567890");
    await user.type(screen.getByLabelText("설립일"), "2020-01-01");
    await user.click(
      screen.getByRole("button", { name: /^기업 등록$/ })
    );

    expect(
      await screen.findByText("이미 등록된 사업자등록번호입니다.")
    ).toBeInTheDocument();
  });

  it("prefetches project navigation targets and uses SPA navigation", async () => {
    const existingCompany = company({ companyName: "Existing Company" });
    api.fetchCompanies.mockResolvedValue([existingCompany]);
    projectApi.fetchCompanyProjects.mockResolvedValue([project]);
    projectApi.fetchProject.mockResolvedValue(project);
    dashboardApi.fetchProjectDashboard.mockResolvedValue({
      categories: [],
      kpis: { burnRatio: 0, remainingAmount: 1000, spentAmount: 0, totalBudget: 1000 },
      project: { id: project.id, name: project.projectName },
    });
    renderSettings();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Existing Company/ }));
    const dashboardButton = await screen.findByRole("button", { name: /^Fast Dashboard Project$/ });

    expect(projectApi.fetchProject).not.toHaveBeenCalled();
    expect(dashboardApi.fetchProjectDashboard).not.toHaveBeenCalled();

    await user.hover(dashboardButton);
    await waitFor(() => expect(dashboardApi.fetchProjectDashboard).toHaveBeenCalledTimes(1));
    await user.click(dashboardButton);
    expect(router.push).toHaveBeenCalledWith(`/projects/${project.id}`);

    const managementButton = screen.getByRole("button", { name: /Fast Dashboard Project 관리/ });
    await user.hover(managementButton);
    await waitFor(() => expect(projectApi.fetchProject).toHaveBeenCalledTimes(1));
    await user.click(managementButton);
    expect(router.push).toHaveBeenCalledWith(`/settings/company/projects/${project.id}`);
  });
});
