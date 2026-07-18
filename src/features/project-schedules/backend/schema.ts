import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isCalendarDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const dateSchema = z.string().refine(isCalendarDate, "날짜 형식이 올바르지 않습니다.");
const optionalMemo = z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().trim().max(2_000).nullable().optional().default(null));

export const ProjectScheduleParamsSchema = z.object({ projectId: z.string().uuid() });
export const ProjectScheduleItemParamsSchema = ProjectScheduleParamsSchema.extend({ scheduleId: z.string().uuid() });
export const ProjectScheduleViewSchema = z.enum(["upcoming", "past", "this-week"]);
export const ProjectScheduleInputSchema = z.object({
  memo: optionalMemo,
  scheduledOn: dateSchema,
  title: z.string().trim().min(1).max(200),
}).strict();

export const ProjectScheduleSchema = z.object({
  createdAt: z.string(),
  id: z.string().uuid(),
  memo: z.string().nullable(),
  projectId: z.string().uuid(),
  scheduledOn: dateSchema,
  title: z.string(),
  updatedAt: z.string(),
});
export const ProjectScheduleListSchema = z.array(ProjectScheduleSchema);

export type ProjectScheduleInput = z.infer<typeof ProjectScheduleInputSchema>;
export type ProjectScheduleView = z.infer<typeof ProjectScheduleViewSchema>;
export type ProjectSchedule = z.infer<typeof ProjectScheduleSchema>;
