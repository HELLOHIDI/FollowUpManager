import type { Hono } from "hono";
import { failure, respond } from "@/backend/http/response";
import { getCurrentUser, getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import {
  PolicyDocumentParamsSchema,
  PolicyDraftUpdateInputSchema,
  PolicyExtractionInputSchema,
  PolicyParamsSchema,
  PolicyUploadIntentInputSchema,
  PolicyVersionParamsSchema,
} from "./schema";
import {
  completePolicyUpload,
  confirmPolicy,
  createPolicyDocumentSignedUrl,
  createPolicyUploadIntent,
  getPolicyDraftDetail,
  getProjectPolicyStatus,
  previewPolicyConfirmation,
  resolvePolicyCategories,
  triggerDraftExtraction,
  updatePolicyDraft,
} from "./service";

const parseBody = async (request: { json: () => Promise<unknown> }) => request.json().catch(() => null);

export const registerProgramEvidencePolicyRoutes = (app: Hono<AppEnv>) => {
  const invalid = (context: Parameters<typeof respond>[0], code: string, message: string, details?: unknown) =>
    respond(context, failure(400, code, message, details));

  const log = (
    context: Parameters<typeof respond>[0],
    route: string,
    result: { ok: boolean; error?: { code: string } },
    ids: Record<string, string> = {},
  ) => {
    if (!result.ok && result.error) {
      getLogger(context).error("Program evidence policy API request failed", { code: result.error.code, route, ...ids });
    }
  };

  app.get("/projects/:projectId/program-policy/status", async (context) => {
    const params = PolicyParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_POLICY_PARAMS", "Project id is invalid.", params.error.flatten());
    const result = await getProjectPolicyStatus(getSupabase(context), params.data.projectId);
    log(context, "GET /projects/:projectId/program-policy/status", result, params.data);
    return respond(context, result);
  });

  app.get("/projects/:projectId/program-policy/category-options", async (context) => {
    const params = PolicyParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_POLICY_PARAMS", "Project id is invalid.", params.error.flatten());
    const result = await resolvePolicyCategories(getSupabase(context), params.data.projectId);
    log(context, "GET /projects/:projectId/program-policy/category-options", result, params.data);
    return respond(context, result);
  });

  app.post("/projects/:projectId/program-policy/upload-intents", async (context) => {
    const params = PolicyParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_POLICY_PARAMS", "Project id is invalid.", params.error.flatten());
    const body = PolicyUploadIntentInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) return invalid(context, "INVALID_POLICY_UPLOAD_BODY", "Policy PDF upload input is invalid.", body.error.flatten());
    const result = await createPolicyUploadIntent(getSupabase(context), params.data.projectId, getCurrentUser(context).id, body.data);
    log(context, "POST /projects/:projectId/program-policy/upload-intents", result, params.data);
    return respond(context, result);
  });

  app.post("/projects/:projectId/program-policy/:policyVersionId/documents/:documentId/complete", async (context) => {
    const params = PolicyDocumentParamsSchema.safeParse({
      documentId: context.req.param("documentId"),
      policyVersionId: context.req.param("policyVersionId"),
      projectId: context.req.param("projectId"),
    });
    if (!params.success) return invalid(context, "INVALID_POLICY_DOCUMENT_PARAMS", "Policy document params are invalid.", params.error.flatten());
    const result = await completePolicyUpload(getSupabase(context), params.data.projectId, params.data.policyVersionId, params.data.documentId);
    log(context, "POST /projects/:projectId/program-policy/:policyVersionId/documents/:documentId/complete", result, params.data);
    return respond(context, result);
  });

  app.post("/projects/:projectId/program-policy/:policyVersionId/extract", async (context) => {
    const params = PolicyVersionParamsSchema.safeParse({
      policyVersionId: context.req.param("policyVersionId"),
      projectId: context.req.param("projectId"),
    });
    if (!params.success) return invalid(context, "INVALID_POLICY_PARAMS", "Policy version params are invalid.", params.error.flatten());
    const body = PolicyExtractionInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) return invalid(context, "INVALID_POLICY_EXTRACTION_BODY", "Policy extraction input is invalid.", body.error.flatten());
    const result = await triggerDraftExtraction(getSupabase(context), params.data.projectId, params.data.policyVersionId, body.data);
    log(context, "POST /projects/:projectId/program-policy/:policyVersionId/extract", result, params.data);
    return respond(context, result);
  });

  app.get("/projects/:projectId/program-policy/:policyVersionId", async (context) => {
    const params = PolicyVersionParamsSchema.safeParse({
      policyVersionId: context.req.param("policyVersionId"),
      projectId: context.req.param("projectId"),
    });
    if (!params.success) return invalid(context, "INVALID_POLICY_PARAMS", "Policy version params are invalid.", params.error.flatten());
    const result = await getPolicyDraftDetail(getSupabase(context), params.data.projectId, params.data.policyVersionId);
    log(context, "GET /projects/:projectId/program-policy/:policyVersionId", result, params.data);
    return respond(context, result);
  });

  app.patch("/projects/:projectId/program-policy/:policyVersionId", async (context) => {
    const params = PolicyVersionParamsSchema.safeParse({
      policyVersionId: context.req.param("policyVersionId"),
      projectId: context.req.param("projectId"),
    });
    if (!params.success) return invalid(context, "INVALID_POLICY_PARAMS", "Policy version params are invalid.", params.error.flatten());
    const body = PolicyDraftUpdateInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) return invalid(context, "INVALID_POLICY_DRAFT_BODY", "Policy draft input is invalid.", body.error.flatten());
    const result = await updatePolicyDraft(getSupabase(context), params.data.projectId, params.data.policyVersionId, body.data);
    log(context, "PATCH /projects/:projectId/program-policy/:policyVersionId", result, params.data);
    return respond(context, result);
  });

  app.post("/projects/:projectId/program-policy/:policyVersionId/confirmation-preview", async (context) => {
    const params = PolicyVersionParamsSchema.safeParse({
      policyVersionId: context.req.param("policyVersionId"),
      projectId: context.req.param("projectId"),
    });
    if (!params.success) return invalid(context, "INVALID_POLICY_PARAMS", "Policy version params are invalid.", params.error.flatten());
    const result = await previewPolicyConfirmation(getSupabase(context), params.data.projectId, params.data.policyVersionId);
    log(context, "POST /projects/:projectId/program-policy/:policyVersionId/confirmation-preview", result, params.data);
    return respond(context, result);
  });

  app.post("/projects/:projectId/program-policy/:policyVersionId/confirm", async (context) => {
    const params = PolicyVersionParamsSchema.safeParse({
      policyVersionId: context.req.param("policyVersionId"),
      projectId: context.req.param("projectId"),
    });
    if (!params.success) return invalid(context, "INVALID_POLICY_PARAMS", "Policy version params are invalid.", params.error.flatten());
    const result = await confirmPolicy(getSupabase(context), params.data.projectId, params.data.policyVersionId, getCurrentUser(context).id);
    log(context, "POST /projects/:projectId/program-policy/:policyVersionId/confirm", result, params.data);
    return respond(context, result);
  });

  app.post("/projects/:projectId/program-policy/:policyVersionId/documents/:documentId/signed-url", async (context) => {
    const params = PolicyDocumentParamsSchema.safeParse({
      documentId: context.req.param("documentId"),
      policyVersionId: context.req.param("policyVersionId"),
      projectId: context.req.param("projectId"),
    });
    if (!params.success) return invalid(context, "INVALID_POLICY_DOCUMENT_PARAMS", "Policy document params are invalid.", params.error.flatten());
    const result = await createPolicyDocumentSignedUrl(getSupabase(context), params.data.projectId, params.data.policyVersionId, params.data.documentId);
    log(context, "POST /projects/:projectId/program-policy/:policyVersionId/documents/:documentId/signed-url", result, params.data);
    return respond(context, result);
  });
};
