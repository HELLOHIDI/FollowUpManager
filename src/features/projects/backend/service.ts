import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import type { Database } from "@/lib/supabase/types";
import { projectErrorCodes, type ProjectServiceError } from "./error";
import {
  getDocumentMetadata,
  PROJECT_DOCUMENT_BUCKET,
  ProjectDocumentResponseSchema,
  ProjectEvidenceTemplateDownloadListSchema,
  ProjectEvidenceTemplateSetupResponseSchema,
  ProjectResponseSchema,
  type ProjectDocumentResponse,
  type ProjectDocumentPurpose,
  type ProjectEvidenceTemplateDownload,
  type ProjectEvidenceTemplateSetupResponse,
  type ProjectInput,
  type ProjectResponse,
  type SaveProjectEvidenceDocumentsInput,
  type UploadIntentInput,
} from "./schema";

type Client = SupabaseClient<Database>;
type Result<T> = HandlerResult<T, ProjectServiceError, unknown>;
const PROJECT_SELECT = "id, company_id, project_name, host_institution, agreement_start_date, agreement_end_date, government_subsidy_amount, self_cash_amount, self_in_kind_amount, self_contribution_amount, total_project_budget, assignment_number, assignment_name, manager_name, manager_email, manager_phone, project_notes, profile_status, created_at, updated_at";
const DOCUMENT_SELECT = "id, project_id, original_file_name, file_size, mime_type, document_purpose, created_at";
const TEMPLATE_DOCUMENT_TYPE_SELECT = "id, project_id, document_key, display_name, source, stage_key, sort_order, category_key, category_name, subcategory_key, subcategory_name";
const ASSIGNMENT_CONSTRAINT = "projects_company_assignment_number_unique";

const mapProject = (row: Record<string, unknown>, status: 200 | 201 = 200): Result<ProjectResponse> => {
  const parsed = ProjectResponseSchema.safeParse({
    agreementEndDate: row.agreement_end_date, agreementStartDate: row.agreement_start_date,
    assignmentName: row.assignment_name, assignmentNumber: row.assignment_number, companyId: row.company_id,
    createdAt: row.created_at, governmentSubsidyAmount: row.government_subsidy_amount, hostInstitution: row.host_institution,
    id: row.id, managerEmail: row.manager_email, managerName: row.manager_name, managerPhone: row.manager_phone,
    profileStatus: row.profile_status, projectName: row.project_name, projectNotes: row.project_notes,
    selfCashAmount: row.self_cash_amount, selfContributionAmount: row.self_contribution_amount,
    selfInKindAmount: row.self_in_kind_amount, totalProjectBudget: row.total_project_budget, updatedAt: row.updated_at,
  });
  return parsed.success ? success(parsed.data, status) : failure(500, projectErrorCodes.responseInvalid, "저장된 사업 정보가 올바르지 않습니다.");
};

const mapDocument = (row: Record<string, unknown>): Result<ProjectDocumentResponse> => {
  const parsed = ProjectDocumentResponseSchema.safeParse({
    createdAt: row.created_at, fileSize: row.file_size, id: row.id, mimeType: row.mime_type,
    originalFileName: row.original_file_name, projectId: row.project_id, purpose: row.document_purpose,
  });
  return parsed.success ? success(parsed.data) : failure(500, projectErrorCodes.responseInvalid, "첨부파일 정보가 올바르지 않습니다.");
};

const totals = (input: ProjectInput) => {
  const subsidy = BigInt(input.governmentSubsidyAmount);
  const cash = BigInt(input.selfCashAmount);
  const inKind = BigInt(input.selfInKindAmount);
  return { cash: Number(cash), inKind: Number(inKind), self: Number(cash + inKind), subsidy: Number(subsidy), total: Number(subsidy + cash + inKind) };
};

const toPayload = (input: ProjectInput) => {
  const amount = totals(input);
  return {
    agreement_end_date: input.agreementEndDate, agreement_start_date: input.agreementStartDate,
    assignment_name: input.assignmentName, assignment_number: input.assignmentNumber,
    government_subsidy_amount: amount.subsidy, host_institution: input.hostInstitution,
    manager_email: input.managerEmail, manager_name: input.managerName, manager_phone: input.managerPhone,
    profile_status: "complete", project_name: input.projectName, project_notes: input.projectNotes,
    self_cash_amount: amount.cash, self_contribution_amount: amount.self, self_in_kind_amount: amount.inKind,
    total_project_budget: amount.total,
  };
};

