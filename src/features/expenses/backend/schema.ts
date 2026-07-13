import { z } from "zod";
import { EXPENSE_FUNDING_SOURCE_KEYS, EXPENSE_STAGES } from "@/features/domain/contracts";
import {
  DEFAULT_BLOCKED_UPLOAD_EXTENSIONS,
  DEFAULT_UPLOAD_MIME_TYPES,
  getUploadMetadata,
  type UploadExtension,
} from "@/lib/file-upload";

const safeAmount = z.number().int().safe().nonnegative();
export const MAX_EVIDENCE_FILE_SIZE = 20 * 1024 * 1024;
export const EXPENSE_EVIDENCE_BUCKET = "expense-evidence";
export const EVIDENCE_MIME_TYPES = DEFAULT_UPLOAD_MIME_TYPES;
export const BLOCKED_EVIDENCE_EXTENSIONS = DEFAULT_BLOCKED_UPLOAD_EXTENSIONS;
export const EVIDENCE_DOCUMENT_OPTIONS = [
  { key: "tax_invoice", label: "Tax invoice" },
  { key: "credit_card_receipt", label: "Credit card receipt" },
  { key: "transfer_receipt", label: "Transfer receipt" },
  { key: "quote", label: "Quote" },
  { key: "comparative_quote", label: "Comparative quote" },
  { key: "contract", label: "Contract" },
  { key: "purchase_order", label: "Purchase order" },
  { key: "statement_of_work", label: "Statement of work" },
  { key: "result_report", label: "Result report" },
  { key: "inspection_report", label: "Inspection report" },
  { key: "evidence_photo", label: "현장 사진" },
  { key: "deliverable_file", label: "Deliverable file" },
  { key: "vendor_business_registration", label: "Vendor business registration" },
  { key: "vendor_bankbook_copy", label: "Vendor bankbook copy" },
  { key: "pre_approval_document", label: "Pre-approval document" },
  { key: "institution_confirmation", label: "Institution confirmation" },
  { key: "advance_payment_bond", label: "Advance payment bond" },
  { key: "pledge_letter", label: "Pledge letter" },
  { key: "license_certificate", label: "License certificate" },
  { key: "ip_application_request", label: "IP application request" },
  { key: "ip_registration_certificate", label: "IP registration certificate" },
  { key: "official_fee_receipt", label: "Official fee receipt" },
  { key: "delegation_contract", label: "Delegation contract" },
  { key: "four_insurance_certificate", label: "Four insurance certificate" },
  { key: "employment_contract", label: "Employment contract" },
  { key: "resume", label: "Resume" },
  { key: "employee_id_card", label: "Employee ID card" },
  { key: "employee_bankbook_copy", label: "Employee bankbook copy" },
  { key: "integrity_pledge", label: "Integrity pledge" },
  { key: "payroll_statement", label: "Payroll statement" },
  { key: "salary_transfer_receipt", label: "Salary transfer receipt" },
  { key: "withholding_receipt", label: "Withholding receipt" },
  { key: "withholding_ledger", label: "Withholding ledger" },
  { key: "insurance_payment_confirmation", label: "Insurance payment confirmation" },
  { key: "retirement_pension_statement", label: "Retirement pension statement" },
  { key: "health_check_confirmation", label: "Health check confirmation" },
  { key: "travel_plan", label: "Travel plan" },
  { key: "transportation_receipt", label: "Transportation receipt" },
  { key: "boarding_pass", label: "Boarding pass" },
  { key: "travel_result_report", label: "Travel result report" },
  { key: "toll_receipt", label: "Toll receipt" },
  { key: "training_application", label: "Training application" },
  { key: "training_material", label: "Training material" },
  { key: "payment_receipt", label: "Payment receipt" },
  { key: "completion_certificate", label: "Completion certificate" },
  { key: "participation_certificate", label: "Participation certificate" },
  { key: "promotional_material", label: "Promotional material" },
  { key: "advertising_result", label: "Advertising result" },
  { key: "etc", label: "Other" },
] as const;

