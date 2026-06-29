"use client";

import { apiClient } from "@/lib/remote/api-client";
import { uploadSignedFile } from "@/features/projects/lib/signed-upload";
import {
  PolicyConfirmationPreviewResponseSchema,
  PolicyDraftDetailResponseSchema,
  PolicyDraftUpdateInputSchema,
  PolicySignedUrlResponseSchema,
  PolicyUploadIntentResponseSchema,
  PolicyVersionSummarySchema,
  ProjectPolicyStatusResponseSchema,
  type PolicyDraftUpdateInput,
} from "./backend/schema";

export const fetchProjectPolicyStatus = async (projectId: string) =>
  ProjectPolicyStatusResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}/program-policy/status`)).data);

export const fetchPolicyDraftDetail = async (projectId: string, policyVersionId: string) =>
  PolicyDraftDetailResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}/program-policy/${policyVersionId}`)).data);

export const updatePolicyDraftRequest = async ({
  input,
  policyVersionId,
  projectId,
}: {
  input: PolicyDraftUpdateInput;
  policyVersionId: string;
  projectId: string;
}) =>
  PolicyDraftDetailResponseSchema.parse(
    (await apiClient.patch(`/api/projects/${projectId}/program-policy/${policyVersionId}`, PolicyDraftUpdateInputSchema.parse(input))).data,
  );

export const triggerPolicyExtractionRequest = async ({
  extractedText,
  policyVersionId,
  projectId,
}: {
  extractedText?: string | null;
  policyVersionId: string;
  projectId: string;
}) =>
  PolicyDraftDetailResponseSchema.parse(
    (await apiClient.post(`/api/projects/${projectId}/program-policy/${policyVersionId}/extract`, { extractedText: extractedText ?? null })).data,
  );

export const previewPolicyConfirmationRequest = async (projectId: string, policyVersionId: string) =>
  PolicyConfirmationPreviewResponseSchema.parse(
    (await apiClient.post(`/api/projects/${projectId}/program-policy/${policyVersionId}/confirmation-preview`)).data,
  );

export const confirmPolicyRequest = async (projectId: string, policyVersionId: string) =>
  PolicyVersionSummarySchema.parse((await apiClient.post(`/api/projects/${projectId}/program-policy/${policyVersionId}/confirm`)).data);

export const getPolicyDocumentSignedUrl = async (projectId: string, policyVersionId: string, documentId: string) =>
  PolicySignedUrlResponseSchema.parse(
    (await apiClient.post(`/api/projects/${projectId}/program-policy/${policyVersionId}/documents/${documentId}/signed-url`)).data,
  );

export const uploadPolicyPdf = async (projectId: string, file: File) => {
  const intent = PolicyUploadIntentResponseSchema.parse(
    (await apiClient.post(`/api/projects/${projectId}/program-policy/upload-intents`, {
      browserMimeType: file.type || null,
      fileSize: file.size,
      originalFileName: file.name,
      role: "primary",
    })).data,
  );
  await uploadSignedFile({ canonicalMimeType: intent.canonicalMimeType, file, signedUrl: intent.signedUrl });
  await apiClient.post(`/api/projects/${projectId}/program-policy/${intent.policyVersionId}/documents/${intent.documentId}/complete`);
  return intent;
};
