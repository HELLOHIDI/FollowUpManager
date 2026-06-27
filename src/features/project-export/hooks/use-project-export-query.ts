"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjectExport } from "../api";
import type { ProjectExportQuery } from "../backend/schema";
import { projectExportKeys } from "./project-export-keys";

export const useProjectExportQuery = (projectId: string, filters: ProjectExportQuery) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: projectExportKeys.project(projectId, filters),
    queryFn: () => fetchProjectExport(projectId, filters),
  });
