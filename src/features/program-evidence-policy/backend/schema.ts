import { z } from "zod";

export const PROGRAM_POLICY_DOCUMENT_BUCKET = "program-policy-documents";
export const MAX_POLICY_DOCUMENT_SIZE = 20 * 1024 * 1024;

export const PolicyStatusSchema = z.enum([
  "draft_extracted",
  "needs_review",
  "ready_to_confirm",
  "confirmed",
  "archived",
]);

export const PolicyOperationStatusSchema = z.enum([
  "legacy_fallback",
  "draft_needs_review",
  "confirmed_policy",
  "extraction_failed",
]);

export const PolicyReviewStatusSchema = z.enum([
  "auto_confident",
  "needs_admin_review",
  "manual_required",
]);

export const EvidenceRequirementTypeSchema = z.enum(["required", "conditional", "optional"]);
export const EvidenceFulfillmentTypeSchema = z.enum(["single", "any_of", "all_of"]);
export const PolicyDocumentRoleSchema = z.enum(["primary", "reference"]);
export const AcceptedEvidenceDocumentSchema = z.object({
  documentKey: z.string().trim().regex(/^[a-z0-9_]+$/),
  label: z.string().trim().min(1),
});

export const PolicyParamsSchema = z.object({
  projectId: z.string().uuid(),
});

export const PolicyVersionParamsSchema = PolicyParamsSchema.extend({
  policyVersionId: z.string().uuid(),
});

export const PolicyDocumentParamsSchema = PolicyVersionParamsSchema.extend({
  documentId: z.string().uuid(),
});

export const PolicyUploadIntentInputSchema = z.object({
  browserMimeType: z.string().nullable(),
  fileSize: z.number().int().positive().max(MAX_POLICY_DOCUMENT_SIZE),
  originalFileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine(
      (value) => value.toLowerCase().endsWith(".pdf") && !value.includes("..") && !/[\\/\u0000-\u001f\u007f]/.test(value),
      "PDF file name is invalid.",
    ),
  role: PolicyDocumentRoleSchema.default("primary"),
});

export const SourceReferenceSchema = z.object({
  fileName: z.string().trim().min(1).nullable().optional(),
  page: z.number().int().positive().nullable().optional(),
  position: z.string().trim().nullable().optional(),
  rawText: z.string().trim().nullable().optional(),
});

export const PolicyCategoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  categoryKey: z.string().trim().regex(/^[a-z0-9_]+$/),
  categoryName: z.string().trim().min(1),
  rawCategoryName: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().default(0),
  reviewStatus: PolicyReviewStatusSchema,
  sourceReference: SourceReferenceSchema.default({}),
});

export const PolicySubcategoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  categoryKey: z.string().trim().regex(/^[a-z0-9_]+$/),
  subcategoryKey: z.string().trim().regex(/^[a-z0-9_]+$/),
  subcategoryName: z.string().trim().min(1),
  rawSubcategoryName: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().default(0),
  reviewStatus: PolicyReviewStatusSchema,
  sourceReference: SourceReferenceSchema.default({}),
});

export const PolicyEvidenceRequirementInputSchema = z.object({
  id: z.string().uuid().optional(),
  categoryKey: z.string().trim().regex(/^[a-z0-9_]+$/).nullable().optional(),
  subcategoryKey: z.string().trim().regex(/^[a-z0-9_]+$/).nullable().optional(),
  evidenceKey: z.string().trim().regex(/^[a-z0-9_]+$/),
  evidenceName: z.string().trim().min(1),
  requirementType: EvidenceRequirementTypeSchema,
  fulfillmentType: EvidenceFulfillmentTypeSchema,
  conditionText: z.string().trim().nullable().optional(),
  documentKey: z.string().trim().regex(/^[a-z0-9_]+$/).nullable().optional(),
  acceptedDocuments: z.array(AcceptedEvidenceDocumentSchema).optional(),
  sortOrder: z.number().int().default(0),
  reviewStatus: PolicyReviewStatusSchema,
  sourceReference: SourceReferenceSchema.default({}),
});

