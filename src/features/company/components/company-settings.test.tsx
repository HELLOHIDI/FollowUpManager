import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyResponse } from "../lib/dto";
import { CompanySettings } from "./company-settings";

const api = vi.hoisted(() => ({
  createCompanyRequest: vi.fn(),
  deleteCompanyRequest: vi.fn(),
  fetchCompanies: vi.fn(),
  updateCompanyAccountManagerRequest: vi.fn(),
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
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));
const navigationState = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("../api", () => api);
vi.mock("@/features/dashboard/api", () => dashboardApi);
vi.mock("@/features/projects/api", () => projectApi);
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => navigationState.searchParams,
}));
vi.mock("@/lib/remote/api-client", () => ({
  extractApiErrorCode: (error: { code?: string }) => error?.code ?? null,
  extractApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const company = (overrides: Partial<CompanyResponse> = {}): CompanyResponse => ({
  accountManager: "정현정",
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
  governmentSubsidyRatio: 70,
  hostInstitution: "KISED",
  id: "22222222-2222-4222-8222-222222222222",
  managerEmail: null,
  managerName: "PM",
  managerPhone: null,
  profileStatus: "complete" as const,
  projectName: "Fast Dashboard Project",
  projectNotes: null,
  selfCashAmount: 200,
  selfCashRatio: 20,
  selfContributionAmount: 300,
  selfInKindAmount: 100,
  selfInKindRatio: 10,
  totalProjectBudget: 1000,
  updatedAt: "2026-06-22T00:00:00.000Z",
};

const renderSettings = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
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
    api.deleteCompanyRequest.mockReset();
    api.fetchCompanies.mockReset();
    api.updateCompanyAccountManagerRequest.mockReset();
    api.updateCompanyRequest.mockReset();
    dashboardApi.fetchProjectDashboard.mockReset();
    projectApi.createProjectRequest.mockReset();
    projectApi.deleteProjectDocumentRequest.mockReset();
    projectApi.deleteProjectRequest.mockReset();
    projectApi.fetchCompanyProjects.mockReset();
    projectApi.fetchProject.mockReset();
    projectApi.fetchProjectDocuments.mockReset();
    projectApi.fetchProjectEvidenceDocuments.mockReset();
    projectApi.fetchProjectEvidenceTemplateDownloads.mockReset();
    projectApi.saveProjectEvidenceDocuments.mockReset();
    projectApi.updateProjectRequest.mockReset();
    projectApi.uploadProjectDocument.mockReset();
    projectApi.uploadProjectDocuments.mockReset();
    router.push.mockReset();
    router.replace.mockReset();
    navigationState.searchParams = new URLSearchParams();
  });

  it("redirects the removed default company-settings screen to projects", async () => {
    api.fetchCompanies.mockResolvedValue([company()]);
    renderSettings();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/projects");
    });
  });

  it("opens a focused company-create flow and returns to projects after create", async () => {
    const created = company({
      businessRegistrationNumber: "9876543210",
      companyName: "추가 기업",
      id: "33333333-3333-4333-8333-333333333333",
    });
    navigationState.searchParams = new URLSearchParams(
      "mode=create&returnTo=%2Fprojects",
    );
    api.fetchCompanies.mockResolvedValue([company()]);
    api.createCompanyRequest.mockResolvedValue(created);
    renderSettings();
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "기업 추가하기" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "등록 기업" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("기업명"), "추가 기업");
    await user.selectOptions(await screen.findByLabelText("담당자"), "박종열");
    await user.selectOptions(screen.getByLabelText("기업규모"), "small_enterprise");
    await user.type(screen.getByLabelText("사업자등록번호"), "9876543210");
    await user.type(screen.getByLabelText("설립일"), "2020-01-01");
    await user.click(screen.getByRole("button", { name: "기업 추가하기" }));

    await waitFor(() => {
      expect(api.createCompanyRequest.mock.calls[0]?.[0]).toEqual({
        accountManager: "박종열",
        businessRegistrationNumber: "9876543210",
        businessType: "sole_proprietor",
        companyName: "추가 기업",
        companySize: "small_enterprise",
        corporateRegistrationNumber: null,
        foundedAt: "2020-01-01",
      });
    });
    expect(router.push).toHaveBeenCalledWith("/projects");
  });

  it("opens a focused company-edit flow and returns to projects after update", async () => {
    const existingCompany = company();
    const updated = company({ companyName: "수정 기업" });
    navigationState.searchParams = new URLSearchParams(
      `companyId=${existingCompany.id}&returnTo=%2Fprojects`,
    );
    api.fetchCompanies.mockResolvedValue([existingCompany]);
    api.updateCompanyRequest.mockResolvedValue(updated);
    renderSettings();
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "기업 정보 수정" }),
    ).toBeInTheDocument();
    const companyNameInput = await screen.findByLabelText("기업명");
    await waitFor(() => {
      expect(companyNameInput).toHaveValue("기존 기업");
    });

    await user.clear(companyNameInput);
    await user.type(companyNameInput, "수정 기업");
    await user.click(screen.getByRole("button", { name: "기업 정보 수정" }));

    await waitFor(() => {
      expect(api.updateCompanyRequest.mock.calls[0]?.[0]).toEqual({
        companyId: existingCompany.id,
        input: expect.objectContaining({ companyName: "수정 기업" }),
      });
    });
    expect(router.push).toHaveBeenCalledWith("/projects");
  });

  it("keeps an existing corporate registration number when editing a corporation", async () => {
    const existingCompany = company({
      businessType: "corporation",
      companyName: "기존 법인",
      corporateRegistrationNumber: "1234561234567",
    });
    const updated = company({
      ...existingCompany,
      companyName: "수정 법인",
    });
    navigationState.searchParams = new URLSearchParams(
      `companyId=${existingCompany.id}&returnTo=%2Fprojects`,
    );
    api.fetchCompanies.mockResolvedValue([existingCompany]);
    api.updateCompanyRequest.mockResolvedValue(updated);
    renderSettings();
    const user = userEvent.setup();

    const corporateNumberInput = await screen.findByLabelText("법인등기번호");
    await waitFor(() => {
      expect(corporateNumberInput).toHaveValue("1234561234567");
    });

    const companyNameInput = screen.getByLabelText("기업명");
    await user.clear(companyNameInput);
    await user.type(companyNameInput, "수정 법인");
    await user.click(screen.getByRole("button", { name: "기업 정보 수정" }));

    await waitFor(() => {
      expect(api.updateCompanyRequest.mock.calls[0]?.[0]).toEqual({
        companyId: existingCompany.id,
        input: expect.objectContaining({
          businessType: "corporation",
          corporateRegistrationNumber: "1234561234567",
        }),
      });
    });
  });

  it("updates only the company account manager from the edit form", async () => {
    const existingCompany = company();
    const updated = company({ accountManager: "박종열" });
    navigationState.searchParams = new URLSearchParams(
      `companyId=${existingCompany.id}&returnTo=%2Fprojects`,
    );
    api.fetchCompanies.mockResolvedValue([existingCompany]);
    api.updateCompanyAccountManagerRequest.mockResolvedValue(updated);
    renderSettings();
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "기업 정보 수정" }),
    ).toBeInTheDocument();

    await user.selectOptions(await screen.findByLabelText("담당자"), "박종열");
    await user.click(screen.getByRole("button", { name: "담당자 저장" }));

    await waitFor(() => {
      expect(api.updateCompanyAccountManagerRequest.mock.calls[0]?.[0]).toEqual({
        accountManager: "박종열",
        companyId: existingCompany.id,
      });
    });
    expect(api.updateCompanyRequest).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens a focused project-create flow and navigates to project setup", async () => {
    const existingCompany = company();
    const createdProject = project;
    navigationState.searchParams = new URLSearchParams(
      `mode=project-create&projectCompanyId=${existingCompany.id}&returnTo=%2Fprojects`,
    );
    api.fetchCompanies.mockResolvedValue([existingCompany]);
    projectApi.fetchCompanyProjects.mockResolvedValue([]);
    projectApi.createProjectRequest.mockResolvedValue(createdProject);
    dashboardApi.fetchProjectDashboard.mockResolvedValue({
      categories: [],
      kpis: {
        burnRatio: 0,
        remainingAmount: 1000,
        spentAmount: 0,
        totalBudget: 1000,
      },
      project: { id: createdProject.id, name: createdProject.projectName },
    });
    renderSettings();
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "사업 등록" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("기존 기업")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "등록 기업" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("사업명"), "Fast Dashboard Project");
    await user.type(screen.getByLabelText("주관기관"), "KISED");
    await user.type(screen.getByLabelText("과제번호 (선택)"), "A-001");
    await user.type(screen.getByLabelText("과제명"), "Grant Project");
    await user.type(screen.getByLabelText("협약 시작일"), "2026-01-01");
    await user.type(screen.getByLabelText("협약 종료일"), "2026-12-31");
    await user.type(screen.getByLabelText("기관 담당자명"), "PM");
    await user.type(screen.getByLabelText("기관 담당자 이메일"), "pm@example.com");
    await user.type(screen.getByLabelText("총 사업비"), "1000");
    const governmentSubsidyRatioInput = screen.getByLabelText("정부지원금 비율(%)");
    const selfCashRatioInput = screen.getByLabelText("현금 비율(%)");
    const selfInKindRatioInput = screen.getByLabelText("현물 비율(%)");
    await user.clear(governmentSubsidyRatioInput);
    await user.type(governmentSubsidyRatioInput, "70");
    await user.clear(selfCashRatioInput);
    await user.type(selfCashRatioInput, "20");
    await user.clear(selfInKindRatioInput);
    await user.type(selfInKindRatioInput, "10");
    await user.click(screen.getByRole("button", { name: "사업 등록" }));

    await waitFor(() => {
      expect(projectApi.createProjectRequest.mock.calls[0]?.[0]).toEqual({
        companyId: existingCompany.id,
        input: expect.objectContaining({
          assignmentName: "Grant Project",
          assignmentNumber: "A-001",
          governmentSubsidyRatio: "70",
          hostInstitution: "KISED",
          managerName: "PM",
          projectName: "Fast Dashboard Project",
          selfCashRatio: "20",
          selfInKindRatio: "10",
          totalProjectBudget: "1000",
        }),
      });
    });
    expect(projectApi.uploadProjectDocuments).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(`/settings/company/projects/${createdProject.id}/setup`);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalledWith("/projects");
  });

  it("requires the 13-digit corporate number only for corporations and creates a company", async () => {
    const created = company({
      businessRegistrationNumber: "9876543210",
      businessType: "corporation",
      companyName: "신규 법인",
      corporateRegistrationNumber: "1234567890123",
      id: "33333333-3333-4333-8333-333333333333",
    });
    navigationState.searchParams = new URLSearchParams(
      "mode=create&returnTo=%2Fprojects",
    );
    api.fetchCompanies.mockResolvedValue([]);
    api.createCompanyRequest.mockResolvedValue(created);
    renderSettings();
    const user = userEvent.setup();

    expect(await screen.findByLabelText("기업명")).toBeInTheDocument();
    expect(screen.queryByLabelText("법인등기번호")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("기업명"), "신규 법인");
    await user.selectOptions(screen.getByLabelText("담당자"), "허진석");
    await user.selectOptions(screen.getByLabelText("회사 형태"), "corporation");
    await user.selectOptions(screen.getByLabelText("기업규모"), "small_enterprise");
    await user.type(screen.getByLabelText("사업자등록번호"), "987-65-43210");
    await user.type(screen.getByLabelText("설립일"), "2020-01-01");
    await user.type(screen.getByLabelText("법인등기번호"), "123456-7890123");
    await user.click(screen.getByRole("button", { name: "기업 추가하기" }));

    await waitFor(() => {
      expect(api.createCompanyRequest.mock.calls[0]?.[0]).toEqual({
        accountManager: "허진석",
        businessRegistrationNumber: "9876543210",
        businessType: "corporation",
        companyName: "신규 법인",
        companySize: "small_enterprise",
        corporateRegistrationNumber: "1234567890123",
        foundedAt: "2020-01-01",
      });
    });
    expect(router.push).toHaveBeenCalledWith("/projects");
  });

  it("attaches a registration conflict to the business-number field", async () => {
    navigationState.searchParams = new URLSearchParams(
      "mode=create&returnTo=%2Fprojects",
    );
    api.fetchCompanies.mockResolvedValue([]);
    api.createCompanyRequest.mockRejectedValue({
      code: "COMPANY_REGISTRATION_NUMBER_CONFLICT",
    });
    renderSettings();
    const user = userEvent.setup();

    await screen.findByLabelText("기업명");
    await user.type(screen.getByLabelText("기업명"), "중복 기업");
    await user.selectOptions(screen.getByLabelText("담당자"), "정현정");
    await user.selectOptions(screen.getByLabelText("기업규모"), "small_enterprise");
    await user.type(screen.getByLabelText("사업자등록번호"), "1234567890");
    await user.type(screen.getByLabelText("설립일"), "2020-01-01");
    await user.click(screen.getByRole("button", { name: "기업 추가하기" }));

    expect(
      await screen.findByText("이미 등록된 사업자등록번호입니다."),
    ).toBeInTheDocument();
  });
});
