export const projectKeys = {
  all: ["projects"] as const,
  companyList: (companyId: string) => ["projects", "company", companyId] as const,
  detail: (projectId: string) => ["projects", "detail", projectId] as const,
  documents: (projectId: string, purpose = "institution_template") => ["projects", "detail", projectId, "documents", purpose] as const,
  evidenceDocuments: (projectId: string) => ["projects", "detail", projectId, "evidence-documents"] as const,
  evidenceTemplateDownloads: (projectId: string) => ["projects", "detail", projectId, "evidence-template-downloads"] as const,
};
