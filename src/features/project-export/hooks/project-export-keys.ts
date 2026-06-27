import type { ProjectExportQuery } from "../backend/schema";

export const projectExportKeys = {
  project: (projectId: string, filters: ProjectExportQuery) =>
    ["project-export", projectId, filters] as const,
};
