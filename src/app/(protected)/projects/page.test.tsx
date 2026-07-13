import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyResponse } from "@/features/company/lib/dto";
import type { ProjectResponse } from "@/features/projects/lib/dto";
import ProjectsPage from "./page";

const companyApi = vi.hoisted(() => ({
  createCompanyRequest: vi.fn(),
  deleteCompanyRequest: vi.fn(),
  fetchCompanies: vi.fn(),
  updateCompanyRequest: vi.fn(),
}));

const dashboardApi = vi.hoisted(() => ({
  fetchProjectDashboard: vi.fn(),
}));

const projectApi = vi.hoisted(() => ({
  createProjectRequest: vi.fn(),
  deleteProjectDocumentRequest: vi.fn(),
  deleteProjectRequest: vi.fn(),
  fetchCompanyProjects: vi.fn(),
  fetchProject: vi.fn(),
  fetchProjectDocuments: vi.fn(),
  fetchProjectEvidenceDocuments: vi.fn(),
  fetchProjectEvidenceTemplateDownloads: vi.fn(),
  saveProjectEvidenceDocuments: vi.fn(),
  updateProjectRequest: vi.fn(),
  uploadProjectDocument: vi.fn(),
  uploadProjectDocuments: vi.fn(),
}));

vi.mock("@/features/company/api", () => companyApi);
vi.mock("@/features/dashboard/api", () => dashboardApi);
vi.mock("@/features/projects/api", () => projectApi);

const company = (overrides: Partial<CompanyResponse> = {}): CompanyResponse => ({
  accountManager: "정현정",
  businessRegistrationNumber: "1234567890",
  businessType: "sole_proprietor",
  companyName: "테스트 기업",
  companySize: "small_enterprise",
  corporateRegistrationNumber: null,
  createdAt: "2026-06-22T00:00:00.000Z",
  foundedAt: "2020-01-01",
  id: "11111111-1111-4111-8111-111111111111",
  profileStatus: "complete",
  updatedAt: "2026-06-22T00:00:00.000Z",
  ...overrides,
});

const project = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  agreementEndDate: "2026-12-31",
  agreementStartDate: "2026-01-01",
  assignmentName: "사업 과제",
  assignmentNumber: "A-001",
  companyId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-06-22T00:00:00.000Z",
  governmentSubsidyAmount: 700,
  governmentSubsidyRatio: 70,
  hostInstitution: "창업진흥원",
  id: "22222222-2222-4222-8222-222222222222",
  managerEmail: null,
  managerName: "PM",
  managerPhone: null,
  profileStatus: "complete",
  projectName: "운영 대시보드 사업",
  projectNotes: null,
  selfCashAmount: 200,
  selfCashRatio: 20,
  selfContributionAmount: 300,
  selfInKindAmount: 100,
  selfInKindRatio: 10,
  totalProjectBudget: 1000,
  updatedAt: "2026-06-22T00:00:00.000Z",
  ...overrides,
});

const renderProjectsPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<ProjectsPage />, { wrapper: Wrapper });
};