const writeFailure = (error: { code?: string; message?: string }) =>
  error.code === "23505" && error.message?.includes(ASSIGNMENT_CONSTRAINT)
    ? failure(409, projectErrorCodes.assignmentConflict, "같은 기업에 이미 등록된 과제번호입니다.")
    : failure(500, projectErrorCodes.writeError, "사업 정보를 저장하지 못했습니다.");

const getActiveCompany = (client: Client, companyId: string) =>
  client.from("companies").select("id").eq("id", companyId).is("deleted_at", null).maybeSingle();

export const listProjects = async (client: Client, companyId: string): Promise<Result<ProjectResponse[]>> => {
  const company = await getActiveCompany(client, companyId);
  if (company.error) return failure(500, projectErrorCodes.fetchError, "기업 정보를 확인하지 못했습니다.");
  if (!company.data) return failure(404, projectErrorCodes.notFound, "기업을 찾을 수 없습니다.");
  const { data, error } = await client.from("projects").select(PROJECT_SELECT).eq("company_id", companyId).is("deleted_at", null).order("created_at").order("id");
  if (error) return failure(500, projectErrorCodes.fetchError, "사업 목록을 불러오지 못했습니다.");
  const result: ProjectResponse[] = [];
  for (const row of data ?? []) {
    const mapped = mapProject(row as Record<string, unknown>);
    if (mapped.ok === false) return failure(mapped.status, mapped.error.code, mapped.error.message, mapped.error.details);
    result.push(mapped.data);
  }
  return success(result);
};

export const getProject = async (client: Client, projectId: string): Promise<Result<ProjectResponse>> => {
  const { data, error } = await client.from("projects").select(PROJECT_SELECT).eq("id", projectId).is("deleted_at", null).maybeSingle();
  if (error) return failure(500, projectErrorCodes.fetchError, "사업 정보를 불러오지 못했습니다.");
  return data ? mapProject(data as Record<string, unknown>) : failure(404, projectErrorCodes.notFound, "사업을 찾을 수 없습니다.");
};

export const createProject = async (client: Client, companyId: string, input: ProjectInput): Promise<Result<ProjectResponse>> => {
  const company = await getActiveCompany(client, companyId);
  if (company.error) return failure(500, projectErrorCodes.fetchError, "기업 정보를 확인하지 못했습니다.");
  if (!company.data) return failure(404, projectErrorCodes.notFound, "기업을 찾을 수 없습니다.");
  const { data, error } = await client.from("projects").insert({ company_id: companyId, ...toPayload(input) }).select(PROJECT_SELECT).single();
  return error ? writeFailure(error) : mapProject(data as Record<string, unknown>, 201);
};

export const updateProject = async (client: Client, projectId: string, input: ProjectInput): Promise<Result<ProjectResponse>> => {
  const { data, error } = await client.from("projects").update(toPayload(input)).eq("id", projectId).is("deleted_at", null).select(PROJECT_SELECT).maybeSingle();
  if (error) return writeFailure(error);
  return data ? mapProject(data as Record<string, unknown>) : failure(404, projectErrorCodes.notFound, "사업을 찾을 수 없습니다.");
};

const getDocumentRow = (client: Client, projectId: string, documentId: string) =>
  client.from("project_documents").select("*").eq("id", documentId).eq("project_id", projectId).maybeSingle();

const mapTemplateSetup = (payload: unknown): Result<ProjectEvidenceTemplateSetupResponse> => {
  const parsed = ProjectEvidenceTemplateSetupResponseSchema.safeParse(payload);
  return parsed.success ? success(parsed.data) : failure(500, projectErrorCodes.responseInvalid, "기관 양식 연결 정보가 올바르지 않습니다.");
};

const mapTemplateDownloads = (payload: unknown): Result<ProjectEvidenceTemplateDownload[]> => {
  const parsed = ProjectEvidenceTemplateDownloadListSchema.safeParse(payload);
  return parsed.success ? success(parsed.data) : failure(500, projectErrorCodes.responseInvalid, "기관 양식 다운로드 정보가 올바르지 않습니다.");
};

const toDocumentTypeResponse = (row: Record<string, unknown>) => ({
  displayName: row.display_name,
  documentKey: row.document_key,
  id: row.id,
  projectId: row.project_id,
  sortOrder: row.sort_order,
  source: row.source,
  stageKey: row.stage_key,
  categoryKey: row.category_key,
  categoryName: row.category_name,
  subcategoryKey: row.subcategory_key,
  subcategoryName: row.subcategory_name,
});

