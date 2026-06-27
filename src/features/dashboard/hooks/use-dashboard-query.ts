"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjectDashboard } from "../api";
import { dashboardKeys } from "./dashboard-keys";

export const useDashboardQuery = (projectId: string) => useQuery({
  enabled: Boolean(projectId),
  gcTime: 10 * 60 * 1000,
  queryKey: dashboardKeys.project(projectId),
  queryFn: () => fetchProjectDashboard(projectId),
  staleTime: 2 * 60 * 1000,
});
