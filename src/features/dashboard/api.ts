"use client";

import { apiClient } from "@/lib/remote/api-client";
import { DashboardResponseSchema } from "./backend/schema";

export const fetchProjectDashboard = async (projectId: string) =>
  DashboardResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}/dashboard`)).data);
