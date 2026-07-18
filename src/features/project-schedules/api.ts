"use client";

import { apiClient } from "@/lib/remote/api-client";
import { ProjectScheduleListSchema, ProjectScheduleSchema, type ProjectScheduleInput, type ProjectScheduleView } from "./backend/schema";

export const fetchProjectSchedules = async (projectId: string, view: ProjectScheduleView = "upcoming") =>
  ProjectScheduleListSchema.parse((await apiClient.get(`/api/projects/${projectId}/schedules?view=${view}`)).data);

export const createProjectScheduleRequest = async ({ projectId, input }: { projectId: string; input: ProjectScheduleInput }) =>
  ProjectScheduleSchema.parse((await apiClient.post(`/api/projects/${projectId}/schedules`, input)).data);

export const updateProjectScheduleRequest = async ({ projectId, scheduleId, input }: { projectId: string; scheduleId: string; input: ProjectScheduleInput }) =>
  ProjectScheduleSchema.parse((await apiClient.patch(`/api/projects/${projectId}/schedules/${scheduleId}`, input)).data);

export const deleteProjectScheduleRequest = async ({ projectId, scheduleId }: { projectId: string; scheduleId: string }) => {
  await apiClient.delete(`/api/projects/${projectId}/schedules/${scheduleId}`);
};