export type EvidenceExtension = UploadExtension;

const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const stageKeys = EXPENSE_STAGES.map(({ key }) => key) as [
  (typeof EXPENSE_STAGES)[number]["key"],
  ...(typeof EXPENSE_STAGES)[number]["key"][],
];

export const PreApprovalStatusSchema = z.enum([
  "not_required",
  "required",
  "requested",
  "approved",
  "rejected",
  "needs_review",
]);

export const ExecutionProgressStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "delayed",
  "completed",
  "needs_review",
]);

export const ExecutionRequestStatusSchema = z.enum([
  "draft",
  "ready_to_submit",
  "submitted",
  "needs_supplement",
  "completed",
]);

const ExpenseStageChecklistSchema = z.object({
  prepared: z.boolean().optional(),
  managerConfirmed: z.boolean().optional(),
  pmsRegistered: z.boolean().optional(),
  finalApproved: z.boolean().optional(),
  progress: z.enum(["prepared", "managerConfirmed", "pmsRegistered", "finalApproved"]).nullable().default(null),
  memo: z.string().trim().max(2000).nullable().default(null),
});

export const ExpenseStageFieldsSchema = z.object({
  preApprovalMemo: z.string().trim().max(2000).nullable().optional(),
  approvalReference: z.string().trim().max(500).nullable().optional(),
  executionMemo: z.string().trim().max(2000).nullable().optional(),
  deliverableMemo: z.string().trim().max(2000).nullable().optional(),
  executionRequestMemo: z.string().trim().max(2000).nullable().optional(),
  procedures: z.record(
    z.enum(stageKeys),
    z.record(
      z.enum(["preparation", "ownerCheck", "pmsRegistration", "finalApproval"]),
      z.object({
        completed: z.boolean().optional(),
        completedDate: nullableDate.optional(),
        memo: z.string().trim().max(500).nullable().optional(),
      }).partial(),
    ).optional(),
  ).optional(),
  stageChecklists: z.record(ExpenseStageChecklistSchema).default({}),
});

export const ExpenseParamsSchema = z.object({
  projectId: z.string().uuid(),
});

export const ExpenseDetailParamsSchema = z.object({
  projectId: z.string().uuid(),
  expenseId: z.string().uuid(),
});

export const ExpenseEvidenceParamsSchema = ExpenseDetailParamsSchema.extend({
  evidenceId: z.string().uuid(),
});

export const ExpenseEvidenceDocumentKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9_]+$/);

