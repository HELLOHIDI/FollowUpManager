import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import type { Database } from "@/lib/supabase/types";
import { getBudgetCategoryPolicySortOrder } from "@/features/domain/contracts";
import { programEvidencePolicyErrorCodes, type ProgramEvidencePolicyServiceError } from "./error";
import {
  PROGRAM_POLICY_DOCUMENT_BUCKET,
  PolicyCategoryResolverResponseSchema,
  PolicyConfirmationPreviewResponseSchema,
  PolicyDraftDetailResponseSchema,
  PolicyDocumentResponseSchema,
  PolicyUploadIntentResponseSchema,
  PolicyVersionSummarySchema,
  ProjectPolicyStatusResponseSchema,
  type PolicyDraftUpdateInput,
  type PolicyCategoryResolverResponse,
  type PolicyDraftDetailResponse,
  type PolicyExtractionInput,
  type PolicyUploadIntentInput,
  type ProjectPolicyStatusResponse,
} from "./schema";
import { extractPolicyPdfText, TEXT_EXTRACTION_INSUFFICIENT } from "./pdf-text-extraction";
import { parsePolicyTextDraft } from "./policy-text-parser";

type Client = SupabaseClient<Database> & SupabaseClient<any>;
type Result<T> = HandlerResult<T, ProgramEvidencePolicyServiceError, unknown>;
type AnyRow = Record<string, any>;

const VERSION_SELECT = "id, project_id, version_number, status, operation_status, extraction_status, extraction_failure_reason, confirmed_at, confirmed_by, confirmed_summary, created_at";
const DOCUMENT_SELECT = "id, policy_version_id, project_id, role, original_file_name, file_size, mime_type, upload_status, created_at";
const POLICY_EXTRACTION_FAILED_MESSAGE =
  "이 PDF에서는 자동 추출할 수 있는 텍스트를 충분히 찾지 못했어요. 기본 비목으로 시작하거나, 텍스트를 붙여넣어 다시 시도할 수 있어요.";
const DRAFT_THRESHOLD_NOT_MET = "DRAFT_THRESHOLD_NOT_MET";
const POLICY_DOCUMENT_NOT_READY = "POLICY_DOCUMENT_NOT_READY";
const POLICY_STORAGE_DOWNLOAD_FAILED = "POLICY_STORAGE_DOWNLOAD_FAILED";

const formatFailureReason = (reason: string, error?: string) =>
  error ? `${reason}: ${error}` : reason;

export { toStablePolicyKey } from "./policy-text-parser";

const mapVersion = (row: AnyRow) =>
  PolicyVersionSummarySchema.parse({
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    confirmedSummary: row.confirmed_summary ?? {},
    createdAt: row.created_at,
    extractionFailureReason: row.extraction_failure_reason,
    extractionStatus: row.extraction_status,
    id: row.id,
    operationStatus: row.operation_status,
    projectId: row.project_id,
    status: row.status,
    versionNumber: row.version_number,
  });

const mapDocument = (row: AnyRow) =>
  PolicyDocumentResponseSchema.parse({
    createdAt: row.created_at,
    fileSize: row.file_size,
    id: row.id,
    mimeType: row.mime_type,
    originalFileName: row.original_file_name,
    policyVersionId: row.policy_version_id,
    projectId: row.project_id,
    role: row.role,
    uploadStatus: row.upload_status,
  });

const getProject = (client: Client, projectId: string) => {
  const query = (client as SupabaseClient<any>).from("projects").select("id, company_id, confirmed_policy_version_id").eq("id", projectId);
  return typeof query.is === "function"
    ? query.is("deleted_at", null).maybeSingle()
    : query.maybeSingle();
};

