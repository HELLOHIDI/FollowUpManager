export const programEvidencePolicyErrorCodes = {
  documentInvalid: "PROGRAM_POLICY_DOCUMENT_INVALID",
  documentStateConflict: "PROGRAM_POLICY_DOCUMENT_STATE_CONFLICT",
  extractionFailed: "PROGRAM_POLICY_EXTRACTION_FAILED",
  fetchError: "PROGRAM_POLICY_FETCH_ERROR",
  forbidden: "PROGRAM_POLICY_FORBIDDEN",
  integrity: "PROGRAM_POLICY_INTEGRITY",
  notFound: "PROGRAM_POLICY_NOT_FOUND",
  responseInvalid: "PROGRAM_POLICY_RESPONSE_INVALID",
  storageError: "PROGRAM_POLICY_STORAGE_ERROR",
  validation: "PROGRAM_POLICY_VALIDATION",
  writeError: "PROGRAM_POLICY_WRITE_ERROR",
} as const;

export type ProgramEvidencePolicyServiceError =
  (typeof programEvidencePolicyErrorCodes)[keyof typeof programEvidencePolicyErrorCodes];