export const ExpenseEvidenceUploadInputSchema = z
  .object({
    browserMimeType: z.string().nullable(),
    documentKey: ExpenseEvidenceDocumentKeySchema,
    fileSize: z.number().int().positive().max(MAX_EVIDENCE_FILE_SIZE),
    originalFileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine(
        (value) => !value.includes("..") && !/[\\/\u0000-\u001f\u007f]/.test(value),
        "파일 이름을 확인해 주세요.",
      ),
    requirementKey: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .strict();

export const ExpenseEvidenceRelinkInputSchema = z.object({
  documentKey: ExpenseEvidenceDocumentKeySchema,
  requirementKey: z.string().trim().min(1).max(100).nullable(),
});

export const ExpenseEvidenceRequirementStatusInputSchema = z.object({
  status: z.literal("waived"),
  waivedReason: z.string().trim().max(500).nullable().optional(),
});

export const getEvidenceFileMetadata = (input: z.infer<typeof ExpenseEvidenceUploadInputSchema>) =>
  getUploadMetadata({
    blockedExtensions: BLOCKED_EVIDENCE_EXTENSIONS,
    browserMimeType: input.browserMimeType,
    originalFileName: input.originalFileName,
  });

export const ExpenseCreateInputSchema = z.object({
  title: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  subcategoryKey: z.string().trim().min(1).nullable().optional(),
  fundingSourceKey: z.enum(EXPENSE_FUNDING_SOURCE_KEYS),
  amount: safeAmount,
  expectedSpendDate: nullableDate.optional(),
  memo: z.string().trim().max(2000).nullable().optional(),
});

export const ExpenseUpdateInputSchema = z.object({
  title: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  subcategoryKey: z.string().trim().min(1).nullable().optional(),
  fundingSourceKey: z.enum(EXPENSE_FUNDING_SOURCE_KEYS),
  amount: safeAmount,
  expectedSpendDate: nullableDate,
  vendorName: z.string().trim().max(200).nullable(),
  memo: z.string().trim().max(2000).nullable(),
  preApprovalStatus: PreApprovalStatusSchema.nullable(),
  executionProgressStatus: ExecutionProgressStatusSchema.nullable(),
  executionRequestStatus: ExecutionRequestStatusSchema.nullable(),
  executionRequestDate: nullableDate,
  stageFields: ExpenseStageFieldsSchema,
});

export const ExpenseStageUpdateInputSchema = z.object({
  targetStageKey: z.enum(stageKeys),
});

export const ExpenseCategoryOptionSchema = z.object({
  categoryKey: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  sortOrder: z.number().int(),
  subcategories: z.array(z.object({
    subcategoryKey: z.string().trim().min(1),
    subcategoryName: z.string().trim().min(1),
    sortOrder: z.number().int(),
  })).default([]),
});

export const ExpenseFundingSourceOptionSchema = z.object({
  fundingSourceKey: z.enum(EXPENSE_FUNDING_SOURCE_KEYS),
  label: z.string().trim().min(1),
});

export const ExpenseChildSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  amount: safeAmount,
  stageKey: z.enum(stageKeys),
});

export const ExpenseCategoryGroupSchema = z.object({
  categoryKey: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  expenseCount: z.number().int().nonnegative(),
  totalAmount: safeAmount,
  expenses: z.array(ExpenseChildSchema),
});

export const ExpensePageResponseSchema = z.object({
  project: z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1),
  }),
  categoryOptions: z.array(ExpenseCategoryOptionSchema),
  fundingSourceOptions: z.array(ExpenseFundingSourceOptionSchema),
  categories: z.array(ExpenseCategoryGroupSchema),
});

export const ExpenseResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  projectBudgetCategoryId: z.string().uuid().nullable(),
  categoryKey: z.string().trim().min(1),
  subcategoryKey: z.string().nullable().optional(),
  subcategoryName: z.string().nullable().optional(),
  policyVersionId: z.string().uuid().nullable().optional(),
  policySnapshot: z.record(z.unknown()).nullable().optional(),
  fundingSourceKey: z.enum(EXPENSE_FUNDING_SOURCE_KEYS),
  title: z.string().trim().min(1),
  amount: safeAmount,
  stageKey: z.enum(stageKeys),
  expectedSpendDate: z.string().nullable(),
  vendorName: z.string().nullable(),
  memo: z.string().nullable(),
  preApprovalStatus: PreApprovalStatusSchema.nullable(),
  executionProgressStatus: ExecutionProgressStatusSchema.nullable(),
  executionRequestStatus: ExecutionRequestStatusSchema.nullable(),
  executionRequestDate: z.string().nullable(),
  stageFields: ExpenseStageFieldsSchema,
});

export const ExpenseDetailResponseSchema = ExpenseResponseSchema.extend({
  categoryOptions: z.array(ExpenseCategoryOptionSchema),
});

export const ExpenseHistoryEventSchema = z.object({
  id: z.string().uuid(),
  expenseId: z.string().uuid(),
  eventType: z.string().trim().min(1),
  changedAt: z.string().trim().min(1),
  changedBy: z.string().uuid().nullable(),
  summary: z.string().trim().min(1),
  beforeValue: z.record(z.unknown()).nullable(),
  afterValue: z.record(z.unknown()).nullable(),
});

