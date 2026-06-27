export const routes = {
  projects: "/projects",
  companySettings: "/settings/company",
  project: (projectId: string) => `/projects/${encodeURIComponent(projectId)}`,
  projectExpenses: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/expenses`,
  projectManagement: (projectId: string) =>
    `/settings/company/projects/${encodeURIComponent(projectId)}`,
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
