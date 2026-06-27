import type { Hono } from "hono";
import { failure, respond } from "@/backend/http/response";
import { getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import { dashboardErrorCodes } from "./error";
import { DashboardParamsSchema } from "./schema";
import { getProjectDashboard } from "./service";

export const registerDashboardRoutes = (app: Hono<AppEnv>) => {
  app.get("/projects/:projectId/dashboard", async (context) => {
    const params = DashboardParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) {
      return respond(context, failure(400, dashboardErrorCodes.invalidParams, "프로젝트 ID를 확인해 주세요."));
    }
    const result = await getProjectDashboard(getSupabase(context), params.data.projectId);
    if ("error" in result) {
      getLogger(context).error("Dashboard API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        route: "GET /projects/:projectId/dashboard",
      });
    }
    return respond(context, result);
  });
};
