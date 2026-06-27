export const expenseKeys = {
  project: (projectId: string) => ["expenses", "project", projectId] as const,
  detail: (projectId: string, expenseId: string) => ["expenses", "project", projectId, "expense", expenseId] as const,
  history: (projectId: string, expenseId: string) => ["expenses", "project", projectId, "expense", expenseId, "history"] as const,
  evidence: (projectId: string, expenseId: string) => ["expenses", "project", projectId, "expense", expenseId, "evidence"] as const,
} as const;
