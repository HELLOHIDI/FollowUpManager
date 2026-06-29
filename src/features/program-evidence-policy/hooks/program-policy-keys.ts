"use client";

export const programPolicyKeys = {
  detail: (projectId: string, policyVersionId: string) => ["program-policy", projectId, policyVersionId] as const,
  status: (projectId: string) => ["program-policy", projectId, "status"] as const,
};
