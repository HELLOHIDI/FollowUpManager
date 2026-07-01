"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProjectRequest, deleteProjectDocumentRequest, fetchCompanyProjects, fetchProject, fetchProjectDocuments, fetchProjectEvidenceDocuments, fetchProjectEvidenceTemplateDownloads, saveProjectEvidenceDocuments, updateProjectRequest, uploadProjectDocument } from "../api";
import { fetchProjectDashboard } from "@/features/dashboard/api";
import { dashboardKeys } from "@/features/dashboard/hooks/dashboard-keys";
import type { ProjectResponse } from "../lib/dto";
import { projectKeys } from "./project-keys";

const replaceProject = (projects: ProjectResponse[] | undefined, project: ProjectResponse) => {
  if (!projects) return [project];
  const exists = projects.some(({ id }) => id === project.id);
  return exists ? projects.map((current) => current.id === project.id ? project : current) : [...projects, project];
};

export const useCompanyProjectsQuery = (companyId: string, enabled = true) => useQuery({ enabled: enabled && Boolean(companyId), gcTime: 10 * 60 * 1000, queryKey: projectKeys.companyList(companyId), queryFn: () => fetchCompanyProjects(companyId), staleTime: 2 * 60 * 1000 });
export const useProjectQuery = (projectId: string) => useQuery({ gcTime: 10 * 60 * 1000, queryKey: projectKeys.detail(projectId), queryFn: () => fetchProject(projectId), staleTime: 2 * 60 * 1000 });
export const useProjectDocumentsQuery = (projectId: string) => useQuery({ queryKey: projectKeys.documents(projectId), queryFn: () => fetchProjectDocuments(projectId) });
export const useProjectEvidenceDocumentsQuery = (projectId: string) => useQuery({ queryKey: projectKeys.evidenceDocuments(projectId), queryFn: () => fetchProjectEvidenceDocuments(projectId) });
export const useProjectEvidenceTemplateDownloadsQuery = (projectId: string) => useQuery({ queryKey: projectKeys.evidenceTemplateDownloads(projectId), queryFn: () => fetchProjectEvidenceTemplateDownloads(projectId) });

export const useProjectNavigationPrefetch = () => {
  const queryClient = useQueryClient();
  const prefetchProject = (projectId: string) =>
    queryClient.prefetchQuery({ queryKey: projectKeys.detail(projectId), queryFn: () => fetchProject(projectId), staleTime: 2 * 60 * 1000 });
  const prefetchDashboard = (projectId: string) =>
    queryClient.prefetchQuery({ queryKey: dashboardKeys.project(projectId), queryFn: () => fetchProjectDashboard(projectId), staleTime: 2 * 60 * 1000 });

  return { prefetchDashboard, prefetchProject };
};

export const useProjectMutations = () => {
  const queryClient = useQueryClient();
  const applyAuthoritativeProject = (project: ProjectResponse) => {
    queryClient.setQueryData(projectKeys.detail(project.id), project);
    queryClient.setQueryData<ProjectResponse[]>(projectKeys.companyList(project.companyId), (projects) => replaceProject(projects, project));
    void queryClient.invalidateQueries({ queryKey: projectKeys.companyList(project.companyId), refetchType: "inactive" });
  };
  const createMutation = useMutation({ mutationFn: createProjectRequest, onSuccess: applyAuthoritativeProject });
  const updateMutation = useMutation({ mutationFn: updateProjectRequest, onSuccess: applyAuthoritativeProject });
  const uploadMutation = useMutation({ mutationFn: ({ projectId, file }: { projectId: string; file: File }) => uploadProjectDocument(projectId, file), onSuccess: (document) => void queryClient.invalidateQueries({ queryKey: projectKeys.documents(document.projectId) }) });
  const saveEvidenceDocumentsMutation = useMutation({ mutationFn: saveProjectEvidenceDocuments, onSuccess: (_, variables) => {
    void queryClient.invalidateQueries({ queryKey: projectKeys.evidenceDocuments(variables.projectId) });
    void queryClient.invalidateQueries({ queryKey: projectKeys.evidenceTemplateDownloads(variables.projectId) });
  } });
  const deleteDocumentMutation = useMutation({ mutationFn: deleteProjectDocumentRequest, onSuccess: (_, variables) => {
    void queryClient.invalidateQueries({ queryKey: projectKeys.documents(variables.projectId) });
    void queryClient.invalidateQueries({ queryKey: projectKeys.evidenceDocuments(variables.projectId) });
    void queryClient.invalidateQueries({ queryKey: projectKeys.evidenceTemplateDownloads(variables.projectId) });
  } });
  return { createMutation, deleteDocumentMutation, saveEvidenceDocumentsMutation, updateMutation, uploadMutation };
};
