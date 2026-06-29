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

type Client = SupabaseClient<Database> & SupabaseClient<any>;
type Result<T> = HandlerResult<T, ProgramEvidencePolicyServiceError, unknown>;
type AnyRow = Record<string, any>;

const VERSION_SELECT = "id, project_id, version_number, status, operation_status, extraction_status, extraction_failure_reason, confirmed_at, confirmed_by, confirmed_summary, created_at";
const DOCUMENT_SELECT = "id, policy_version_id, project_id, role, original_file_name, file_size, mime_type, upload_status, created_at";

export const toStablePolicyKey = (value: string, fallbackPrefix: string) => {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return ascii || `${fallbackPrefix}_${Buffer.from(value).toString("hex").slice(0, 8)}`;
};

const uniqueKey = (base: string, used: Set<string>) => {
  let next = base;
  let suffix = 2;
  while (used.has(next)) {
    next = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(next);
  return next;
};

const hasSourceReference = (value: unknown) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);

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

const parseTextDraft = (text: string, fileName: string): PolicyDraftUpdateInput | null => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const categoryCandidates = lines
    .filter((line) => /비목|사업비|category/i.test(line))
    .slice(0, 20);
  const evidenceCandidates = lines
    .filter((line) => /증빙|서류|영수증|계약서|견적서|invoice|receipt|document/i.test(line))
    .slice(0, 80);

  if (categoryCandidates.length === 0 || evidenceCandidates.length === 0) {
    return null;
  }

  const categoryKeys = new Set<string>();
  const evidenceKeys = new Set<string>();
  const categories = categoryCandidates.map((line, index) => {
    const name = line.replace(/^[-*\d.\s]+/, "").slice(0, 80);
    return {
      categoryKey: uniqueKey(toStablePolicyKey(name, "category"), categoryKeys),
      categoryName: name,
      rawCategoryName: line,
      reviewStatus: "needs_admin_review" as const,
      sortOrder: index,
      sourceReference: { fileName, position: `line:${index + 1}`, rawText: line },
    };
  });

  const documentKeys = new Set<string>();
  const evidenceRequirements = evidenceCandidates.map((line, index) => {
    const name = line.replace(/^[-*\d.\s]+/, "").slice(0, 100);
    return {
      categoryKey: categories[Math.min(index, categories.length - 1)].categoryKey,
      conditionText: /경우|시|when|if/i.test(line) ? line : null,
      documentKey: uniqueKey(toStablePolicyKey(name, "document"), documentKeys),
      evidenceKey: uniqueKey(toStablePolicyKey(name, "evidence"), evidenceKeys),
      evidenceName: name,
      fulfillmentType: "single" as const,
      requirementType: /경우|시|when|if/i.test(line) ? "conditional" as const : "required" as const,
      reviewStatus: "needs_admin_review" as const,
      sourceReference: { fileName, position: `line:${index + 1}`, rawText: line },
      subcategoryKey: null,
    };
  });

  return { categories, evidenceRequirements, subcategories: [] };
};

export const validateDraftBlockingErrors = (draft: Pick<PolicyDraftUpdateInput, "categories" | "subcategories" | "evidenceRequirements">) => {
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
    if (category.reviewStatus !== "auto_confident") errors.push(`Category requires admin review: ${category.categoryKey}`);
    if (!hasSourceReference(category.sourceReference)) errors.push(`Category source reference is required: ${category.categoryKey}`);
  }

  for (const subcategory of draft.subcategories) {
    if (!subcategory.subcategoryName.trim()) errors.push("Subcategory display name is required.");
    if (!categoryKeys.has(subcategory.categoryKey)) errors.push(`Subcategory category is missing: ${subcategory.categoryKey}`);
    const keySet = subcategoryKeysByCategory.get(subcategory.categoryKey) ?? new Set<string>();
    if (keySet.has(subcategory.subcategoryKey)) errors.push(`Duplicate subcategory key: ${subcategory.categoryKey}/${subcategory.subcategoryKey}`);
    keySet.add(subcategory.subcategoryKey);
    subcategoryKeysByCategory.set(subcategory.categoryKey, keySet);
    if (subcategory.reviewStatus !== "auto_confident") errors.push(`Subcategory requires admin review: ${subcategory.subcategoryKey}`);
    if (!hasSourceReference(subcategory.sourceReference)) errors.push(`Subcategory source reference is required: ${subcategory.subcategoryKey}`);
  }

  for (const evidence of draft.evidenceRequirements) {
    if (evidenceKeys.has(evidence.evidenceKey)) errors.push(`Duplicate evidence key: ${evidence.evidenceKey}`);
    evidenceKeys.add(evidence.evidenceKey);
    if (!evidence.evidenceName.trim()) errors.push("Evidence display name is required.");
    if (evidence.reviewStatus !== "auto_confident") errors.push(`Evidence requires admin review: ${evidence.evidenceKey}`);
    if (evidence.categoryKey && !categoryKeys.has(evidence.categoryKey)) errors.push(`Evidence category is missing: ${evidence.categoryKey}`);
    if (evidence.subcategoryKey && !evidence.categoryKey) errors.push(`Evidence subcategory requires a category: ${evidence.evidenceKey}`);
    if (evidence.subcategoryKey && evidence.categoryKey && !subcategoryKeysByCategory.get(evidence.categoryKey)?.has(evidence.subcategoryKey)) {
      errors.push(`Evidence subcategory is missing: ${evidence.categoryKey}/${evidence.subcategoryKey}`);
    }
    if (!hasSourceReference(evidence.sourceReference)) errors.push(`Evidence source reference is required: ${evidence.evidenceKey}`);
  }

  return [...new Set(errors)];
};

