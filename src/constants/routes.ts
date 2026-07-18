export const routes = {
  projects: "/projects",
  faq: "/faq",
  companySettings: "/settings/company",
  discordSettings: "/settings/discord",
  companyCreate: (returnTo?: string) =>
    `/settings/company?mode=create${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`,
  companyEdit: (companyId: string, returnTo?: string) =>
    `/settings/company?companyId=${encodeURIComponent(companyId)}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`,
  companyProjectCreate: (companyId: string, returnTo?: string) =>
    `/settings/company?mode=project-create&projectCompanyId=${encodeURIComponent(companyId)}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`,
  project: (projectId: string) => `/projects/${encodeURIComponent(projectId)}`,
  projectExpenses: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/expenses`,
  projectSchedules: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/schedules`,
  projectManagement: (projectId: string) =>
    `/settings/company/projects/${encodeURIComponent(projectId)}`,
  projectSetup: (projectId: string) =>
    `/settings/company/projects/${encodeURIComponent(projectId)}/setup`,
  projectSetupTemplates: (projectId: string) =>
    `/settings/company/projects/${encodeURIComponent(projectId)}/setup/templates`,
  expense: (projectId: string, expenseId: string) =>
    `/projects/${encodeURIComponent(projectId)}/expenses/${encodeURIComponent(expenseId)}`,
  projectExport: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/export`,
} as const;

export const getProjectIdFromPathname = (pathname: string) => {
  const [, encodedProjectId] = pathname.match(/^\/projects\/([^/]+)/) ?? [];

  if (!encodedProjectId) {
    return null;
  }

  try {
    return decodeURIComponent(encodedProjectId);
  } catch {
    return encodedProjectId;
  }
};
