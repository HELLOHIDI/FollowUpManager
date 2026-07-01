"use client";

import { apiClient } from "@/lib/remote/api-client";
import {
  ExpenseDetailResponseSchema,
  ExpenseEvidenceDeleteResponseSchema,
  ExpenseEvidenceFileResponseSchema,
  ExpenseEvidenceListResponseSchema,
  ExpenseEvidenceSignedUrlResponseSchema,
  ExpenseHistoryResponseSchema,
  ExpensePageResponseSchema,
  ExpenseResponseSchema,
  type ExpenseCreateInput,
  type ExpenseStageUpdateInput,
  type ExpenseUpdateInput,
} from "./backend/schema";

export const fetchProjectExpensesPage = async (projectId: string) =>
  ExpensePageResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}/expenses`)).data);

export const createExpenseRequest = async ({
  projectId,
  input,
}: {
  projectId: string;
  input: ExpenseCreateInput;
}) =>
  ExpenseResponseSchema.parse((await apiClient.post(`/api/projects/${projectId}/expenses`, input)).data);

export const fetchProjectExpenseDetail = async (projectId: string, expenseId: string) =>
  ExpenseDetailResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}/expenses/${expenseId}`)).data);

export const fetchProjectExpenseHistory = async (projectId: string, expenseId: string) =>
  ExpenseHistoryResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}/expenses/${expenseId}/history`)).data);

export const fetchProjectExpenseEvidence = async (projectId: string, expenseId: string) =>
  ExpenseEvidenceListResponseSchema.parse((await apiClient.get(`/api/projects/${projectId}/expenses/${expenseId}/evidence`)).data);

export const uploadExpenseEvidenceRequest = async ({
  documentKey,
  expenseId,
  file,
  projectId,
  requirementKey,
}: {
  documentKey: string;
  expenseId: string;
  file: File;
  projectId: string;
  requirementKey?: string | null;
}) => {
  const formData = new FormData();
  formData.append("documentKey", documentKey);
  if (requirementKey) {
    formData.append("requirementKey", requirementKey);
  }
  formData.append("file", file);

  return ExpenseEvidenceFileResponseSchema.parse(
    (await apiClient.post(`/api/projects/${projectId}/expenses/${expenseId}/evidence`, formData)).data,
  );
};

export const createExpenseEvidenceSignedUrlRequest = async ({
  evidenceId,
  expenseId,
  projectId,
}: {
  evidenceId: string;
  expenseId: string;
  projectId: string;
}) =>
  ExpenseEvidenceSignedUrlResponseSchema.parse(
    (await apiClient.post(`/api/projects/${projectId}/expenses/${expenseId}/evidence/${evidenceId}/signed-url`)).data,
  );

export const relinkExpenseEvidenceRequest = async ({
  documentKey,
  evidenceId,
  expenseId,
  projectId,
  requirementKey,
}: {
  documentKey: string;
  evidenceId: string;
  expenseId: string;
  projectId: string;
  requirementKey: string | null;
}) =>
  ExpenseEvidenceFileResponseSchema.parse(
    (await apiClient.patch(`/api/projects/${projectId}/expenses/${expenseId}/evidence/${evidenceId}/link`, {
      documentKey,
      requirementKey,
    })).data,
  );

export const waiveExpenseEvidenceRequirementRequest = async ({
  expenseId,
  projectId,
  requirementKey,
  waivedReason,
}: {
  expenseId: string;
  projectId: string;
  requirementKey: string;
  waivedReason?: string | null;
}) =>
  ExpenseEvidenceListResponseSchema.parse(
    (await apiClient.put(`/api/projects/${projectId}/expenses/${expenseId}/evidence-requirements/${requirementKey}/status`, {
      status: "waived",
      waivedReason: waivedReason ?? null,
    })).data,
  );

export const deleteExpenseEvidenceRequest = async ({
  evidenceId,
  expenseId,
  projectId,
}: {
  evidenceId: string;
  expenseId: string;
  projectId: string;
}) =>
  ExpenseEvidenceDeleteResponseSchema.parse(
    (await apiClient.delete(`/api/projects/${projectId}/expenses/${expenseId}/evidence/${evidenceId}`)).data,
  );

export const updateExpenseRequest = async ({
  projectId,
  expenseId,
  input,
}: {
  projectId: string;
  expenseId: string;
  input: ExpenseUpdateInput;
}) =>
  ExpenseResponseSchema.parse((await apiClient.patch(`/api/projects/${projectId}/expenses/${expenseId}`, input)).data);

export const updateExpenseStageRequest = async ({
  projectId,
  expenseId,
  input,
}: {
  projectId: string;
  expenseId: string;
  input: ExpenseStageUpdateInput;
}) =>
  ExpenseResponseSchema.parse((await apiClient.patch(`/api/projects/${projectId}/expenses/${expenseId}/stage`, input)).data);