export const ExpenseHistoryResponseSchema = z.object({
  events: z.array(ExpenseHistoryEventSchema),
});

export const ExpenseEvidenceDuplicateStatusSchema = z.enum(["none", "possible_duplicate"]);
export const ExpenseEvidenceRequirementStatusSchema = z.enum(["not_uploaded", "uploaded", "waived"]);

export const ExpenseEvidenceAcceptedDocumentSchema = z.object({
  documentKey: z.string().trim().min(1),
  label: z.string().trim().min(1),
  uploaded: z.boolean(),
});

export const ExpenseEvidenceRequirementSchema = z.object({
  requirementKey: z.string().trim().min(1),
  evidenceName: z.string().trim().min(1),
  requirementType: z.enum(["required", "conditional", "optional"]),
  fulfillmentType: z.enum(["single", "any_of", "all_of"]),
  conditionText: z.string().nullable(),
  acceptedDocuments: z.array(ExpenseEvidenceAcceptedDocumentSchema),
  status: ExpenseEvidenceRequirementStatusSchema,
  uploadedCount: z.number().int().nonnegative(),
  waivedReason: z.string().nullable(),
  changedAt: z.string().nullable(),
  changedBy: z.string().uuid().nullable(),
});

export const ExpenseEvidenceFileResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  expenseId: z.string().uuid(),
  documentKey: z.string().trim().min(1),
  requirementKey: z.string().nullable(),
  originalFileName: z.string().trim().min(1),
  fileSize: safeAmount,
  mimeType: z.string().trim().min(1),
  fileExtension: z.string().trim().min(1),
  uploadedAt: z.string().trim().min(1),
  duplicateStatus: ExpenseEvidenceDuplicateStatusSchema,
});

export const ExpenseEvidenceListResponseSchema = z.object({
  files: z.array(ExpenseEvidenceFileResponseSchema),
  policySnapshotHash: z.string().nullable().default(null),
  requirements: z.array(ExpenseEvidenceRequirementSchema).default([]),
  unclassifiedFiles: z.array(ExpenseEvidenceFileResponseSchema).default([]),
});

export const ExpenseEvidenceSignedUrlResponseSchema = z.object({
  signedUrl: z.string().trim().min(1),
});

export const ExpenseEvidenceDeleteResponseSchema = z.object({
  id: z.string().uuid(),
});

export type ExpenseCreateInput = z.infer<typeof ExpenseCreateInputSchema>;
export type ExpenseUpdateInput = z.infer<typeof ExpenseUpdateInputSchema>;
export type ExpenseStageUpdateInput = z.infer<typeof ExpenseStageUpdateInputSchema>;
export type ExpensePageResponse = z.infer<typeof ExpensePageResponseSchema>;
export type ExpenseResponse = z.infer<typeof ExpenseResponseSchema>;
export type ExpenseDetailResponse = z.infer<typeof ExpenseDetailResponseSchema>;
export type ExpenseHistoryResponse = z.infer<typeof ExpenseHistoryResponseSchema>;
export type ExpenseEvidenceUploadInput = z.infer<typeof ExpenseEvidenceUploadInputSchema>;
export type ExpenseEvidenceRelinkInput = z.infer<typeof ExpenseEvidenceRelinkInputSchema>;
export type ExpenseEvidenceRequirementStatusInput = z.infer<typeof ExpenseEvidenceRequirementStatusInputSchema>;
export type ExpenseEvidenceFileResponse = z.infer<typeof ExpenseEvidenceFileResponseSchema>;
export type ExpenseEvidenceListResponse = z.infer<typeof ExpenseEvidenceListResponseSchema>;
export type ExpenseEvidenceSignedUrlResponse = z.infer<typeof ExpenseEvidenceSignedUrlResponseSchema>;
