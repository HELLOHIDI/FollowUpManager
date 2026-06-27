export const projectKeys = {
  all: ["projects"] as const,
  companyList: (companyId: string) => ["projects", "company", companyId] as const,
  detail: (projectId: string) => ["projects", "detail", projectId] as const,
  documents: (projectId: string) => ["projects", "detail", projectId, "documents"] as const,
};