const toLinkResponse = (row: Record<string, unknown>) => ({
  documentKey: row.document_key,
  documentTypeId: row.document_type_id,
  projectDocumentId: row.project_document_id,
  sortOrder: row.sort_order,
});

export const reconcileProjectEvidenceDocumentsFromConfirmedPolicy = async (client: Client, projectId: string): Promise<Result<ProjectEvidenceTemplateSetupResponse>> => {
  const db = client as SupabaseClient<any>;
  const project = await db.from("projects").select("id, confirmed_policy_version_id").eq("id", projectId).is("deleted_at", null).maybeSingle();
  if (project.error) return failure(500, projectErrorCodes.fetchError, "사업 정책 정보를 확인하지 못했습니다.");
  if (!project.data) return failure(404, projectErrorCodes.notFound, "사업을 찾을 수 없습니다.");

  const policyVersionId = project.data.confirmed_policy_version_id as string | null;
  if (policyVersionId) {
    const { data, error } = await db
      .from("program_policy_evidence_requirements")
      .select("document_key, evidence_key, evidence_name, sort_order, program_policy_categories(category_key, category_name), program_policy_subcategories(subcategory_key, subcategory_name)")
      .eq("policy_version_id", policyVersionId)
      .order("sort_order")
      .order("evidence_key");
    if (error) return failure(500, projectErrorCodes.fetchError, "정책 증빙서류를 불러오지 못했습니다.");

    const rows = new Map<string, Record<string, unknown>>();
    for (const row of data ?? []) {
      const documentKey = String(row.document_key || row.evidence_key || "");
      if (!documentKey || rows.has(documentKey)) continue;
      rows.set(documentKey, {
        display_name: String(row.evidence_name || documentKey),
        document_key: documentKey,
        project_id: projectId,
        sort_order: Number(row.sort_order ?? rows.size),
        source: "policy",
        stage_key: "execution_request",
        category_key: (row.program_policy_categories as { category_key?: string } | null)?.category_key ?? null,
        category_name: (row.program_policy_categories as { category_name?: string } | null)?.category_name ?? null,
        subcategory_key: (row.program_policy_subcategories as { subcategory_key?: string } | null)?.subcategory_key ?? null,
        subcategory_name: (row.program_policy_subcategories as { subcategory_name?: string } | null)?.subcategory_name ?? null,
      });
    }

    if (rows.size > 0) {
      const upsert = await db.from("project_evidence_document_types").upsert([...rows.values()], { onConflict: "project_id,document_key" });
      if (upsert.error) return failure(500, projectErrorCodes.writeError, "증빙서류 목록을 동기화하지 못했습니다.");
    }
  }

  return listProjectEvidenceDocuments(client, projectId);
};

export const listProjectEvidenceDocuments = async (client: Client, projectId: string): Promise<Result<ProjectEvidenceTemplateSetupResponse>> => {
  const db = client as SupabaseClient<any>;
  const documentTypes = await db
    .from("project_evidence_document_types")
    .select(TEMPLATE_DOCUMENT_TYPE_SELECT)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("display_name");
  if (documentTypes.error) return failure(500, projectErrorCodes.fetchError, "증빙서류 목록을 불러오지 못했습니다.");

  const links = await db
    .from("project_document_template_links")
    .select("document_type_id, project_document_id, sort_order, project_evidence_document_types!inner(document_key), project_documents!inner(upload_status, deleted_at)")
    .eq("project_id", projectId)
    .eq("project_documents.upload_status", "ready")
    .is("project_documents.deleted_at", null)
    .order("sort_order");
  if (links.error) return failure(500, projectErrorCodes.fetchError, "기관 양식 연결 정보를 불러오지 못했습니다.");

  return mapTemplateSetup({
    documentTypes: (documentTypes.data ?? []).map((row: Record<string, unknown>) => toDocumentTypeResponse(row)),
    links: (links.data ?? []).map((row: Record<string, unknown>) => toLinkResponse({
      ...row,
      document_key: (row.project_evidence_document_types as { document_key?: string } | null)?.document_key,
    })),
  });
};

