export const expenseErrorCodes = {
  invalidParams: "INVALID_EXPENSE_PARAMS",
  invalidBody: "INVALID_EXPENSE_BODY",
  notFound: "EXPENSES_PROJECT_NOT_FOUND",
  integrity: "EXPENSES_INTEGRITY_ERROR",
  fetchError: "EXPENSES_FETCH_ERROR",
  categoryMismatch: "EXPENSE_CATEGORY_MISMATCH",
  invalidStageTransition: "INVALID_EXPENSE_STAGE_TRANSITION",
  evidenceInvalid: "EXPENSE_EVIDENCE_INVALID",
  evidenceStorageError: "EXPENSE_EVIDENCE_STORAGE_ERROR",
  evidenceStateConflict: "EXPENSE_EVIDENCE_STATE_CONFLICT",
} as const;
