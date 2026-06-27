import type { Hono } from "hono";
import { failure, respond } from "@/backend/http/response";
import { getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import { projectExportErrorCodes } from "./error";
import { ProjectExportParamsSchema, ProjectExportQuerySchema } from "./schema";
import { getProjectExport } from "./service";

export const registerProjectExportRoutes = (app: Hono<AppEnv>) => {
  app.get("/projects/:projectId/export", async (context) => {
    const params = ProjectExportParamsSchema.safeParse({
      projectId: context.req.param("projectId"),
    });
    if (!params.success) {
      return respond(context, failure(400, projectExportErrorCodes.invalidParams, "프로젝트 ID를 확인해 주세요."));
    }

    const query = ProjectExportQuerySchema.safeParse({
      category: context.req.query("category"),
      from: context.req.query("from"),
      stage: context.req.query("stage"),
      to: context.req.query("to"),
    });
    if (!query.success) {
      return respond(context, failure(400, projectExportErrorCodes.invalidQuery, "내보내기 필터를 확인해 주세요.", query.error.flatten()));
    }

    const result = await getProjectExport(getSupabase(context), params.data.projectId, query.data);
    if ("error" in result) {
      getLogger(context).error("Project export API request failed", {
        code: result.error.code,
        projectId: params.data.projectId,
        route: "GET /projects/:projectId/export",
      });
    }

    return respond(context, result);
  });
};