export const saveProjectEvidenceTemplateSetup = async (client: Client, projectId: string, input: SaveProjectEvidenceDocumentsInput): Promise<Result<ProjectEvidenceTemplateSetupResponse>> => {
  const { data, error } = await (client as SupabaseClient<any>).rpc("save_project_evidence_template_setup", {
    p_document_types: input.documentTypes,
    p_links: input.links,
    p_project_id: projectId,
  });
  return error ? failure(500, projectErrorCodes.writeError, "기관 양식 연결 정보를 저장하지 못했습니다.") : mapTemplateSetup(data);
};

export const listProjectEvidenceTemplateDownloads = async (client: Client, projectId: string): Promise<Result<ProjectEvidenceTemplateDownload[]>> => {
  const { data, error } = await (client as SupabaseClient<any>)
    .from("project_document_template_links")
    .select("document_type_id, sort_order, project_evidence_document_types!inner(document_key), project_documents!inner(id, original_file_name, file_size, upload_status, deleted_at)")
    .eq("project_id", projectId)
    .eq("project_documents.document_purpose", "institution_template")
    .eq("project_documents.upload_status", "ready")
    .is("project_documents.deleted_at", null)
    .order("sort_order");
  if (error) return failure(500, projectErrorCodes.fetchError, "기관 양식 다운로드 목록을 불러오지 못했습니다.");

  return mapTemplateDownloads((data ?? []).map((row: Record<string, unknown>) => {
    const document = row.project_documents as { id?: string; original_file_name?: string; file_size?: number } | null;
    const type = row.project_evidence_document_types as { document_key?: string } | null;
    return {
      documentKey: type?.document_key,
      documentTypeId: row.document_type_id,
      fileSize: document?.file_size,
      id: document?.id,
      originalFileName: document?.original_file_name,
      sortOrder: row.sort_order,
    };
  }));
};

export const listProjectDocuments = async (client: Client, projectId: string, purpose: ProjectDocumentPurpose = "institution_template"): Promise<Result<ProjectDocumentResponse[]>> => {
  const project = await getProject(client, projectId);
  if (project.ok === false) return failure(project.status, project.error.code, project.error.message, project.error.details);
  const { data, error } = await client.from("project_documents").select(DOCUMENT_SELECT).eq("project_id", projectId).eq("document_purpose", purpose).eq("upload_status", "ready").is("deleted_at", null).order("created_at");
  if (error) return failure(500, projectErrorCodes.fetchError, "첨부파일을 불러오지 못했습니다.");
  const documents: ProjectDocumentResponse[] = [];
  for (const row of data ?? []) {
    const mapped = mapDocument(row as Record<string, unknown>);
    if (mapped.ok === false) return failure(mapped.status, mapped.error.code, mapped.error.message, mapped.error.details);
    documents.push(mapped.data);
  }
  return success(documents);
};

export const createUploadIntent = async (client: Client, projectId: string, userId: string, input: UploadIntentInput) => {
  const project = await getProject(client, projectId);
  if (project.ok === false) return failure(project.status, project.error.code, project.error.message, project.error.details);
  const metadata = getDocumentMetadata(input);
  if (!metadata) return failure(400, projectErrorCodes.documentInvalid, "파일 확장자와 형식을 확인해 주세요.");
  const documentId = randomUUID();
  const storedFileName = `${randomUUID()}.${metadata.extension}`;
  const storagePath = `${project.data.companyId}/${projectId}/${documentId}/${storedFileName}`;
  const { error: insertError } = await client.from("project_documents").insert({
    company_id: project.data.companyId, file_extension: metadata.extension, file_size: input.fileSize,
    id: documentId, mime_type: metadata.canonicalMimeType, original_file_name: input.originalFileName,
    document_purpose: input.purpose, project_id: projectId, storage_path: storagePath, stored_file_name: storedFileName, uploaded_by: userId,
  });
  if (insertError) return failure(500, projectErrorCodes.writeError, "파일 업로드를 준비하지 못했습니다.");
  const { data, error } = await client.storage.from(PROJECT_DOCUMENT_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) {
    await client.from("project_documents").update({ deleted_at: new Date().toISOString() }).eq("id", documentId);
    return failure(500, projectErrorCodes.storageError, "파일 업로드 주소를 만들지 못했습니다.");
  }
  return success({ canonicalMimeType: metadata.canonicalMimeType, documentId, path: storagePath, signedUrl: data.signedUrl, token: data.token }, 201);
};

