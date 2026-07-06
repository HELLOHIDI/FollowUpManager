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
  const authenticatedMutationClient = (context: Parameters<typeof respond>[0]) =>
    () => getSupabase(context);
  const shouldRetryWithAuthenticatedClient = (result: {
    error?: { code: string };
    ok: boolean;
    status?: number;
  }) =>
    !result.ok &&
    result.status === 500 &&
    ["COMPANY_FETCH_ERROR", "COMPANY_WRITE_ERROR"].includes(
      result.error?.code ?? ""
    );
  const runMutation = async <T>(
    context: Parameters<typeof respond>[0],
    mutation: (createClient: MutationClientFactory) => Promise<T & { ok: boolean }>
  ) => {
    try {
      const serviceResult = await mutation(options.createCompanyMutationClient);
      return shouldRetryWithAuthenticatedClient(serviceResult)
        ? mutation(authenticatedMutationClient(context))
        : serviceResult;
    } catch {
      return mutation(authenticatedMutationClient(context));
    }
  };

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

    const result = await runMutation(context, (createClient) =>
      createCompany(createClient, parsedBody.data)
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

    const result = await runMutation(context, (createClient) =>
      updateCompany(createClient, parsedParams.data.companyId, parsedBody.data)
    );
    logCompanyFailure(
      getLogger(context),
      "PATCH /companies/:companyId",
      result,
      parsedParams.data.companyId
    );
    return respond(context, result);
  });
};
