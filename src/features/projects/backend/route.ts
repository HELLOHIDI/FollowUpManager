import type { Hono } from "hono";
import { failure, respond } from "@/backend/http/response";
import { getCurrentUser, getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import type { ProjectMutationClientFactory } from "./mutation-client";
import { CompanyProjectsParamsSchema, MAX_DOCUMENT_SIZE, ProjectDocumentParamsSchema, ProjectInputSchema, ProjectParamsSchema, SaveProjectEvidenceDocumentsInputSchema, UploadIntentInputSchema } from "./schema";
import { completeUpload, createDocumentSignedUrl, createProject, createUploadIntent, deleteProjectDocument, getProject, listProjectDocuments, listProjectEvidenceTemplateDownloads, listProjects, reconcileProjectEvidenceDocumentsFromConfirmedPolicy, saveProjectEvidenceTemplateSetup, updateProject } from "./service";

const parseBody = async (request: { json: () => Promise<unknown> }) => request.json().catch(() => null);

export const registerProjectRoutes = (app: Hono<AppEnv>, options: { createProjectMutationClient: ProjectMutationClientFactory }) => {
  const invalid = (context: Parameters<typeof respond>[0], code: string, message: string, details?: unknown) => respond(context, failure(400, code, message, details));
  const log = (context: Parameters<typeof respond>[0], route: string, result: { ok: boolean; error?: { code: string } }, ids: Record<string, string> = {}) => {
    if (!result.ok && result.error) getLogger(context).error("Project API request failed", { code: result.error.code, route, ...ids });
  };

  app.get("/companies/:companyId/projects", async (context) => {
    const params = CompanyProjectsParamsSchema.safeParse({ companyId: context.req.param("companyId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "기업 ID를 확인해 주세요.", params.error.flatten());
    const result = await listProjects(getSupabase(context), params.data.companyId);
    log(context, "GET /companies/:companyId/projects", result, params.data);
    return respond(context, result);
  });

  app.post("/companies/:companyId/projects", async (context) => {
    const params = CompanyProjectsParamsSchema.safeParse({ companyId: context.req.param("companyId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "기업 ID를 확인해 주세요.", params.error.flatten());
    const body = ProjectInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) return invalid(context, "INVALID_PROJECT_BODY", "사업 입력값을 확인해 주세요.", body.error.flatten());
    const result = await createProject(options.createProjectMutationClient(), params.data.companyId, body.data);
    log(context, "POST /companies/:companyId/projects", result, params.data);
    return respond(context, result);
  });

  app.get("/projects/:projectId", async (context) => {
    const params = ProjectParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "사업 ID를 확인해 주세요.", params.error.flatten());
    const result = await getProject(getSupabase(context), params.data.projectId);
    log(context, "GET /projects/:projectId", result, params.data);
    return respond(context, result);
  });

  app.patch("/projects/:projectId", async (context) => {
    const params = ProjectParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "사업 ID를 확인해 주세요.", params.error.flatten());
    const body = ProjectInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) return invalid(context, "INVALID_PROJECT_BODY", "사업 입력값을 확인해 주세요.", body.error.flatten());
    const result = await updateProject(options.createProjectMutationClient(), params.data.projectId, body.data);
    log(context, "PATCH /projects/:projectId", result, params.data);
    return respond(context, result);
  });

  app.get("/projects/:projectId/documents", async (context) => {
    const params = ProjectParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "사업 ID를 확인해 주세요.", params.error.flatten());
    return respond(context, await listProjectDocuments(options.createProjectMutationClient(), params.data.projectId));
  });

  app.get("/projects/:projectId/evidence-documents", async (context) => {
    const params = ProjectParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "사업 ID를 확인해 주세요.", params.error.flatten());
    return respond(context, await reconcileProjectEvidenceDocumentsFromConfirmedPolicy(options.createProjectMutationClient(), params.data.projectId));
  });

  app.put("/projects/:projectId/evidence-documents", async (context) => {
    const params = ProjectParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "사업 ID를 확인해 주세요.", params.error.flatten());
    const body = SaveProjectEvidenceDocumentsInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) return invalid(context, "INVALID_PROJECT_TEMPLATE_BODY", "기관 양식 연결 정보를 확인해 주세요.", body.error.flatten());
    return respond(context, await saveProjectEvidenceTemplateSetup(options.createProjectMutationClient(), params.data.projectId, body.data));
  });

  app.get("/projects/:projectId/evidence-template-links", async (context) => {
    const params = ProjectParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "사업 ID를 확인해 주세요.", params.error.flatten());
    return respond(context, await listProjectEvidenceTemplateDownloads(options.createProjectMutationClient(), params.data.projectId));
  });

  app.post("/projects/:projectId/documents/upload-intents", async (context) => {
    const params = ProjectParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_PARAMS", "사업 ID를 확인해 주세요.", params.error.flatten());
    const rawBody = await parseBody(context.req);
    if (typeof rawBody === "object" && rawBody !== null && "fileSize" in rawBody && typeof rawBody.fileSize === "number" && rawBody.fileSize > MAX_DOCUMENT_SIZE) {
      return respond(context, failure(413, "PROJECT_DOCUMENT_TOO_LARGE", "파일은 20MB를 초과할 수 없습니다."));
    }
    const body = UploadIntentInputSchema.safeParse(rawBody);
    if (!body.success) return invalid(context, "INVALID_PROJECT_DOCUMENT_BODY", "파일 정보를 확인해 주세요.", body.error.flatten());
    return respond(context, await createUploadIntent(options.createProjectMutationClient(), params.data.projectId, getCurrentUser(context).id, body.data));
  });

  const documentParams = (context: Parameters<typeof respond>[0]) => ProjectDocumentParamsSchema.safeParse({ documentId: context.req.param("documentId"), projectId: context.req.param("projectId") });

  app.post("/projects/:projectId/documents/:documentId/complete", async (context) => {
    const params = documentParams(context);
    if (!params.success) return invalid(context, "INVALID_PROJECT_DOCUMENT_PARAMS", "첨부파일 ID를 확인해 주세요.", params.error.flatten());
    return respond(context, await completeUpload(options.createProjectMutationClient(), params.data.projectId, params.data.documentId));
  });

  app.delete("/projects/:projectId/documents/:documentId", async (context) => {
    const params = documentParams(context);
    if (!params.success) return invalid(context, "INVALID_PROJECT_DOCUMENT_PARAMS", "첨부파일 ID를 확인해 주세요.", params.error.flatten());
    return respond(context, await deleteProjectDocument(options.createProjectMutationClient(), params.data.projectId, params.data.documentId));
  });

  app.post("/projects/:projectId/documents/:documentId/signed-url", async (context) => {
    const params = documentParams(context);
    if (!params.success) return invalid(context, "INVALID_PROJECT_DOCUMENT_PARAMS", "첨부파일 ID를 확인해 주세요.", params.error.flatten());
    return respond(context, await createDocumentSignedUrl(options.createProjectMutationClient(), params.data.projectId, params.data.documentId));
  });
};
