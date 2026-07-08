import { z } from "zod";

export const BUSINESS_TYPES = ["corporation", "sole_proprietor"] as const;
export const COMPANY_SIZES = [
  "medium_enterprise",
  "small_enterprise",
  "micro_business",
  "unknown",
] as const;
export const COMPANY_PROFILE_STATUSES = [
  "complete",
  "review_required",
] as const;
export const COMPANY_ACCOUNT_MANAGERS = [
  "정현정",
  "허진석",
  "이영준",
  "주재형",
  "박종열",
  "이정준",
  "류희재",
] as const;

const BUSINESS_REGISTRATION_PATTERN = /^(?:[0-9]{10}|[0-9]{3}-[0-9]{2}-[0-9]{5})$/;
const CORPORATE_REGISTRATION_PATTERN = /^(?:[0-9]{13}|[0-9]{6}-[0-9]{7})$/;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const normalizeIdentifier = (
  value: unknown,
  pattern: RegExp,
  nullable = false
) => {
  if (value === null || value === undefined || value === "") {
    return nullable ? null : value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return pattern.test(trimmed) ? trimmed.replaceAll("-", "") : value;
};

export const getSeoulCalendarDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(date);

const isCalendarDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const businessRegistrationNumberSchema = z.preprocess(
  (value) => normalizeIdentifier(value, BUSINESS_REGISTRATION_PATTERN),
  z.string().regex(/^[0-9]{10}$/, "사업자등록번호는 숫자 10자리여야 합니다.")
);

const corporateRegistrationNumberSchema = z.preprocess(
  (value) =>
    normalizeIdentifier(value, CORPORATE_REGISTRATION_PATTERN, true),
  z
    .string()
    .regex(/^[0-9]{13}$/, "법인등록번호는 숫자 13자리여야 합니다.")
    .nullable()
);
const accountManagerSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(COMPANY_ACCOUNT_MANAGERS, {
    invalid_type_error: "담당자를 선택해 주세요.",
    required_error: "담당자를 선택해 주세요.",
  })
);

export const CompanyParamsSchema = z.object({
  companyId: z.string().uuid("기업 ID가 올바르지 않습니다."),
});

export const CompanyAccountManagerInputSchema = z.object({
  accountManager: accountManagerSchema,
});

export const createCompanyInputSchema = (
  now: Date | (() => Date) = () => new Date()
) =>
  z
    .object({
      accountManager: accountManagerSchema,
      businessRegistrationNumber: businessRegistrationNumberSchema,
      businessType: z.enum(BUSINESS_TYPES),
      companyName: z.string().trim().min(1, "기업명을 입력해 주세요.").max(100),
      companySize: z.enum(COMPANY_SIZES),
      corporateRegistrationNumber:
        corporateRegistrationNumberSchema.optional().default(null),
      foundedAt: z
        .string()
        .refine(isCalendarDate, "설립일 형식이 올바르지 않습니다.")
        .refine(
          (value) =>
            value <=
            getSeoulCalendarDate(typeof now === "function" ? now() : now),
          "설립일은 오늘 이후일 수 없습니다."
        ),
    })
    .superRefine((value, context) => {
      if (
        value.businessType === "corporation" &&
        value.corporateRegistrationNumber === null
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "법인사업자는 법인등록번호가 필요합니다.",
          path: ["corporateRegistrationNumber"],
        });
      }

    })
    .transform((value) =>
      value.businessType === "sole_proprietor"
        ? { ...value, corporateRegistrationNumber: null }
        : value
    );

export const CompanyInputSchema = createCompanyInputSchema();

export const CompanyRowSchema = z.object({
  account_manager: z.enum(COMPANY_ACCOUNT_MANAGERS),
  business_registration_number: z.string().regex(/^[0-9]{10}$/),
  business_type: z.enum(BUSINESS_TYPES),
  company_name: z.string().min(1),
  company_size: z.enum(COMPANY_SIZES),
  corporate_registration_number: z
    .string()
    .regex(/^[0-9]{13}$/)
    .nullable(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
  founded_at: z.string(),
  id: z.string().uuid(),
  profile_status: z.enum(COMPANY_PROFILE_STATUSES),
  updated_at: z.string(),
});

export const CompanyResponseSchema = z
  .object({
    accountManager: z.enum(COMPANY_ACCOUNT_MANAGERS),
    businessRegistrationNumber: z.string().regex(/^[0-9]{10}$/),
    businessType: z.enum(BUSINESS_TYPES),
    companyName: z.string(),
    companySize: z.enum(COMPANY_SIZES),
    corporateRegistrationNumber: z.string().regex(/^[0-9]{13}$/).nullable(),
    createdAt: z.string(),
    foundedAt: z.string(),
    id: z.string().uuid(),
    profileStatus: z.enum(COMPANY_PROFILE_STATUSES),
    updatedAt: z.string(),
  })
  .superRefine((value, context) => {
    const hasValidCorporateNumber =
      value.businessType === "corporation"
        ? value.corporateRegistrationNumber !== null
        : value.corporateRegistrationNumber === null;
    const hasValidProfileStatus =
      value.companySize === "unknown"
        ? value.profileStatus === "review_required"
        : value.profileStatus === "complete";

    if (!hasValidCorporateNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "회사 형태와 법인등록번호가 일치하지 않습니다.",
        path: ["corporateRegistrationNumber"],
      });
    }

    if (!hasValidProfileStatus) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "기업규모와 등록 상태가 일치하지 않습니다.",
        path: ["profileStatus"],
      });
    }
  });

export const CompanyListResponseSchema = z.array(CompanyResponseSchema);

export type CompanyInput = z.infer<typeof CompanyInputSchema>;
export type CompanyResponse = z.infer<typeof CompanyResponseSchema>;
export type CompanyRow = z.infer<typeof CompanyRowSchema>;