const getNextVersionNumber = async (client: Client, projectId: string) => {
  const { data, error } = await client
    .from("program_policy_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1);
  if (error) return { error };
  return { data: Number(data?.[0]?.version_number ?? 0) + 1 };
};

const getVersionRow = (client: Client, projectId: string, policyVersionId: string) =>
  client.from("program_policy_versions").select(VERSION_SELECT).eq("id", policyVersionId).eq("project_id", projectId).maybeSingle();

export const getProjectPolicyStatus = async (client: Client, projectId: string): Promise<Result<ProjectPolicyStatusResponse>> => {
  const project = await getProject(client, projectId);
  if (project.error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load project policy status.");
  if (!project.data) return failure(404, programEvidencePolicyErrorCodes.notFound, "Project was not found.");

  const versionsQuery = client
    .from("program_policy_versions")
    .select(VERSION_SELECT)
    .eq("project_id", projectId);
  const { data, error } = await (typeof versionsQuery.order === "function"
    ? versionsQuery.order("created_at", { ascending: false })
    : versionsQuery);
  if (error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load policy versions.");

  const versions = (data ?? []).map(mapVersion);
  const confirmed = versions.find((version) => version.status === "confirmed");
  const latest = versions[0] ?? null;
  const operationStatus = confirmed?.operationStatus ?? latest?.operationStatus ?? "legacy_fallback";
  const parsed = ProjectPolicyStatusResponseSchema.safeParse({
    activePolicyVersionId: confirmed?.id ?? null,
    latestPolicyVersion: latest,
    operationStatus,
    versions,
  });
  return parsed.success
    ? success(parsed.data)
    : failure(500, programEvidencePolicyErrorCodes.responseInvalid, "Policy status response was invalid.");
};

export const createPolicyUploadIntent = async (
  client: Client,
  projectId: string,
  userId: string,
  input: PolicyUploadIntentInput,
): Promise<Result<z.infer<typeof PolicyUploadIntentResponseSchema>>> => {
  if ((input.browserMimeType ?? "application/pdf") !== "application/pdf") {
    return failure(400, programEvidencePolicyErrorCodes.documentInvalid, "Only PDF policy documents are supported.");
  }

  const project = await getProject(client, projectId);
  if (project.error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load project.");
  if (!project.data) return failure(404, programEvidencePolicyErrorCodes.notFound, "Project was not found.");

  const nextVersion = await getNextVersionNumber(client, projectId);
  if (nextVersion.error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to prepare policy version.");

  const { data: version, error: versionError } = await client
    .from("program_policy_versions")
    .insert({
      created_by: userId,
      operation_status: "draft_needs_review",
      project_id: projectId,
      status: "needs_review",
      version_number: nextVersion.data,
    })
    .select("id")
    .single();
  if (versionError || !version) return failure(500, programEvidencePolicyErrorCodes.writeError, "Failed to create policy version.");

  const documentId = randomUUID();
  const storagePath = `${project.data.company_id}/${projectId}/${version.id}/${documentId}.pdf`;
  const { error: documentError } = await client.from("program_policy_documents").insert({
    file_size: input.fileSize,
    id: documentId,
    mime_type: "application/pdf",
    original_file_name: input.originalFileName,
    policy_version_id: version.id,
    project_id: projectId,
    role: input.role,
    storage_path: storagePath,
    uploaded_by: userId,
  });
  if (documentError) return failure(500, programEvidencePolicyErrorCodes.writeError, "Failed to create policy document row.");

  const { data, error } = await client.storage.from(PROGRAM_POLICY_DOCUMENT_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) {
    return failure(500, programEvidencePolicyErrorCodes.storageError, "Failed to create policy upload URL.");
  }

  const parsed = PolicyUploadIntentResponseSchema.safeParse({
    canonicalMimeType: "application/pdf",
    documentId,
    path: storagePath,
    policyVersionId: version.id,
    signedUrl: data.signedUrl,
    token: data.token,
  });
  return parsed.success
    ? success(parsed.data, 201)
    : failure(500, programEvidencePolicyErrorCodes.responseInvalid, "Policy upload response was invalid.");
};

export const completePolicyUpload = async (client: Client, projectId: string, policyVersionId: string, documentId: string): Promise<Result<unknown>> => {
  const { data: row, error } = await client
    .from("program_policy_documents")
    .select("*")
    .eq("id", documentId)
    .eq("project_id", projectId)
    .eq("policy_version_id", policyVersionId)
    .maybeSingle();
  if (error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load policy document.");
  if (!row) return failure(404, programEvidencePolicyErrorCodes.notFound, "Policy document was not found.");
  if (row.upload_status === "ready") return success(mapDocument(row));

  const parts = row.storage_path.split("/");
  const fileName = parts.pop()!;
  const listed = await client.storage.from(PROGRAM_POLICY_DOCUMENT_BUCKET).list(parts.join("/"), { search: fileName });
  const object = listed.data?.find((file: { name: string }) => file.name === fileName);
  const objectSize = Number(object?.metadata?.size ?? -1);
  if (listed.error || !object || objectSize !== row.file_size) {
    return failure(409, programEvidencePolicyErrorCodes.documentStateConflict, "Uploaded policy PDF could not be verified.");
  }

  const { data: updated, error: updateError } = await client
    .from("program_policy_documents")
    .update({ ready_at: new Date().toISOString(), upload_status: "ready" })
    .eq("id", documentId)
    .select(DOCUMENT_SELECT)
    .single();
  if (updateError || !updated) return failure(500, programEvidencePolicyErrorCodes.writeError, "Failed to complete policy upload.");
  return success(mapDocument(updated));
};

export const parseTextDraft = (text: string, fileName: string): PolicyDraftUpdateInput | null => {
  return parsePolicyTextDraft(text, { fileName });
};

export const validateDraftBlockingErrors = (draft: Pick<PolicyDraftUpdateInput, "categories" | "subcategories" | "evidenceRequirements">) => {
  const errors = validateDraftStructuralErrors(draft);

  for (const category of draft.categories) {
    if (category.reviewStatus !== "auto_confident") errors.push(`Category requires admin review: ${category.categoryKey}`);
  }

  for (const subcategory of draft.subcategories) {
    if (subcategory.reviewStatus !== "auto_confident") errors.push(`Subcategory requires admin review: ${subcategory.subcategoryKey}`);
  }

  for (const evidence of draft.evidenceRequirements) {
    if (evidence.reviewStatus !== "auto_confident") errors.push(`Evidence requires admin review: ${evidence.evidenceKey}`);
  }

  return [...new Set(errors)];
};

export const validateDraftStructuralErrors = (draft: Pick<PolicyDraftUpdateInput, "categories" | "subcategories" | "evidenceRequirements">) => {
  const errors: string[] = [];
  const categoryKeys = new Set<string>();
  const subcategoryKeysByCategory = new Map<string, Set<string>>();
  const evidenceKeys = new Set<string>();

  if (draft.categories.length === 0) errors.push("At least one top-level category is required.");
  if (draft.evidenceRequirements.length === 0) errors.push("At least one evidence requirement is required.");

  for (const category of draft.categories) {
    if (!category.categoryName.trim()) errors.push("Category display name is required.");
    if (categoryKeys.has(category.categoryKey)) errors.push(`Duplicate category key: ${category.categoryKey}`);
    categoryKeys.add(category.categoryKey);
  }

  for (const subcategory of draft.subcategories) {
    if (!subcategory.subcategoryName.trim()) errors.push("Subcategory display name is required.");
    if (!categoryKeys.has(subcategory.categoryKey)) errors.push(`Subcategory category is missing: ${subcategory.categoryKey}`);
    const keySet = subcategoryKeysByCategory.get(subcategory.categoryKey) ?? new Set<string>();
    if (keySet.has(subcategory.subcategoryKey)) errors.push(`Duplicate subcategory key: ${subcategory.categoryKey}/${subcategory.subcategoryKey}`);
    keySet.add(subcategory.subcategoryKey);
    subcategoryKeysByCategory.set(subcategory.categoryKey, keySet);
  }

  for (const evidence of draft.evidenceRequirements) {
    if (evidenceKeys.has(evidence.evidenceKey)) errors.push(`Duplicate evidence key: ${evidence.evidenceKey}`);
    evidenceKeys.add(evidence.evidenceKey);
    if (!evidence.evidenceName.trim()) errors.push("Evidence display name is required.");
    if (evidence.categoryKey && !categoryKeys.has(evidence.categoryKey)) errors.push(`Evidence category is missing: ${evidence.categoryKey}`);
    if (evidence.subcategoryKey && !evidence.categoryKey) errors.push(`Evidence subcategory requires a category: ${evidence.evidenceKey}`);
    if (evidence.subcategoryKey && evidence.categoryKey && !subcategoryKeysByCategory.get(evidence.categoryKey)?.has(evidence.subcategoryKey)) {
      errors.push(`Evidence subcategory is missing: ${evidence.categoryKey}/${evidence.subcategoryKey}`);
    }
  }

  return [...new Set(errors)];
};

const writeDraftRows = async (client: Client, policyVersionId: string, draft: PolicyDraftUpdateInput) => {
  const { error } = await client.rpc("replace_program_policy_draft", {
    p_categories: draft.categories,
    p_evidence_requirements: draft.evidenceRequirements,
    p_policy_version_id: policyVersionId,
    p_subcategories: draft.subcategories,
  });
  return { error };
};

export const triggerDraftExtraction = async (
  client: Client,
  projectId: string,
  policyVersionId: string,
  input: PolicyExtractionInput,
): Promise<Result<unknown>> => {
  const version = await getVersionRow(client, projectId, policyVersionId);
  if (version.error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load policy version.");
  if (!version.data) return failure(404, programEvidencePolicyErrorCodes.notFound, "Policy version was not found.");
  if (version.data.status === "confirmed" || version.data.status === "archived") {
    return failure(409, programEvidencePolicyErrorCodes.documentStateConflict, "Confirmed or archived policy cannot be extracted again.");
  }

  const { data: document, error: documentError } = await client
    .from("program_policy_documents")
    .select("original_file_name, storage_path")
    .eq("policy_version_id", policyVersionId)
    .eq("role", "primary")
    .eq("upload_status", "ready")
    .maybeSingle();
  if (documentError) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load policy document.");

  let policyText = input.extractedText?.trim() ?? "";
  const failureReason = DRAFT_THRESHOLD_NOT_MET;

  if (!policyText) {
    if (!document?.storage_path) {
      const reason = POLICY_DOCUMENT_NOT_READY;
      await client
        .from("program_policy_versions")
        .update({
          extraction_failure_reason: reason,
          extraction_status: "failed",
          operation_status: "extraction_failed",
          status: "needs_review",
        })
        .eq("id", policyVersionId);
      return failure(409, programEvidencePolicyErrorCodes.extractionFailed, POLICY_EXTRACTION_FAILED_MESSAGE, {
        reason,
      });
    }

    const download = await client.storage.from(PROGRAM_POLICY_DOCUMENT_BUCKET).download(document.storage_path);
    if (download.error || !download.data) {
      const reason = POLICY_STORAGE_DOWNLOAD_FAILED;
      await client
        .from("program_policy_versions")
        .update({
          extraction_failure_reason: formatFailureReason(reason, download.error?.message),
          extraction_status: "failed",
          operation_status: "extraction_failed",
          status: "needs_review",
        })
        .eq("id", policyVersionId);
      return failure(409, programEvidencePolicyErrorCodes.extractionFailed, POLICY_EXTRACTION_FAILED_MESSAGE, {
        error: download.error?.message,
        reason,
      });
    }

    const extracted = await extractPolicyPdfText(await download.data.arrayBuffer());
    if (extracted.ok === false) {
      await client
        .from("program_policy_versions")
        .update({
          extraction_failure_reason: formatFailureReason(extracted.reason, extracted.error),
          extraction_status: "failed",
          operation_status: "extraction_failed",
          status: "needs_review",
        })
        .eq("id", policyVersionId);
      return failure(409, programEvidencePolicyErrorCodes.extractionFailed, POLICY_EXTRACTION_FAILED_MESSAGE, {
        error: extracted.error,
        reason: extracted.reason,
      });
    }

    policyText = extracted.text;
  }

  const draft = parseTextDraft(policyText, document?.original_file_name ?? "policy.pdf");
  if (!draft) {
    await client
      .from("program_policy_versions")
      .update({ extraction_failure_reason: failureReason, extraction_status: "failed", operation_status: "extraction_failed", status: "needs_review" })
      .eq("id", policyVersionId);
    return failure(409, programEvidencePolicyErrorCodes.extractionFailed, POLICY_EXTRACTION_FAILED_MESSAGE, {
      reason: failureReason,
    });
  }
  const structuralErrors = validateDraftStructuralErrors(draft);
  if (structuralErrors.length > 0) {
    await client
      .from("program_policy_versions")
      .update({
        extraction_failure_reason: structuralErrors.join("\n"),
        extraction_status: "failed",
        operation_status: "extraction_failed",
        status: "needs_review",
      })
      .eq("id", policyVersionId);
    return failure(409, programEvidencePolicyErrorCodes.extractionFailed, "Extracted policy draft has structural errors.", structuralErrors);
  }

  const write = await writeDraftRows(client, policyVersionId, draft);
  if (write.error) return failure(500, programEvidencePolicyErrorCodes.writeError, "Failed to save extracted draft.");

  await client
    .from("program_policy_versions")
    .update({ extraction_failure_reason: null, extraction_status: "succeeded", operation_status: "draft_needs_review", status: "needs_review" })
    .eq("id", policyVersionId);

  return getPolicyDraftDetail(client, projectId, policyVersionId);
};

export const updatePolicyDraft = async (
  client: Client,
  projectId: string,
  policyVersionId: string,
  input: PolicyDraftUpdateInput,
): Promise<Result<unknown>> => {
  const version = await getVersionRow(client, projectId, policyVersionId);
  if (version.error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load policy version.");
  if (!version.data) return failure(404, programEvidencePolicyErrorCodes.notFound, "Policy version was not found.");
  if (version.data.status === "confirmed" || version.data.status === "archived") {
    return failure(409, programEvidencePolicyErrorCodes.documentStateConflict, "Confirmed or archived policy cannot be edited.");
  }
  if (version.data.operation_status === "extraction_failed" || version.data.extraction_status === "failed") {
    return failure(409, programEvidencePolicyErrorCodes.documentStateConflict, "Extraction failed policies cannot be manually converted into a draft.");
  }

  const structuralErrors = validateDraftStructuralErrors(input);
  if (structuralErrors.length > 0) {
    return failure(400, programEvidencePolicyErrorCodes.validation, "Policy draft has structural errors.", structuralErrors);
  }

  const write = await writeDraftRows(client, policyVersionId, input);
  if (write.error) return failure(500, programEvidencePolicyErrorCodes.writeError, "Failed to update policy draft.");
  const blockingErrors = validateDraftBlockingErrors(input);
  await client.from("program_policy_versions").update({ status: blockingErrors.length ? "needs_review" : "ready_to_confirm" }).eq("id", policyVersionId);
  return getPolicyDraftDetail(client, projectId, policyVersionId);
};

export const getPolicyDraftDetail = async (client: Client, projectId: string, policyVersionId: string): Promise<Result<PolicyDraftDetailResponse>> => {
  const version = await getVersionRow(client, projectId, policyVersionId);
  if (version.error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load policy version.");
  if (!version.data) return failure(404, programEvidencePolicyErrorCodes.notFound, "Policy version was not found.");

  const [documents, categories, subcategories, evidence] = await Promise.all([
    client.from("program_policy_documents").select(DOCUMENT_SELECT).eq("policy_version_id", policyVersionId).order("created_at"),
    client.from("program_policy_categories").select("*").eq("policy_version_id", policyVersionId).order("sort_order"),
    client.from("program_policy_subcategories").select("*").eq("policy_version_id", policyVersionId).order("sort_order"),
    client.from("program_policy_evidence_requirements").select("*").eq("policy_version_id", policyVersionId).order("created_at"),
  ]);
  if (documents.error || categories.error || subcategories.error || evidence.error) {
    return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load policy draft.");
  }

  const categoryById = new Map((categories.data ?? []).map((row: AnyRow) => [row.id, row.category_key]));
  const subcategoryById = new Map((subcategories.data ?? []).map((row: AnyRow) => [row.id, row.subcategory_key]));
  const responseDraft = {
    categories: (categories.data ?? []).map((row: AnyRow) => ({
      categoryKey: row.category_key,
      categoryName: row.category_name,
      id: row.id,
      rawCategoryName: row.raw_category_name,
      reviewStatus: row.review_status,
      sortOrder: row.sort_order,
      sourceReference: row.source_reference ?? {},
    })),
    evidenceRequirements: (evidence.data ?? []).map((row: AnyRow) => ({
      categoryId: row.category_id,
      categoryKey: row.category_id ? categoryById.get(row.category_id) ?? null : null,
      conditionText: row.condition_text,
      documentKey: row.document_key,
      evidenceKey: row.evidence_key,
      evidenceName: row.evidence_name,
      fulfillmentType: row.fulfillment_type,
      id: row.id,
      requirementType: row.requirement_type,
      reviewStatus: row.review_status,
      sourceReference: row.source_reference ?? {},
      subcategoryId: row.subcategory_id,
      subcategoryKey: row.subcategory_id ? subcategoryById.get(row.subcategory_id) ?? null : null,
    })),
    subcategories: (subcategories.data ?? []).map((row: AnyRow) => ({
      categoryId: row.category_id,
      categoryKey: categoryById.get(row.category_id) ?? "",
      id: row.id,
      rawSubcategoryName: row.raw_subcategory_name,
      reviewStatus: row.review_status,
      sortOrder: row.sort_order,
      sourceReference: row.source_reference ?? {},
      subcategoryKey: row.subcategory_key,
      subcategoryName: row.subcategory_name,
    })),
  };

  const parsed = PolicyDraftDetailResponseSchema.safeParse({
    ...responseDraft,
    blockingErrors: validateDraftBlockingErrors(responseDraft),
    documents: (documents.data ?? []).map(mapDocument),
    version: mapVersion(version.data),
  });
  return parsed.success
    ? success(parsed.data)
    : failure(500, programEvidencePolicyErrorCodes.responseInvalid, "Policy draft response was invalid.", parsed.error.flatten());
};

export const previewPolicyConfirmation = async (client: Client, projectId: string, policyVersionId: string): Promise<Result<z.infer<typeof PolicyConfirmationPreviewResponseSchema>>> => {
  const detail = await getPolicyDraftDetail(client, projectId, policyVersionId);
  if (!detail.ok) return detail;
  const parsed = PolicyConfirmationPreviewResponseSchema.parse({
    blockingErrors: detail.data.blockingErrors,
    summary: {
      categoryCount: detail.data.categories.length,
      evidenceRequirementCount: detail.data.evidenceRequirements.length,
      subcategoryCount: detail.data.subcategories.length,
    },
  });
  return success(parsed);
};

export const confirmPolicy = async (client: Client, projectId: string, policyVersionId: string, userId: string): Promise<Result<unknown>> => {
  const preview = await previewPolicyConfirmation(client, projectId, policyVersionId);
  if (!preview.ok) return preview;
  if (preview.data.blockingErrors.length > 0) {
    return failure(409, programEvidencePolicyErrorCodes.validation, "Policy has blocking review errors.", preview.data.blockingErrors);
  }

  const { data, error } = await (client as SupabaseClient<any>).rpc("confirm_program_policy_version", {
    p_confirmed_by: userId,
    p_confirmed_summary: preview.data.summary,
    p_policy_version_id: policyVersionId,
    p_project_id: projectId,
  });
  if (error?.message?.includes("POLICY_REPLACEMENT_BLOCKED_ACTIVE_EXPENSES")) {
    return failure(
      409,
      programEvidencePolicyErrorCodes.documentStateConflict,
      "이미 등록된 지출내역이 있어 비목 정책을 교체할 수 없어요. 현재 비목으로 계속 진행해 주세요.",
    );
  }
  if (error || !data) return failure(500, programEvidencePolicyErrorCodes.writeError, "Failed to confirm policy.");

  return success(mapVersion(data));
};

export const createPolicyDocumentSignedUrl = async (client: Client, projectId: string, policyVersionId: string, documentId: string): Promise<Result<unknown>> => {
  const { data: row, error } = await client
    .from("program_policy_documents")
    .select("storage_path, upload_status")
    .eq("id", documentId)
    .eq("project_id", projectId)
    .eq("policy_version_id", policyVersionId)
    .maybeSingle();
  if (error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load policy document.");
  if (!row || row.upload_status !== "ready") return failure(404, programEvidencePolicyErrorCodes.notFound, "Policy document was not found.");
  const signed = await client.storage.from(PROGRAM_POLICY_DOCUMENT_BUCKET).createSignedUrl(row.storage_path, 60);
  return signed.error || !signed.data
    ? failure(500, programEvidencePolicyErrorCodes.storageError, "Failed to create policy PDF URL.")
    : success({ signedUrl: signed.data.signedUrl });
};

export const resolvePolicyCategories = async (client: Client, projectId: string): Promise<Result<PolicyCategoryResolverResponse>> => {
  const status = await getProjectPolicyStatus(client, projectId);
  if (!status.ok) return status;

  if (status.data.operationStatus !== "confirmed_policy" || !status.data.activePolicyVersionId) {
    const fallbackQuery = client
      .from("project_budget_categories")
      .select("category_key, budget_category_policy_templates(category_name)")
      .eq("project_id", projectId);
    const activeFallbackQuery = typeof fallbackQuery.is === "function" ? fallbackQuery.is("deleted_at", null) : fallbackQuery;
    const { data, error } = await activeFallbackQuery.eq("is_active", true);
    if (error) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load fallback categories.");
    const categories = (Array.isArray(data) ? data : []).map((row: AnyRow) => ({
      categoryKey: row.category_key,
      categoryName: Array.isArray(row.budget_category_policy_templates)
        ? row.budget_category_policy_templates[0]?.category_name ?? row.category_key
        : row.budget_category_policy_templates?.category_name ?? row.category_key,
      sortOrder: getBudgetCategoryPolicySortOrder(row.category_key),
      subcategories: [],
    }));
    if (categories.length === 0) {
      const { data: templates, error: templateError } = await client
        .from("budget_category_policy_templates")
        .select("category_key, category_name")
        .eq("is_active", true);
      if (templateError) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load fallback category templates.");
      categories.push(...(Array.isArray(templates) ? templates : []).map((row: AnyRow) => ({
        categoryKey: row.category_key,
        categoryName: row.category_name,
        sortOrder: getBudgetCategoryPolicySortOrder(row.category_key),
        subcategories: [],
      })));
    }
    return success(PolicyCategoryResolverResponseSchema.parse({
      categories,
      operationStatus: status.data.operationStatus,
      policyVersionId: null,
    }));
  }

  const { data: categories, error: categoryError } = await client
    .from("program_policy_categories")
    .select("id, category_key, category_name, sort_order")
    .eq("policy_version_id", status.data.activePolicyVersionId)
    .order("sort_order");
  const { data: subcategories, error: subcategoryError } = await client
    .from("program_policy_subcategories")
    .select("category_id, subcategory_key, subcategory_name, sort_order")
    .eq("policy_version_id", status.data.activePolicyVersionId)
    .order("sort_order");
  if (categoryError || subcategoryError) return failure(500, programEvidencePolicyErrorCodes.fetchError, "Failed to load confirmed policy categories.");

  const subcategoriesByCategoryId = new Map<string, Array<{ subcategoryKey: string; subcategoryName: string; sortOrder: number }>>();
  for (const row of subcategories ?? []) {
    const list = subcategoriesByCategoryId.get(row.category_id) ?? [];
    list.push({ sortOrder: row.sort_order, subcategoryKey: row.subcategory_key, subcategoryName: row.subcategory_name });
    subcategoriesByCategoryId.set(row.category_id, list);
  }

  return success(PolicyCategoryResolverResponseSchema.parse({
    categories: (categories ?? []).map((row: AnyRow) => ({
      categoryKey: row.category_key,
      categoryName: row.category_name,
      sortOrder: row.sort_order,
      subcategories: subcategoriesByCategoryId.get(row.id) ?? [],
    })),
    operationStatus: "confirmed_policy",
    policyVersionId: status.data.activePolicyVersionId,
  }));
};
