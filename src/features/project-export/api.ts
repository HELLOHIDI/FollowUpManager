"use client";

import { apiClient } from "@/lib/remote/api-client";
import { ProjectExportResponseSchema, type ProjectExportQuery } from "./backend/schema";

const buildProjectExportParams = (filters: ProjectExportQuery) => {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", filters.from);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
};

export const fetchProjectExport = async (projectId: string, filters: ProjectExportQuery) => {
  const query = buildProjectExportParams(filters);
  const path = `/api/projects/${projectId}/export${query ? `?${query}` : ""}`;
  return ProjectExportResponseSchema.parse((await apiClient.get(path)).data);
};
