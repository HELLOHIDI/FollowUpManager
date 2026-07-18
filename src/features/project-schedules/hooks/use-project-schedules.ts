"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProjectScheduleRequest, deleteProjectScheduleRequest, fetchProjectSchedules, updateProjectScheduleRequest } from "../api";
import type { ProjectScheduleView } from "../backend/schema";
import { scheduleKeys } from "./schedule-keys";

export const useProjectSchedulesQuery = (projectId: string, view: ProjectScheduleView = "upcoming") => useQuery({
  enabled: Boolean(projectId),
  queryKey: scheduleKeys.list(projectId, view),
  queryFn: () => fetchProjectSchedules(projectId, view),
  staleTime: 60_000,
});

export const useProjectScheduleMutations = () => {
  const queryClient = useQueryClient();
  const refresh = (projectId: string) => queryClient.invalidateQueries({ queryKey: [...scheduleKeys.all, projectId] });
  return {
    createMutation: useMutation({ mutationFn: createProjectScheduleRequest, onSuccess: (_, { projectId }) => refresh(projectId) }),
    updateMutation: useMutation({ mutationFn: updateProjectScheduleRequest, onSuccess: (_, { projectId }) => refresh(projectId) }),
    deleteMutation: useMutation({ mutationFn: deleteProjectScheduleRequest, onSuccess: (_, { projectId }) => refresh(projectId) }),
  };
};
