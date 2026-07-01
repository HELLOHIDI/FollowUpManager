"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpenseRequest,
  createExpenseEvidenceSignedUrlRequest,
  deleteExpenseEvidenceRequest,
  fetchProjectExpenseEvidence,
  fetchProjectExpenseDetail,
  fetchProjectExpenseHistory,
  fetchProjectExpensesPage,
  relinkExpenseEvidenceRequest,
  updateExpenseRequest,
  updateExpenseStageRequest,
  uploadExpenseEvidenceRequest,
  waiveExpenseEvidenceRequirementRequest,
} from "../api";
import { dashboardKeys } from "@/features/dashboard/hooks/dashboard-keys";
import type { ExpenseDetailResponse, ExpenseResponse } from "../backend/schema";
import { expenseKeys } from "./expense-keys";

export const useProjectExpensesQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: expenseKeys.project(projectId),
    queryFn: () => fetchProjectExpensesPage(projectId),
  });

export const useExpenseMutations = (projectId: string) => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createExpenseRequest>[0]["input"]) =>
      createExpenseRequest({ projectId, input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.project(projectId) });
    },
  });

  return { createMutation };
};

export const useExpenseDetailQuery = (projectId: string, expenseId: string) =>
  useQuery({
    enabled: Boolean(projectId && expenseId),
    gcTime: 10 * 60 * 1000,
    queryKey: expenseKeys.detail(projectId, expenseId),
    queryFn: () => fetchProjectExpenseDetail(projectId, expenseId),
    staleTime: 2 * 60 * 1000,
  });

export const useExpenseDetailPrefetch = (projectId: string) => {
  const queryClient = useQueryClient();

  return (expenseId: string) =>
    queryClient.prefetchQuery({
      queryKey: expenseKeys.detail(projectId, expenseId),
      queryFn: () => fetchProjectExpenseDetail(projectId, expenseId),
      staleTime: 2 * 60 * 1000,
    });
};

export const useExpenseHistoryQuery = (projectId: string, expenseId: string) =>
  useQuery({
    enabled: Boolean(projectId && expenseId),
    queryKey: expenseKeys.history(projectId, expenseId),
    queryFn: () => fetchProjectExpenseHistory(projectId, expenseId),
  });

export const useExpenseEvidenceQuery = (projectId: string, expenseId: string) =>
  useQuery({
    enabled: Boolean(projectId && expenseId),
    queryKey: expenseKeys.evidence(projectId, expenseId),
    queryFn: () => fetchProjectExpenseEvidence(projectId, expenseId),
  });

export const useExpenseDetailMutations = (projectId: string, expenseId: string) => {
  const queryClient = useQueryClient();
  const mergeExpenseDetail = (expense: ExpenseResponse) => {
    queryClient.setQueryData<ExpenseDetailResponse>(expenseKeys.detail(projectId, expenseId), (current) =>
      current ? { ...current, ...expense, categoryOptions: current.categoryOptions } : current,
    );
  };

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateExpenseRequest>[0]["input"]) =>
      updateExpenseRequest({ projectId, expenseId, input }),
    onSuccess: (expense) => {
      mergeExpenseDetail(expense);
      void queryClient.invalidateQueries({ queryKey: expenseKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.history(projectId, expenseId) });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.project(projectId) });
    },
  });

  return { updateMutation };
};

export const useExpenseEvidenceMutations = (projectId: string, expenseId: string) => {
  const queryClient = useQueryClient();
  const invalidateEvidence = () => {
    void queryClient.invalidateQueries({ queryKey: expenseKeys.evidence(projectId, expenseId) });
    void queryClient.invalidateQueries({ queryKey: expenseKeys.history(projectId, expenseId) });
    void queryClient.invalidateQueries({ queryKey: expenseKeys.detail(projectId, expenseId) });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.project(projectId) });
  };

  const uploadMutation = useMutation({
    mutationFn: (input: Omit<Parameters<typeof uploadExpenseEvidenceRequest>[0], "projectId" | "expenseId">) =>
      uploadExpenseEvidenceRequest({ projectId, expenseId, ...input }),
    onSuccess: invalidateEvidence,
  });

  const signedUrlMutation = useMutation({
    mutationFn: (evidenceId: string) =>
      createExpenseEvidenceSignedUrlRequest({ projectId, expenseId, evidenceId }),
  });

  const relinkMutation = useMutation({
    mutationFn: (input: Omit<Parameters<typeof relinkExpenseEvidenceRequest>[0], "projectId" | "expenseId">) =>
      relinkExpenseEvidenceRequest({ projectId, expenseId, ...input }),
    onSuccess: invalidateEvidence,
  });

  const waiveRequirementMutation = useMutation({
    mutationFn: (input: Omit<Parameters<typeof waiveExpenseEvidenceRequirementRequest>[0], "projectId" | "expenseId">) =>
      waiveExpenseEvidenceRequirementRequest({ projectId, expenseId, ...input }),
    onSuccess: invalidateEvidence,
  });

  const deleteMutation = useMutation({
    mutationFn: (evidenceId: string) =>
      deleteExpenseEvidenceRequest({ projectId, expenseId, evidenceId }),
    onSuccess: invalidateEvidence,
  });

  return { deleteMutation, relinkMutation, signedUrlMutation, uploadMutation, waiveRequirementMutation };
};

export const useExpenseStageMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, input }: Omit<Parameters<typeof updateExpenseStageRequest>[0], "projectId">) =>
      updateExpenseStageRequest({ projectId, expenseId, input }),
    onSuccess: (expense) => {
      queryClient.setQueryData<ExpenseDetailResponse>(expenseKeys.detail(projectId, expense.id), (current) =>
        current ? { ...current, ...expense, categoryOptions: current.categoryOptions } : current,
      );
      void queryClient.invalidateQueries({ queryKey: expenseKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.history(projectId, expense.id) });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.project(projectId) });
    },
  });
};