describe("ProjectsPage", () => {
  beforeEach(() => {
    companyApi.createCompanyRequest.mockReset();
    companyApi.deleteCompanyRequest.mockReset();
    companyApi.fetchCompanies.mockReset();
    companyApi.updateCompanyRequest.mockReset();
    dashboardApi.fetchProjectDashboard.mockReset();
    projectApi.fetchCompanyProjects.mockReset();
    projectApi.deleteProjectRequest.mockReset();
    projectApi.fetchProject.mockReset();
    projectApi.fetchProjectDocuments.mockReset();
    projectApi.fetchProjectEvidenceDocuments.mockReset();
    projectApi.fetchProjectEvidenceTemplateDownloads.mockReset();
    projectApi.saveProjectEvidenceDocuments.mockReset();
    projectApi.updateProjectRequest.mockReset();
    projectApi.uploadProjectDocument.mockReset();
    projectApi.uploadProjectDocuments.mockReset();
  });

  it("guides users to company setup when no companies are registered", async () => {
    companyApi.fetchCompanies.mockResolvedValue([]);

    renderProjectsPage();

    expect(
      await screen.findByRole("heading", { name: "등록된 기업이 없습니다" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /기업 정보 등록/ }),
    ).toHaveAttribute("href", "/settings/company?mode=create&returnTo=%2Fprojects");
  });

  it("does not show registration numbers on the company list", async () => {
    companyApi.fetchCompanies.mockResolvedValue([
      company({
        businessType: "corporation",
        corporateRegistrationNumber: "1234561234567",
      }),
    ]);
    projectApi.fetchCompanyProjects.mockResolvedValue([]);

    renderProjectsPage();

    await waitFor(() => expect(projectApi.fetchCompanyProjects).toHaveBeenCalled());
    expect(screen.queryByText(/123-45-67890/)).not.toBeInTheDocument();
    expect(screen.queryByText(/123456-1234567/)).not.toBeInTheDocument();
  });

  it("filters companies by manager team", async () => {
    companyApi.fetchCompanies.mockResolvedValue([
      company({
        accountManager: "정현정",
        companyName: "1팀 기업",
        id: "11111111-1111-4111-8111-111111111111",
      }),
      company({
        accountManager: "허진석",
        companyName: "2팀 기업",
        id: "22222222-2222-4222-8222-222222222222",
      }),
      company({
        accountManager: "손명훈",
        companyName: "블랜 기업",
        id: "33333333-3333-4333-8333-333333333333",
      }),
    ]);
    projectApi.fetchCompanyProjects.mockResolvedValue([]);

    renderProjectsPage();

    expect(await screen.findByText("1팀 기업")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("팀 필터"), "블랜");

    expect(screen.getByText("블랜 기업")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "손명훈" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이하승" })).toBeInTheDocument();
    expect(screen.queryByText("1팀 기업")).not.toBeInTheDocument();
    expect(screen.queryByText("2팀 기업")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "정현정" })).not.toBeInTheDocument();
  });

  it("lists registered companies and links projects to their dashboards", async () => {
    const registeredCompany = company({
      businessType: "corporation",
      corporateRegistrationNumber: "1234561234567",
    });
    const registeredProject = project();
    companyApi.fetchCompanies.mockResolvedValue([registeredCompany]);
    projectApi.fetchCompanyProjects.mockResolvedValue([registeredProject]);
    projectApi.fetchProject.mockResolvedValue(registeredProject);
    dashboardApi.fetchProjectDashboard.mockResolvedValue({
      categories: [],
      kpis: {
        burnRatio: 0,
        remainingAmount: 1000,
        spentAmount: 0,
        totalBudget: 1000,
      },
      project: {
        id: registeredProject.id,
        name: registeredProject.projectName,
      },
    });

    renderProjectsPage();

    expect(await screen.findByText("테스트 기업")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "정현정" })).toBeInTheDocument();
    expect(screen.queryByText("운영 대시보드 사업")).not.toBeInTheDocument();
    expect(screen.queryByText(/사업자등록번호/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^사업 등록$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /기업 정보 수정/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /기업 삭제/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /사업 삭제/ })).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /테스트 기업/ }),
    );
    expect(screen.getByRole("link", { name: /^사업 등록$/ })).toHaveAttribute(
      "href",
      `/settings/company?mode=project-create&projectCompanyId=${registeredCompany.id}&returnTo=%2Fprojects`,
    );
    expect(
      screen.getByRole("link", { name: /기업 정보 수정/ }),
    ).toHaveAttribute(
      "href",
      `/settings/company?companyId=${registeredCompany.id}&returnTo=%2Fprojects`,
    );
    const dashboardLink = await screen.findByRole("link", {
      name: /대시보드/,
    });
    expect(
      screen.getByRole("link", { name: /^사업 등록$/ }).compareDocumentPosition(
        screen.getByText("운영 대시보드 사업"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("운영 대시보드 사업")).toBeInTheDocument();
    expect(screen.queryByText(/창업진흥원/)).not.toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute(
      "href",
      `/projects/${registeredProject.id}`,
    );

    await userEvent.hover(dashboardLink);
    await waitFor(() => {
      expect(dashboardApi.fetchProjectDashboard).toHaveBeenCalledTimes(1);
    });
  });
});
