import type { Hono } from "hono";
import { failure, respond } from "@/backend/http/response";
import { getCurrentUser, getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import type { MutationClientFactory } from "@/backend/supabase/client";
import { expenseErrorCodes } from "./error";
import {
  ExpenseCreateInputSchema,
  ExpenseDetailParamsSchema,
  ExpenseEvidenceRelinkInputSchema,
  ExpenseEvidenceRequirementStatusInputSchema,
  ExpenseEvidenceParamsSchema,
  ExpenseParamsSchema,
  ExpenseStageUpdateInputSchema,
  ExpenseUpdateInputSchema,
} from "./schema";
import {
  createExpense,
  createExpenseEvidenceSignedUrl,
  deleteExpenseEvidence,
  getExpenseDetail,
  getExpenseHistory,
  listExpenseEvidence,
  listProjectExpensesPage,
  relinkExpenseEvidence,
  updateExpense,
  updateExpenseEvidenceRequirementStatus,
  updateExpenseStage,
  uploadExpenseEvidence,
} from "./service";

const parseBody = async (request: { json: () => Promise<unknown> }) =>
  request.json().catch(() => null);

const isFileLike = (value: FormDataEntryValue | null): value is File =>
  Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "name" in value &&
      "size" in value,
  );

const readOptionalFormString = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const registerExpenseRoutes = (
  app: Hono<AppEnv>,
  options: { createExpenseMutationClient: MutationClientFactory },
) => {
  app.get("/projects/:projectId/expenses", async (context) => {
    const params = ExpenseParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트 ID를 확인해 주세요."));
    }
    const result = await listProjectExpensesPage(getSupabase(context), params.data.projectId);
    if ("error" in result) {
      getLogger(context).error("Expense page API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        route: "GET /projects/:projectId/expenses",
      });
    }
    return respond(context, result);
  });

  app.post("/projects/:projectId/expenses", async (context) => {
    const params = ExpenseParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트 ID를 확인해 주세요."));
    }
    const body = ExpenseCreateInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidBody, "지출 입력값을 확인해 주세요.", body.error.flatten()));
    }
    const result = await createExpense(options.createExpenseMutationClient(), params.data.projectId, body.data);
    if ("error" in result) {
      getLogger(context).error("Expense create API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        route: "POST /projects/:projectId/expenses",
      });
    }
    return respond(context, result);
  });

  app.get("/projects/:projectId/expenses/:expenseId", async (context) => {
    const params = ExpenseDetailParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트 ID와 지출 ID를 확인해 주세요."));
    }
    const result = await getExpenseDetail(getSupabase(context), params.data.projectId, params.data.expenseId);
    if ("error" in result) {
      getLogger(context).error("Expense detail API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        expenseId: params.data.expenseId,
        route: "GET /projects/:projectId/expenses/:expenseId",
      });
    }
    return respond(context, result);
  });

  app.get("/projects/:projectId/expenses/:expenseId/history", async (context) => {
    const params = ExpenseDetailParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트 ID와 지출 ID를 확인해 주세요."));
    }
    const result = await getExpenseHistory(getSupabase(context), params.data.projectId, params.data.expenseId);
    if ("error" in result) {
      getLogger(context).error("Expense history API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        expenseId: params.data.expenseId,
        route: "GET /projects/:projectId/expenses/:expenseId/history",
      });
    }
    return respond(context, result);
  });

  app.get("/projects/:projectId/expenses/:expenseId/evidence", async (context) => {
    const params = ExpenseDetailParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트 ID와 지출 ID를 확인해 주세요."));
    }
    const result = await listExpenseEvidence(getSupabase(context), params.data.projectId, params.data.expenseId);
    if ("error" in result) {
      getLogger(context).error("Expense evidence list API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        expenseId: params.data.expenseId,
        route: "GET /projects/:projectId/expenses/:expenseId/evidence",
      });
    }
    return respond(context, result);
  });

  app.post("/projects/:projectId/expenses/:expenseId/evidence", async (context) => {
    const params = ExpenseDetailParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트 ID와 지출 ID를 확인해 주세요."));
    }

    const formData = await context.req.formData().catch(() => null);
    const file = formData?.get("file") ?? null;
    const documentKey = readOptionalFormString(formData?.get("documentKey") ?? null);
    const requirementKey = readOptionalFormString(formData?.get("requirementKey") ?? null);

    if (!formData || !isFileLike(file) || !documentKey) {
      return respond(context, failure(400, expenseErrorCodes.evidenceInvalid, "증빙 업로드 입력값을 확인해 주세요."));
    }

    const result = await uploadExpenseEvidence(
      options.createExpenseMutationClient(),
      params.data.projectId,
      params.data.expenseId,
      getCurrentUser(context).id,
      {
        browserMimeType: file.type || null,
        documentKey,
        file,
        fileSize: file.size,
        originalFileName: file.name,
        requirementKey,
      },
    );

    if ("error" in result) {
      getLogger(context).error("Expense evidence upload API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        expenseId: params.data.expenseId,
        route: "POST /projects/:projectId/expenses/:expenseId/evidence",
      });
    }
    return respond(context, result);
  });

  app.post("/projects/:projectId/expenses/:expenseId/evidence/:evidenceId/signed-url", async (context) => {
    const params = ExpenseEvidenceParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
      evidenceId: context.req.param("evidenceId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트, 지출, 증빙 ID를 확인해 주세요."));
    }
    const result = await createExpenseEvidenceSignedUrl(
      getSupabase(context),
      params.data.projectId,
      params.data.expenseId,
      params.data.evidenceId,
    );
    if ("error" in result) {
      getLogger(context).error("Expense evidence signed-url API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        expenseId: params.data.expenseId,
        evidenceId: params.data.evidenceId,
        route: "POST /projects/:projectId/expenses/:expenseId/evidence/:evidenceId/signed-url",
      });
    }
    return respond(context, result);
  });

  app.patch("/projects/:projectId/expenses/:expenseId/evidence/:evidenceId/link", async (context) => {
    const params = ExpenseEvidenceParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
      evidenceId: context.req.param("evidenceId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트, 지출, 증빙 ID를 확인해 주세요."));
    }
    const body = ExpenseEvidenceRelinkInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) {
      return respond(context, failure(400, expenseErrorCodes.evidenceInvalid, "Evidence link input is invalid.", body.error.flatten()));
    }
    const result = await relinkExpenseEvidence(
      options.createExpenseMutationClient(),
      params.data.projectId,
      params.data.expenseId,
      params.data.evidenceId,
      getCurrentUser(context).id,
      body.data,
    );
    return respond(context, result);
  });

  app.patch("/projects/:projectId/expenses/:expenseId/evidence-requirements/:requirementKey/status", async (context) => {
    const params = ExpenseDetailParamsSchema.extend({
      requirementKey: ExpenseEvidenceRelinkInputSchema.shape.documentKey,
    }).safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
      requirementKey: context.req.param("requirementKey"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트, 지출, 증빙 ID를 확인해 주세요."));
    }
    const body = ExpenseEvidenceRequirementStatusInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) {
      return respond(context, failure(400, expenseErrorCodes.evidenceInvalid, "Evidence status input is invalid.", body.error.flatten()));
    }
    const result = await updateExpenseEvidenceRequirementStatus(
      options.createExpenseMutationClient(),
      params.data.projectId,
      params.data.expenseId,
      params.data.requirementKey,
      getCurrentUser(context).id,
      body.data,
    );
    return respond(context, result);
  });

  app.delete("/projects/:projectId/expenses/:expenseId/evidence/:evidenceId", async (context) => {
    const params = ExpenseEvidenceParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
      evidenceId: context.req.param("evidenceId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트, 지출, 증빙 ID를 확인해 주세요."));
    }
    const result = await deleteExpenseEvidence(
      options.createExpenseMutationClient(),
      params.data.projectId,
      params.data.expenseId,
      params.data.evidenceId,
      getCurrentUser(context).id,
    );
    if ("error" in result) {
      getLogger(context).error("Expense evidence delete API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        expenseId: params.data.expenseId,
        evidenceId: params.data.evidenceId,
        route: "DELETE /projects/:projectId/expenses/:expenseId/evidence/:evidenceId",
      });
    }
    return respond(context, result);
  });

  app.patch("/projects/:projectId/expenses/:expenseId", async (context) => {
    const params = ExpenseDetailParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트 ID와 지출 ID를 확인해 주세요."));
    }
    const body = ExpenseUpdateInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidBody, "지출 입력값을 확인해 주세요.", body.error.flatten()));
    }
    const result = await updateExpense(options.createExpenseMutationClient(), params.data.projectId, params.data.expenseId, body.data);
    if ("error" in result) {
      getLogger(context).error("Expense update API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        expenseId: params.data.expenseId,
        route: "PATCH /projects/:projectId/expenses/:expenseId",
      });
    }
    return respond(context, result);
  });

  app.patch("/projects/:projectId/expenses/:expenseId/stage", async (context) => {
    const params = ExpenseDetailParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
      expenseId: context.req.param("expenseId"),
    });
    if (!params.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidParams, "프로젝트 ID와 지출 ID를 확인해 주세요."));
    }
    const body = ExpenseStageUpdateInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) {
      return respond(context, failure(400, expenseErrorCodes.invalidBody, "지출 입력값을 확인해 주세요.", body.error.flatten()));
    }
    const result = await updateExpenseStage(options.createExpenseMutationClient(), params.data.projectId, params.data.expenseId, body.data);
    if ("error" in result) {
      getLogger(context).error("Expense stage update API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        expenseId: params.data.expenseId,
        route: "PATCH /projects/:projectId/expenses/:expenseId/stage",
      });
    }
    return respond(context, result);
  });
};
