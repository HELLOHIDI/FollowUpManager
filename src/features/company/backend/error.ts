export const companyErrorCodes = {
  fetchError: "COMPANY_FETCH_ERROR",
  notFound: "COMPANY_NOT_FOUND",
  registrationNumberConflict: "COMPANY_REGISTRATION_NUMBER_CONFLICT",
  responseInvalid: "COMPANY_RESPONSE_INVALID",
  writeError: "COMPANY_WRITE_ERROR",
} as const;

export type CompanyServiceError =
  (typeof companyErrorCodes)[keyof typeof companyErrorCodes];
