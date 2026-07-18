import type { Hono } from "hono";
import { failure, respond } from "@/backend/http/response";
import { getSupabase, type AppEnv } from "@/backend/hono/context";
import { ProjectScheduleInputSchema, ProjectScheduleItemParamsSchema, ProjectScheduleParamsSchema, ProjectScheduleViewSchema } from "./schema";
import { createProjectSchedule, deleteProjectSchedule, listProjectSchedules, updateProjectSchedule } from "./service";

const parseBody = async (request: { json: () => Promise<unknown> }) => request.json().catch(() => null);

export const registerProjectScheduleRoutes = (app: Hono<AppEnv>) => {
  const invalid = (context: Parameters<typeof respond>[0], code: string, details?: unknown) => respond(context, failure(400, code, "일정 요청을 확인해 주세요.", details));
  app.get("/projects/:projectId/schedules", async (context) => {
    const params = ProjectScheduleParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_SCHEDULE_PARAMS", params.error.flatten());
    const view = ProjectScheduleViewSchema.safeParse(context.req.query("view") ?? "upcoming");
    if (!view.success) return invalid(context, "INVALID_PROJECT_SCHEDULE_VIEW", view.error.flatten());
    return respond(context, await listProjectSchedules(getSupabase(context), params.data.projectId, view.data));
  });
  app.post("/projects/:projectId/schedules", async (context) => {
    const params = ProjectScheduleParamsSchema.safeParse({ projectId: context.req.param("projectId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_SCHEDULE_PARAMS", params.error.flatten());
    const body = ProjectScheduleInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) return invalid(context, "INVALID_PROJECT_SCHEDULE_BODY", body.error.flatten());
    return respond(context, await createProjectSchedule(getSupabase(context), params.data.projectId, body.data));
  });
  app.patch("/projects/:projectId/schedules/:scheduleId", async (context) => {
    const params = ProjectScheduleItemParamsSchema.safeParse({ projectId: context.req.param("projectId"), scheduleId: context.req.param("scheduleId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_SCHEDULE_PARAMS", params.error.flatten());
    const body = ProjectScheduleInputSchema.safeParse(await parseBody(context.req));
    if (!body.success) return invalid(context, "INVALID_PROJECT_SCHEDULE_BODY", body.error.flatten());
    return respond(context, await updateProjectSchedule(getSupabase(context), params.data.projectId, params.data.scheduleId, body.data));
  });
  app.delete("/projects/:projectId/schedules/:scheduleId", async (context) => {
    const params = ProjectScheduleItemParamsSchema.safeParse({ projectId: context.req.param("projectId"), scheduleId: context.req.param("scheduleId") });
    if (!params.success) return invalid(context, "INVALID_PROJECT_SCHEDULE_PARAMS", params.error.flatten());
    return respond(context, await deleteProjectSchedule(getSupabase(context), params.data.projectId, params.data.scheduleId));
  });
};
