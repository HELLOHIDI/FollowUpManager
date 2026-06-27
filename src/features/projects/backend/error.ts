export const projectErrorCodes = {
  assignmentConflict: "PROJECT_ASSIGNMENT_NUMBER_CONFLICT",
  documentInvalid: "PROJECT_DOCUMENT_INVALID",
  documentStateConflict: "PROJECT_DOCUMENT_STATE_CONFLICT",
  fetchError: "PROJECT_FETCH_ERROR",
  notFound: "PROJECT_NOT_FOUND",
  responseInvalid: "PROJECT_RESPONSE_INVALID",
  storageError: "PROJECT_STORAGE_ERROR",
  writeError: "PROJECT_WRITE_ERROR",
} as const;

export type ProjectServiceError = (typeof projectErrorCodes)[keyof typeof projectErrorCodes];