export const completeUpload = async (client: Client, projectId: string, documentId: string): Promise<Result<ProjectDocumentResponse>> => {
  const lookup = await getDocumentRow(client, projectId, documentId);
  if (lookup.error) return failure(500, projectErrorCodes.fetchError, "첨부파일 상태를 확인하지 못했습니다.");
  const row = lookup.data;
  if (!row) return failure(404, projectErrorCodes.notFound, "첨부파일을 찾을 수 없습니다.");
  if (row.deleted_at) return failure(409, projectErrorCodes.documentStateConflict, "삭제된 첨부파일입니다.");
  if (row.upload_status === "ready") return mapDocument(row as Record<string, unknown>);
  const parts = row.storage_path.split("/");
  const fileName = parts.pop()!;
  const { data, error } = await client.storage.from(PROJECT_DOCUMENT_BUCKET).list(parts.join("/"), { search: fileName });
  const object = data?.find((file) => file.name === fileName);
  const objectSize = Number(object?.metadata?.size ?? -1);
  const objectMime = String(object?.metadata?.mimetype ?? object?.metadata?.contentType ?? "");
  if (error || !object || objectSize !== row.file_size || objectMime !== row.mime_type) {
    return failure(409, projectErrorCodes.documentStateConflict, "업로드된 파일 검증에 실패했습니다.");
  }
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await client.from("project_documents").update({ ready_at: now, upload_status: "ready" }).eq("id", documentId).eq("project_id", projectId).eq("upload_status", "uploading").is("deleted_at", null).select(DOCUMENT_SELECT).maybeSingle();
  if (updateError) return failure(500, projectErrorCodes.writeError, "첨부파일 상태를 저장하지 못했습니다.");
  if (updated) return mapDocument(updated as Record<string, unknown>);
  const current = await getDocumentRow(client, projectId, documentId);
  if (current.error) return failure(500, projectErrorCodes.fetchError, "첨부파일 상태를 확인하지 못했습니다.");
  if (current.data?.deleted_at) return failure(409, projectErrorCodes.documentStateConflict, "삭제된 첨부파일입니다.");
  if (current.data?.upload_status === "ready") return mapDocument(current.data as Record<string, unknown>);
  return failure(409, projectErrorCodes.documentStateConflict, "첨부파일 상태가 변경되었습니다.");
};

export const deleteProjectDocument = async (client: Client, projectId: string, documentId: string) => {
  const lookup = await getDocumentRow(client, projectId, documentId);
  if (lookup.error) return failure(500, projectErrorCodes.fetchError, "첨부파일 상태를 확인하지 못했습니다.");
  const row = lookup.data;
  if (!row || row.deleted_at) return failure(404, projectErrorCodes.notFound, "첨부파일을 찾을 수 없습니다.");
  const linkCleanup = await (client as SupabaseClient<any>).from("project_document_template_links").delete().eq("project_id", projectId).eq("project_document_id", documentId);
  if (linkCleanup.error) return failure(500, projectErrorCodes.writeError, "기관 양식 연결을 정리하지 못했습니다.");
  const { data: deleted, error } = await client.from("project_documents").update({ deleted_at: new Date().toISOString() }).eq("id", documentId).eq("project_id", projectId).is("deleted_at", null).select("id").maybeSingle();
  if (error) return failure(500, projectErrorCodes.writeError, "첨부파일을 삭제하지 못했습니다.");
  if (!deleted) return failure(409, projectErrorCodes.documentStateConflict, "첨부파일 상태가 변경되었습니다.");
  const removal = await client.storage.from(PROJECT_DOCUMENT_BUCKET).remove([row.storage_path]);
  if (removal.error) console.warn("Project document object cleanup failed", { documentId, projectId });
  return success({ id: documentId });
};

export const createDocumentSignedUrl = async (client: Client, projectId: string, documentId: string) => {
  const lookup = await getDocumentRow(client, projectId, documentId);
  if (lookup.error) return failure(500, projectErrorCodes.fetchError, "첨부파일 상태를 확인하지 못했습니다.");
  const row = lookup.data;
  if (!row || row.deleted_at || row.upload_status !== "ready") return failure(404, projectErrorCodes.notFound, "첨부파일을 찾을 수 없습니다.");
  const { data, error } = await client.storage.from(PROJECT_DOCUMENT_BUCKET).createSignedUrl(row.storage_path, 60);
  return error || !data ? failure(500, projectErrorCodes.storageError, "파일을 열 수 없습니다.") : success({ signedUrl: data.signedUrl });
};
