import { z } from "zod";
import {
  DEFAULT_UPLOAD_MIME_TYPES,
  getUploadMetadata,
  type UploadExtension,
} from "@/lib/file-upload";

export const MAX_SAFE_AMOUNT = BigInt("9007199254740991");
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
export const PROJECT_DOCUMENT_BUCKET = "project-documents";

export const DOCUMENT_MIME_TYPES = DEFAULT_UPLOAD_MIME_TYPES;

export const ProjectDocumentPurposeSchema = z.enum(["general", "institution_template"]);
export type ProjectDocumentPurpose = z.infer<typeof ProjectDocumentPurposeSchema>;
export type DocumentExtension = UploadExtension;

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

export const ProjectEvidenceDocumentTypeSchema = z.object({
  categoryKey: z.string().regex(/^[a-z0-9_]+$/).nullable().optional(),
  categoryName: z.string().trim().nullable().optional(),
  displayName: z.string().trim().min(1).max(200),
  documentKey: z.string().regex(/^[a-z0-9_]+$/),
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  sortOrder: z.number().int(),
  source: z.enum(["policy", "custom"]),
  stageKey: z.literal("execution_request"),
  subcategoryKey: z.string().regex(/^[a-z0-9_]+$/).nullable().optional(),
  subcategoryName: z.string().trim().nullable().optional(),
});

export const ProjectDocumentTemplateLinkSchema = z.object({
  documentKey: z.string().regex(/^[a-z0-9_]+$/),
  documentTypeId: z.string().uuid(),
  projectDocumentId: z.string().uuid(),
  sortOrder: z.number().int(),
});

export const SaveProjectEvidenceDocumentTypeSchema = ProjectEvidenceDocumentTypeSchema.pick({
  categoryKey: true,
  categoryName: true,
  displayName: true,
  documentKey: true,
  sortOrder: true,
  source: true,
  stageKey: true,
  subcategoryKey: true,
  subcategoryName: true,
}).extend({ id: z.string().uuid().optional() });

export const SaveProjectDocumentTemplateLinkSchema = ProjectDocumentTemplateLinkSchema.pick({
  documentKey: true,
  projectDocumentId: true,
  sortOrder: true,
}).extend({ documentTypeId: z.string().uuid().optional() });

export const SaveProjectEvidenceDocumentsInputSchema = z.object({
  documentTypes: z.array(SaveProjectEvidenceDocumentTypeSchema),
  links: z.array(SaveProjectDocumentTemplateLinkSchema),
}).strict();

export const ProjectEvidenceTemplateSetupResponseSchema = z.object({
  documentTypes: z.array(ProjectEvidenceDocumentTypeSchema),
  links: z.array(ProjectDocumentTemplateLinkSchema),
});

export const ProjectEvidenceTemplateDownloadSchema = z.object({
  documentKey: z.string(),
  documentTypeId: z.string().uuid(),
  fileSize: z.number(),
  id: z.string().uuid(),
  originalFileName: z.string(),
  sortOrder: z.number(),
});
export const ProjectEvidenceTemplateDownloadListSchema = z.array(ProjectEvidenceTemplateDownloadSchema);

export const ProjectInputSchema = z
  .object({
    agreementEndDate: dateSchema,
    agreementStartDate: dateSchema,
    assignmentName: z.string().trim().min(1).max(200),
    assignmentNumber: optionalText(100),
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
  purpose: ProjectDocumentPurposeSchema.default("institution_template"),
}).strict();

export const getDocumentMetadata = (input: z.infer<typeof UploadIntentInputSchema>) =>
  getUploadMetadata({
    browserMimeType: input.browserMimeType,
    originalFileName: input.originalFileName,
  });

export const ProjectResponseSchema = z.object({
  agreementEndDate: z.string(), agreementStartDate: z.string(), assignmentName: z.string(), assignmentNumber: z.string().nullable(),
  companyId: z.string().uuid(), createdAt: z.string(), governmentSubsidyAmount: z.number(), hostInstitution: z.string(), id: z.string().uuid(),
  managerEmail: z.string().nullable(), managerName: z.string(), managerPhone: z.string().nullable(), profileStatus: z.literal("complete"),
  projectName: z.string(), projectNotes: z.string().nullable(), selfCashAmount: z.number(), selfContributionAmount: z.number(),
  selfInKindAmount: z.number(), totalProjectBudget: z.number(), updatedAt: z.string(),
});
export const ProjectListResponseSchema = z.array(ProjectResponseSchema);

export const ProjectDocumentResponseSchema = z.object({
  createdAt: z.string(), fileSize: z.number(), id: z.string().uuid(), mimeType: z.string(), originalFileName: z.string(), projectId: z.string().uuid(),
  purpose: ProjectDocumentPurposeSchema.default("institution_template"),
});
export const ProjectDocumentListResponseSchema = z.array(ProjectDocumentResponseSchema);

export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type ProjectDocumentResponse = z.infer<typeof ProjectDocumentResponseSchema>;
export type ProjectEvidenceDocumentType = z.infer<typeof ProjectEvidenceDocumentTypeSchema>;
export type ProjectDocumentTemplateLink = z.infer<typeof ProjectDocumentTemplateLinkSchema>;
export type ProjectEvidenceTemplateSetupResponse = z.infer<typeof ProjectEvidenceTemplateSetupResponseSchema>;
export type ProjectEvidenceTemplateDownload = z.infer<typeof ProjectEvidenceTemplateDownloadSchema>;
export type SaveProjectEvidenceDocumentsInput = z.infer<typeof SaveProjectEvidenceDocumentsInputSchema>;
export type UploadIntentInput = z.infer<typeof UploadIntentInputSchema>;
