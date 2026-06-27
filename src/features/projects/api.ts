"use client";

import { apiClient } from "@/lib/remote/api-client";
import { ProjectDocumentListResponseSchema, ProjectDocumentResponseSchema, ProjectListResponseSchema, ProjectResponseSchema, type ProjectInput } from "./lib/dto";
import { uploadSignedFile } from "./lib/signed-upload";

export const fetchCompanyProjects = async (companyId: string) => ProjectListResponseSchema.parse((await apiClient.get(`/api/companies/${companyId}/projects`)).data);
export const fetchProject = async (projectId: string) => ProjectResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}`)).data);
export const createProjectRequest = async ({ companyId, input }: { companyId: string; input: ProjectInput }) => ProjectResponseSchema.parse((await apiClient.post(`/api/companies/${companyId}/projects`, input)).data);
export const updateProjectRequest = async ({ projectId, input }: { projectId: string; input: ProjectInput }) => ProjectResponseSchema.parse((await apiClient.patch(`/api/projects/${projectId}`, input)).data);
export const fetchProjectDocuments = async (projectId: string) => ProjectDocumentListResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}/documents`)).data);

export const uploadProjectDocument = async (projectId: string, file: File) => {
  let documentId: string | null = null;
  try {
    const intent = (await apiClient.post(`/api/projects/${projectId}/documents/upload-intents`, {
      browserMimeType: file.type || null, fileSize: file.size, originalFileName: file.name,
    })).data as { canonicalMimeType: string; documentId: string; path: string; signedUrl: string; token: string };
    documentId = intent.documentId;
    await uploadSignedFile({ canonicalMimeType: intent.canonicalMimeType, file, signedUrl: intent.signedUrl });
    return ProjectDocumentResponseSchema.parse((await apiClient.post(`/api/projects/${projectId}/documents/${intent.documentId}/complete`)).data);
  } catch (error) {
    if (documentId) {
      await apiClient.delete(`/api/projects/${projectId}/documents/${documentId}`).catch(() => {
        console.warn("Project document upload cancellation failed", { documentId, projectId });
      });
    }
    throw error;
  }
};

export const uploadProjectDocuments = async (projectId: string, files: File[]) => {
  let cursor = 0;
  let failed = 0;
  const workers = Array.from({ length: Math.min(3, files.length) }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++];
      try { await uploadProjectDocument(projectId, file); } catch { failed += 1; }
    }
  });
  await Promise.all(workers);
  return { failed, succeeded: files.length - failed };
};

export const deleteProjectDocumentRequest = async ({ projectId, documentId }: { projectId: string; documentId: string }) => {
  await apiClient.delete(`/api/projects/${projectId}/documents/${documentId}`);
};
export const getProjectDocumentSignedUrl = async (projectId: string, documentId: string) => (await apiClient.post(`/api/projects/${projectId}/documents/${documentId}/signed-url`)).data as { signedUrl: string };