const writeDraftRows = async (client: Client, policyVersionId: string, draft: PolicyDraftUpdateInput) => {
  await client.from("program_policy_evidence_requirements").delete().eq("policy_version_id", policyVersionId);
  await client.from("program_policy_subcategories").delete().eq("policy_version_id", policyVersionId);
  await client.from("program_policy_categories").delete().eq("policy_version_id", policyVersionId);

  const { data: categoryRows, error: categoryError } = await client
    .from("program_policy_categories")
    .insert(draft.categories.map((category) => ({
      category_key: category.categoryKey,
      category_name: category.categoryName,
      policy_version_id: policyVersionId,
      raw_category_name: category.rawCategoryName ?? null,
      review_status: category.reviewStatus,
      sort_order: category.sortOrder,
      source_reference: category.sourceReference,
    })))
    .select("id, category_key");
  if (categoryError || !categoryRows) return { error: categoryError ?? new Error("categories insert failed") };

  const categoryIdByKey = new Map(categoryRows.map((row: AnyRow) => [row.category_key, row.id]));
  const subcategoryRows = draft.subcategories.length
    ? await client
        .from("program_policy_subcategories")
        .insert(draft.subcategories.map((subcategory) => ({
          category_id: categoryIdByKey.get(subcategory.categoryKey),
          policy_version_id: policyVersionId,
          raw_subcategory_name: subcategory.rawSubcategoryName ?? null,
          review_status: subcategory.reviewStatus,
          sort_order: subcategory.sortOrder,
          source_reference: subcategory.sourceReference,
          subcategory_key: subcategory.subcategoryKey,
          subcategory_name: subcategory.subcategoryName,
        })))
        .select("id, subcategory_key")
    : { data: [], error: null };
  if (subcategoryRows.error) return { error: subcategoryRows.error };

  const subcategoryIdByKey = new Map((subcategoryRows.data ?? []).map((row: AnyRow) => [row.subcategory_key, row.id]));
  const evidenceRows = draft.evidenceRequirements.map((evidence) => ({
    category_id: evidence.categoryKey ? categoryIdByKey.get(evidence.categoryKey) ?? null : null,
    condition_text: evidence.conditionText ?? null,
    document_key: evidence.documentKey ?? evidence.evidenceKey,
    evidence_key: evidence.evidenceKey,
    evidence_name: evidence.evidenceName,
    fulfillment_type: evidence.fulfillmentType,
    policy_version_id: policyVersionId,
    requirement_type: evidence.requirementType,
    review_status: evidence.reviewStatus,
    source_reference: evidence.sourceReference,
    subcategory_id: evidence.subcategoryKey ? subcategoryIdByKey.get(evidence.subcategoryKey) ?? null : null,
  }));
  const { error } = await client.from("program_policy_evidence_requirements").insert(evidenceRows);
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

  const { data: document } = await client
    .from("program_policy_documents")
    .select("original_file_name")
    .eq("policy_version_id", policyVersionId)
    .eq("role", "primary")
    .eq("upload_status", "ready")
    .maybeSingle();

  const draft = input.extractedText ? parseTextDraft(input.extractedText, document?.original_file_name ?? "policy.pdf") : null;
  if (!draft) {
    const reason = input.extractedText ? "Policy text did not pass the usable draft gate." : "PDF text extraction is not available for this document yet.";
    await client
      .from("program_policy_versions")
      .update({ extraction_failure_reason: reason, extraction_status: "failed", operation_status: "extraction_failed", status: "needs_review" })
      .eq("id", policyVersionId);
    return failure(409, programEvidencePolicyErrorCodes.extractionFailed, reason);
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
