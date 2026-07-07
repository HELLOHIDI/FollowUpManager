import type { Hono } from "hono";
import { failure, respond } from "@/backend/http/response";
import {
  getLogger,
  getSupabase,
  type AppEnv,
} from "@/backend/hono/context";
import type { MutationClientFactory } from "@/backend/supabase/client";
import { CompanyInputSchema, CompanyParamsSchema } from "./schema";
import {
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from "./service";

type CompanyRouteOptions = {
  createCompanyMutationClient: MutationClientFactory;
};

const parseBody = async (request: { json: () => Promise<unknown> }) =>
  request.json().catch(() => null);

const logCompanyFailure = (
  logger: ReturnType<typeof getLogger>,
  route: string,
  result: { ok: boolean; error?: { code: string } },
  companyId?: string
) => {
  if (result.ok || !result.error) {
    return;
  }

  logger.error("Company API request failed", {
    code: result.error.code,
    ...(companyId ? { companyId } : {}),
    route,
  });
};

export const registerCompanyRoutes = (
  app: Hono<AppEnv>,
  options: CompanyRouteOptions
) => {
  app.get("/companies", async (context) => {
    const result = await listCompanies(getSupabase(context));
    logCompanyFailure(getLogger(context), "GET /companies", result);
    return respond(context, result);
  });

  app.post("/companies", async (context) => {
    const parsedBody = CompanyInputSchema.safeParse(
      await parseBody(context.req)
    );

    if (!parsedBody.success) {
      return respond(
        context,
        failure(
          400,
          "INVALID_COMPANY_BODY",
          "기업 입력값을 확인해 주세요.",
          parsedBody.error.flatten()
        )
      );
    }

    const result = await createCompany(
      options.createCompanyMutationClient,
      parsedBody.data
    );
    logCompanyFailure(getLogger(context), "POST /companies", result);
    return respond(context, result);
  });

  app.get("/companies/:companyId", async (context) => {
    const parsedParams = CompanyParamsSchema.safeParse({
      companyId: context.req.param("companyId"),
    });

    if (!parsedParams.success) {
      return respond(
        context,
        failure(
          400,
          "INVALID_COMPANY_PARAMS",
          "기업 ID를 확인해 주세요.",
          parsedParams.error.flatten()
        )
      );
    }

    const result = await getCompany(
      getSupabase(context),
      parsedParams.data.companyId
    );
    logCompanyFailure(
      getLogger(context),
      "GET /companies/:companyId",
      result,
      parsedParams.data.companyId
    );
    return respond(context, result);
  });

  app.patch("/companies/:companyId", async (context) => {
    const parsedParams = CompanyParamsSchema.safeParse({
      companyId: context.req.param("companyId"),
    });

    if (!parsedParams.success) {
      return respond(
        context,
        failure(
          400,
          "INVALID_COMPANY_PARAMS",
          "기업 ID를 확인해 주세요.",
          parsedParams.error.flatten()
        )
      );
    }

    const parsedBody = CompanyInputSchema.safeParse(
      await parseBody(context.req)
    );

    if (!parsedBody.success) {
      return respond(
        context,
        failure(
          400,
          "INVALID_COMPANY_BODY",
          "기업 입력값을 확인해 주세요.",
          parsedBody.error.flatten()
        )
      );
    }

    const result = await updateCompany(
      options.createCompanyMutationClient,
      parsedParams.data.companyId,
      parsedBody.data
    );
    logCompanyFailure(
      getLogger(context),
      "PATCH /companies/:companyId",
      result,
      parsedParams.data.companyId
    );
    return respond(context, result);
  });

  app.delete("/companies/:companyId", async (context) => {
    const parsedParams = CompanyParamsSchema.safeParse({
      companyId: context.req.param("companyId"),
    });

    if (!parsedParams.success) {
      return respond(
        context,
        failure(
          400,
          "INVALID_COMPANY_PARAMS",
          "기업 ID를 확인해 주세요.",
          parsedParams.error.flatten()
        )
      );
    }

    const result = await deleteCompany(
      options.createCompanyMutationClient,
      parsedParams.data.companyId
    );
    logCompanyFailure(
      getLogger(context),
      "DELETE /companies/:companyId",
      result,
      parsedParams.data.companyId
    );
    return respond(context, result);
  });
};
