"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmPolicyRequest,
  fetchPolicyDraftDetail,
  fetchProjectPolicyStatus,
  triggerPolicyExtractionRequest,
  updatePolicyDraftRequest,
  uploadPolicyPdf,
} from "../api";
import { programPolicyKeys } from "./program-policy-keys";
import { expenseKeys } from "@/features/expenses/hooks/expense-keys";
import { dashboardKeys } from "@/features/dashboard/hooks/dashboard-keys";
import { projectKeys } from "@/features/projects/hooks/project-keys";

export const useProjectPolicyStatusQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: programPolicyKeys.status(projectId),
    queryFn: () => fetchProjectPolicyStatus(projectId),
  });

export const usePolicyDraftDetailQuery = (projectId: string, policyVersionId: string | null | undefined) =>
  useQuery({
    enabled: Boolean(projectId && policyVersionId),
    queryKey: programPolicyKeys.detail(projectId, policyVersionId ?? ""),
    queryFn: () => fetchPolicyDraftDetail(projectId, policyVersionId ?? ""),
  });

export const useProgramPolicyMutations = (projectId: string, policyVersionId?: string | null) => {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: programPolicyKeys.status(projectId) });
    if (policyVersionId) {
      void queryClient.invalidateQueries({ queryKey: programPolicyKeys.detail(projectId, policyVersionId) });
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPolicyPdf(projectId, file),
    onSuccess: (intent) => {
      void queryClient.invalidateQueries({ queryKey: programPolicyKeys.status(projectId) });
      void queryClient.invalidateQueries({ queryKey: programPolicyKeys.detail(projectId, intent.policyVersionId) });
    },
  });

  const extractMutation = useMutation({
    mutationFn: ({ extractedText, versionId }: { extractedText?: string | null; versionId: string }) =>
      triggerPolicyExtractionRequest({ extractedText, policyVersionId: versionId, projectId }),
    onSuccess: invalidate,
    onError: invalidate,
  });

  const updateDraftMutation = useMutation({
    mutationFn: (input: Parameters<typeof updatePolicyDraftRequest>[0]["input"]) => {
      if (!policyVersionId) throw new Error("Policy version is required.");
      return updatePolicyDraftRequest({ input, policyVersionId, projectId });
    },
    onSuccess: invalidate,
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!policyVersionId) throw new Error("Policy version is required.");
      return confirmPolicyRequest(projectId, policyVersionId);
    },
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: expenseKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.evidenceDocuments(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.evidenceTemplateDownloads(projectId) });
    },
  });

  return { confirmMutation, extractMutation, updateDraftMutation, uploadMutation };
};
