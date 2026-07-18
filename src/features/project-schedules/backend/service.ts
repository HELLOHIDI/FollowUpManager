import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import type { Database } from "@/lib/supabase/types";
import type { ProjectSchedule, ProjectScheduleInput, ProjectScheduleView } from "./schema";

type Client = SupabaseClient<Database>;
type Result<T> = HandlerResult<T, "PROJECT_SCHEDULE_NOT_FOUND" | "PROJECT_SCHEDULE_FETCH_ERROR" | "PROJECT_SCHEDULE_WRITE_ERROR">;
const SELECT = "id, project_id, title, scheduled_on, memo, created_at, updated_at";

const formatSeoulDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const shiftDate = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

export const getSeoulScheduleRange = (date = new Date()) => {
  const today = formatSeoulDate(date);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = shiftDate(today, mondayOffset);
  return { today, weekEnd: shiftDate(start, 6), weekStart: start };
};

const map = (row: Database["public"]["Tables"]["project_schedules"]["Row"]): ProjectSchedule => ({
  createdAt: row.created_at, id: row.id, memo: row.memo, projectId: row.project_id, scheduledOn: row.scheduled_on, title: row.title, updatedAt: row.updated_at,
});

const isActiveProject = async (client: Client, projectId: string) => {
  const { data, error } = await client.from("projects").select("id").eq("id", projectId).is("deleted_at", null).maybeSingle();
  return { active: Boolean(data), error };
};

export const listProjectSchedules = async (client: Client, projectId: string, view: ProjectScheduleView): Promise<Result<ProjectSchedule[]>> => {
  const project = await isActiveProject(client, projectId);
  if (project.error) return failure(500, "PROJECT_SCHEDULE_FETCH_ERROR", "일정을 불러오기 전에 프로젝트를 확인하지 못했습니다.");
  if (!project.active) return failure(404, "PROJECT_SCHEDULE_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  const range = getSeoulScheduleRange();
  let query = client.from("project_schedules").select(SELECT).eq("project_id", projectId);
  if (view === "upcoming") query = query.gte("scheduled_on", range.today).order("scheduled_on").order("id");
  if (view === "past") query = query.lt("scheduled_on", range.today).order("scheduled_on", { ascending: false }).order("id", { ascending: false });
  if (view === "this-week") query = query.gte("scheduled_on", range.weekStart).lte("scheduled_on", range.weekEnd).order("scheduled_on").order("id");
  const { data, error } = await query;
  if (error) return failure(500, "PROJECT_SCHEDULE_FETCH_ERROR", "일정을 불러오지 못했습니다.");
  return success((data ?? []).map(map));
};

export const createProjectSchedule = async (client: Client, projectId: string, input: ProjectScheduleInput): Promise<Result<ProjectSchedule>> => {
  const project = await isActiveProject(client, projectId);
  if (project.error) return failure(500, "PROJECT_SCHEDULE_FETCH_ERROR", "프로젝트를 확인하지 못했습니다.");
  if (!project.active) return failure(404, "PROJECT_SCHEDULE_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  const { data, error } = await client.from("project_schedules").insert({ project_id: projectId, title: input.title, scheduled_on: input.scheduledOn, memo: input.memo }).select(SELECT).single();
  return error ? failure(500, "PROJECT_SCHEDULE_WRITE_ERROR", "일정을 저장하지 못했습니다.") : success(map(data), 201);
};

export const updateProjectSchedule = async (client: Client, projectId: string, scheduleId: string, input: ProjectScheduleInput): Promise<Result<ProjectSchedule>> => {
  const project = await isActiveProject(client, projectId);
  if (project.error) return failure(500, "PROJECT_SCHEDULE_FETCH_ERROR", "프로젝트를 확인하지 못했습니다.");
  if (!project.active) return failure(404, "PROJECT_SCHEDULE_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  const { data, error } = await client.from("project_schedules").update({ title: input.title, scheduled_on: input.scheduledOn, memo: input.memo }).eq("id", scheduleId).eq("project_id", projectId).select(SELECT).maybeSingle();
  if (error) return failure(500, "PROJECT_SCHEDULE_WRITE_ERROR", "일정을 수정하지 못했습니다.");
  return data ? success(map(data)) : failure(404, "PROJECT_SCHEDULE_NOT_FOUND", "일정을 찾을 수 없습니다.");
};

export const deleteProjectSchedule = async (client: Client, projectId: string, scheduleId: string): Promise<Result<{ id: string }>> => {
  const project = await isActiveProject(client, projectId);
  if (project.error) return failure(500, "PROJECT_SCHEDULE_FETCH_ERROR", "프로젝트를 확인하지 못했습니다.");
  if (!project.active) return failure(404, "PROJECT_SCHEDULE_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  const { data, error } = await client.from("project_schedules").delete().eq("id", scheduleId).eq("project_id", projectId).select("id").maybeSingle();
  if (error) return failure(500, "PROJECT_SCHEDULE_WRITE_ERROR", "일정을 삭제하지 못했습니다.");
  return data ? success(data) : failure(404, "PROJECT_SCHEDULE_NOT_FOUND", "일정을 찾을 수 없습니다.");
};
