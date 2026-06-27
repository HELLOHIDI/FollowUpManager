import { z } from "zod";

export const MAX_SAFE_AMOUNT = BigInt("9007199254740991");
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
export const PROJECT_DOCUMENT_BUCKET = "project-documents";

export const DOCUMENT_MIME_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwp: "application/octet-stream",
  hwpx: "application/octet-stream",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  zip: "application/zip",
} as const;

export type DocumentExtension = keyof typeof DOCUMENT_MIME_TYPES;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^[0-9+()\- ]{7,20}$/;
const isCalendarDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const dateSchema = z.string().refine(isCalendarDate, "날짜 형식이 올바르지 않습니다.");

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "금액은 0 이상의 정수로 입력해 주세요.")
  .refine((value) => BigInt(value) <= MAX_SAFE_AMOUNT, "금액이 너무 큽니다.");

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional().default(null)
  );

export const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
export const CompanyProjectsParamsSchema = z.object({ companyId: z.string().uuid() });
export const ProjectDocumentParamsSchema = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const ProjectInputSchema = z
  .object({
    agreementEndDate: dateSchema,
    agreementStartDate: dateSchema,
    assignmentName: z.string().trim().min(1).max(200),
    assignmentNumber: z.string().trim().min(1).max(100),
    governmentSubsidyAmount: amountSchema,
    hostInstitution: z.string().trim().min(1).max(200),
    managerEmail: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().email("이메일 형식이 올바르지 않습니다.").max(254).nullable().optional().default(null)
    ),
    managerName: z.string().trim().min(1).max(100),
    managerPhone: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().regex(PHONE_PATTERN, "연락처 형식이 올바르지 않습니다.").nullable().optional().default(null)
    ),
    projectName: z.string().trim().min(1).max(200),
    projectNotes: optionalText(4000),
    selfCashAmount: amountSchema,
    selfInKindAmount: amountSchema,
  })
  .superRefine((value, context) => {
    if (value.agreementEndDate < value.agreementStartDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["agreementEndDate"], message: "협약 종료일은 시작일보다 빠를 수 없습니다." });
    }
    if (!value.managerEmail && !value.managerPhone) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["managerEmail"], message: "담당자 이메일 또는 연락처 중 하나를 입력해 주세요." });
    }
    const total = BigInt(value.governmentSubsidyAmount) + BigInt(value.selfCashAmount) + BigInt(value.selfInKindAmount);
    if (total === BigInt(0)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["governmentSubsidyAmount"], message: "총 사업비는 0보다 커야 합니다." });
    }
    if (total > MAX_SAFE_AMOUNT) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["governmentSubsidyAmount"], message: "총 사업비가 허용 범위를 초과합니다." });
    }
  });

export const UploadIntentInputSchema = z.object({
  browserMimeType: z.string().nullable(),
  fileSize: z.number().int().positive().max(MAX_DOCUMENT_SIZE),
  originalFileName: z.string().trim().min(1).max(255).refine(
    (value) => !value.includes("..") && !/[\\/\u0000-\u001f\u007f]/.test(value),
    "파일명 형식이 올바르지 않습니다."
  ),
}).strict();

export const getDocumentMetadata = (input: z.infer<typeof UploadIntentInputSchema>) => {
  const extension = input.originalFileName.split(".").pop()?.toLowerCase() as DocumentExtension | undefined;
  if (!extension || !(extension in DOCUMENT_MIME_TYPES)) {
    return null;
  }
  const canonical = DOCUMENT_MIME_TYPES[extension];
  const browserMime = input.browserMimeType?.trim().toLowerCase() || null;
  const aliases: Partial<Record<DocumentExtension, string[]>> = {
    hwp: ["application/x-hwp", "application/haansofthwp"],
    hwpx: ["application/zip"],
    docx: ["application/zip"],
    xlsx: ["application/zip"],
    csv: ["text/plain", "application/vnd.ms-excel"],
    zip: ["application/x-zip-compressed"],
  };
  const accepted = !browserMime || browserMime === "application/octet-stream" || browserMime === canonical || aliases[extension]?.includes(browserMime);
  return accepted ? { canonicalMimeType: canonical, extension } : null;
};

export const ProjectResponseSchema = z.object({
  agreementEndDate: z.string(), agreementStartDate: z.string(), assignmentName: z.string(), assignmentNumber: z.string(),
  companyId: z.string().uuid(), createdAt: z.string(), governmentSubsidyAmount: z.number(), hostInstitution: z.string(), id: z.string().uuid(),
  managerEmail: z.string().nullable(), managerName: z.string(), managerPhone: z.string().nullable(), profileStatus: z.literal("complete"),
  projectName: z.string(), projectNotes: z.string().nullable(), selfCashAmount: z.number(), selfContributionAmount: z.number(),
  selfInKindAmount: z.number(), totalProjectBudget: z.number(), updatedAt: z.string(),
});
export const ProjectListResponseSchema = z.array(ProjectResponseSchema);

export const ProjectDocumentResponseSchema = z.object({
  createdAt: z.string(), fileSize: z.number(), id: z.string().uuid(), mimeType: z.string(), originalFileName: z.string(), projectId: z.string().uuid(),
});
export const ProjectDocumentListResponseSchema = z.array(ProjectDocumentResponseSchema);

export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type ProjectDocumentResponse = z.infer<typeof ProjectDocumentResponseSchema>;
export type UploadIntentInput = z.infer<typeof UploadIntentInputSchema>;