export const PolicyDraftUpdateInputSchema = z.object({
  categories: z.array(PolicyCategoryInputSchema),
  subcategories: z.array(PolicySubcategoryInputSchema).default([]),
  evidenceRequirements: z.array(PolicyEvidenceRequirementInputSchema),
});

export const PolicyExtractionInputSchema = z.object({
  extractedText: z.string().trim().max(200000).nullable().optional(),
});

export const PolicyDocumentResponseSchema = z.object({
  id: z.string().uuid(),
  policyVersionId: z.string().uuid(),
  projectId: z.string().uuid(),
  role: PolicyDocumentRoleSchema,
  originalFileName: z.string().trim().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.literal("application/pdf"),
  uploadStatus: z.enum(["uploading", "ready"]),
  createdAt: z.string().trim().min(1),
});

export const PolicyVersionSummarySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  status: PolicyStatusSchema,
  operationStatus: PolicyOperationStatusSchema,
  extractionStatus: z.enum(["pending", "succeeded", "failed"]),
  extractionFailureReason: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  confirmedBy: z.string().uuid().nullable(),
  confirmedSummary: z.record(z.unknown()),
  createdAt: z.string().trim().min(1),
});

export const PolicyCategoryResponseSchema = PolicyCategoryInputSchema.extend({
  id: z.string().uuid(),
});

export const PolicySubcategoryResponseSchema = PolicySubcategoryInputSchema.extend({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
});

export const PolicyEvidenceRequirementResponseSchema = PolicyEvidenceRequirementInputSchema.extend({
  id: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  subcategoryId: z.string().uuid().nullable(),
});

export const ProjectPolicyStatusResponseSchema = z.object({
  operationStatus: PolicyOperationStatusSchema,
  activePolicyVersionId: z.string().uuid().nullable(),
  latestPolicyVersion: PolicyVersionSummarySchema.nullable(),
  versions: z.array(PolicyVersionSummarySchema),
});

export const PolicyDraftDetailResponseSchema = z.object({
  version: PolicyVersionSummarySchema,
  documents: z.array(PolicyDocumentResponseSchema),
  categories: z.array(PolicyCategoryResponseSchema),
  subcategories: z.array(PolicySubcategoryResponseSchema),
  evidenceRequirements: z.array(PolicyEvidenceRequirementResponseSchema),
  blockingErrors: z.array(z.string()),
});

export const PolicyUploadIntentResponseSchema = z.object({
  canonicalMimeType: z.literal("application/pdf"),
  documentId: z.string().uuid(),
  policyVersionId: z.string().uuid(),
  path: z.string().trim().min(1),
  signedUrl: z.string().trim().min(1),
  token: z.string().trim().min(1),
});

export const PolicySignedUrlResponseSchema = z.object({
  signedUrl: z.string().trim().min(1),
});

export const PolicyConfirmationPreviewResponseSchema = z.object({
  blockingErrors: z.array(z.string()),
  summary: z.object({
    categoryCount: z.number().int().nonnegative(),
    subcategoryCount: z.number().int().nonnegative(),
    evidenceRequirementCount: z.number().int().nonnegative(),
  }),
});

export const PolicyCategoryOptionSchema = z.object({
  categoryKey: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  sortOrder: z.number().int(),
  subcategories: z.array(z.object({
    subcategoryKey: z.string().trim().min(1),
    subcategoryName: z.string().trim().min(1),
    sortOrder: z.number().int(),
  })),
});

export const PolicyCategoryResolverResponseSchema = z.object({
  operationStatus: PolicyOperationStatusSchema,
  policyVersionId: z.string().uuid().nullable(),
  categories: z.array(PolicyCategoryOptionSchema),
});

export type PolicyDraftUpdateInput = z.infer<typeof PolicyDraftUpdateInputSchema>;
export type PolicyUploadIntentInput = z.infer<typeof PolicyUploadIntentInputSchema>;
export type PolicyExtractionInput = z.infer<typeof PolicyExtractionInputSchema>;
export type PolicyCategoryResolverResponse = z.infer<typeof PolicyCategoryResolverResponseSchema>;
export type PolicyDraftDetailResponse = z.infer<typeof PolicyDraftDetailResponseSchema>;
export type ProjectPolicyStatusResponse = z.infer<typeof ProjectPolicyStatusResponseSchema>;
