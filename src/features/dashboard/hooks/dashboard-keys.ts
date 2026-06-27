export const dashboardKeys = {
  all: ["dashboard"] as const,
  project: (projectId: string) => [...dashboardKeys.all, "project", projectId] as const,
};
