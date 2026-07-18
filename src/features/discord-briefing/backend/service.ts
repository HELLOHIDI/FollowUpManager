import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDiscordBriefingConfig } from "@/backend/config";
import { COMPANY_ACCOUNT_MANAGERS } from "@/features/company/backend/schema";
import { getSeoulScheduleRange } from "@/features/project-schedules/backend/service";
import type { Database } from "@/lib/supabase/types";

export type DiscordSupabaseClient = SupabaseClient<Database>;
export const DISCORD_MANAGER_NAMES = COMPANY_ACCOUNT_MANAGERS;
export type DiscordManagerName = (typeof COMPANY_ACCOUNT_MANAGERS)[number];
export { getSeoulScheduleRange } from "@/features/project-schedules/backend/service";

export const getSeoulWeek = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Seoul" })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  const day = Number(parts.day);
  const week = Math.ceil(day / 7);
  return { key: `${parts.year}-${parts.month}-${week}`, label: `${Number(parts.month)}\uC6D4 ${week}\uC8FC\uCC28` };
};

export const isValidCronSecret = (provided: string | undefined) => {
  if (!provided) return false;
  const expected = Buffer.from(getDiscordBriefingConfig().cronSecret);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export const claimScheduledDelivery = async (client: DiscordSupabaseClient, input: { accountManager: DiscordManagerName; companyId?: string; messageChunks: string[]; scopeKey: string; weekKey: string }) =>
  client.rpc("claim_discord_weekly_briefing_delivery", { p_account_manager: input.accountManager, p_company_id: input.companyId ?? null, p_message_chunks: input.messageChunks, p_scope_key: input.scopeKey, p_seoul_week_key: input.weekKey }).maybeSingle();

export const renewScheduledDeliveryLease = async (client: DiscordSupabaseClient, delivery: { claim_token: string; id: string }) =>
  client.rpc("renew_discord_weekly_briefing_delivery_lease", { p_claim_token: delivery.claim_token, p_delivery_id: delivery.id });

export type ScheduleReminderCandidate = {
  accountManager: DiscordManagerName;
  companyId: string;
  companyName: string;
  projectId: string;
  projectName: string;
  scheduleId: string;
  scheduledOn: string;
  title: string;
  memo: string | null;
};

export const getDueScheduleReminderCandidates = async (client: DiscordSupabaseClient, date = new Date()): Promise<ScheduleReminderCandidate[]> => {
  const range = getSeoulScheduleRange(date);
  const { data, error } = await (client.from("project_schedules") as any)
    .select("id, title, scheduled_on, memo, project:projects!inner(id, project_name, deleted_at, company:companies!inner(id, company_name, account_manager, deleted_at))")
    .gte("scheduled_on", range.today)
    .lte("scheduled_on", new Date(`${range.today}T00:00:00Z`).toISOString().slice(0, 10) === range.today ? new Date(new Date(`${range.today}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10) : range.today)
    .is("project.deleted_at", null)
    .is("project.company.deleted_at", null)
    .order("scheduled_on")
    .order("id");
  if (error) throw new Error("Unable to load due schedule reminders.");
  return (data ?? []).flatMap((schedule: any) => {
    const project = schedule.project;
    const company = project?.company;
    if (!project || !company?.account_manager) return [];
    return [{ accountManager: company.account_manager as DiscordManagerName, companyId: company.id, companyName: company.company_name, memo: schedule.memo, projectId: project.id, projectName: project.project_name, scheduleId: schedule.id, scheduledOn: schedule.scheduled_on, title: schedule.title }];
  });
};

export const claimScheduleReminderDelivery = async (client: DiscordSupabaseClient, input: { candidate: ScheduleReminderCandidate; eventDate: string; kind: "d_day" | "d_minus_1"; message: string }) =>
  client.rpc("claim_discord_schedule_reminder_delivery", {
    p_account_manager: input.candidate.accountManager,
    p_company_id: input.candidate.companyId,
    p_event_date: input.eventDate,
    p_message_content: input.message,
    p_notification_kind: input.kind,
    p_project_id: input.candidate.projectId,
    p_schedule_id: input.candidate.scheduleId,
  }).maybeSingle();

export const renewScheduleReminderLease = async (client: DiscordSupabaseClient, delivery: { claim_token: string; id: string }) =>
  client.rpc("renew_discord_schedule_reminder_delivery_lease", { p_claim_token: delivery.claim_token, p_delivery_id: delivery.id });

type ExpenseSnapshot = { id: string; stage_key: string; stage_fields?: unknown; title: string };
type ScheduleSnapshot = { id: string; memo: string | null; scheduled_on: string; title: string };
type ProjectSnapshot = { id: string; project_name: string; expenses: ExpenseSnapshot[] | null; schedules?: ScheduleSnapshot[] | null };
export type CompanySnapshot = { id: string; account_manager: DiscordManagerName; company_name: string; projects: ProjectSnapshot[] | null };

const stageLabel: Record<string, string> = { budget_registration: "\uC0AC\uC5C5\uBE44 \uB4F1\uB85D", pre_approval: "\uC0AC\uC804 \uC2B9\uC778", execution_in_progress: "\uC9D1\uD589 \uC911", execution_request: "\uC9D1\uD589 \uC694\uCCAD", execution_completed: "\uC9D1\uD589 \uC644\uB8CC" };
const escapeDiscord = (value: string) => value.replace(/([\\`*_~>|])/g, "\\$1").replace(/@/g, "@\u200b");
const truncate = (value: string, limit: number) => value.length <= limit ? value : `${value.slice(0, limit - 1)}\u2026`;
const DISCORD_MESSAGE_LIMIT = 2_000;
const checklistProgress = [{ key: "prepared", label: "\uC0AC\uC804\uC900\uBE44" }, { key: "managerConfirmed", label: "\uB2F4\uB2F9\uC790 \uD655\uC778" }, { key: "pmsRegistered", label: "PMS \uB4F1\uB85D" }, { key: "finalApproved", label: "\uCD5C\uC885 \uC2B9\uC778" }] as const;
const defaultChecklistProgress = checklistProgress[0];

const detailProgress = (expense: ExpenseSnapshot) => {
  const stageFields = expense.stage_fields;
  if (!stageFields || typeof stageFields !== "object" || Array.isArray(stageFields)) return defaultChecklistProgress;
  const checklists = (stageFields as Record<string, unknown>).stage_checklists;
  if (!checklists || typeof checklists !== "object" || Array.isArray(checklists)) return defaultChecklistProgress;
  const checklist = (checklists as Record<string, unknown>)[expense.stage_key];
  if (!checklist || typeof checklist !== "object" || Array.isArray(checklist)) return defaultChecklistProgress;
  const progress = (checklist as Record<string, unknown>).progress;
  return checklistProgress.find((item) => item.key === progress) ?? defaultChecklistProgress;
};

const chunkProjectRows = (heading: string, rows: string[]) => {
  const chunks: string[] = [];
  let chunk = heading;
  for (const row of rows) {
    if (`${chunk}\n${row}`.length > DISCORD_MESSAGE_LIMIT && chunk !== heading) { chunks.push(chunk); chunk = `${heading}\n${row}`; continue; }
    chunk = `${chunk}\n${row}`;
  }
  return [...chunks, chunk];
};

export const getActiveBriefingSnapshot = async (client: DiscordSupabaseClient, date = new Date()) => {
  const seoulDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
  const range = getSeoulScheduleRange(date);
  const { data, error } = await (client.from("companies") as any)
    .select("id, account_manager, company_name, projects!inner(id, project_name, agreement_start_date, agreement_end_date, deleted_at, expenses(id, stage_key, stage_fields, title, deleted_at), project_schedules(id, title, scheduled_on, memo))")
    .is("deleted_at", null).is("projects.deleted_at", null).lte("projects.agreement_start_date", seoulDate).gte("projects.agreement_end_date", seoulDate)
    .order("company_name").order("project_name", { referencedTable: "projects" }).order("title", { referencedTable: "projects.expenses" }).order("scheduled_on", { referencedTable: "projects.project_schedules" });
  if (error) throw new Error("Unable to load the weekly briefing snapshot.");
  return (data ?? []).map((company: any) => ({
    ...company,
    projects: (company.projects ?? []).map((project: any) => ({
      ...project,
      expenses: (project.expenses ?? []).filter((expense: any) => !expense.deleted_at),
      schedules: (project.project_schedules ?? []).filter((schedule: ScheduleSnapshot) => schedule.scheduled_on >= range.weekStart && schedule.scheduled_on <= range.weekEnd),
    })),
  })) as CompanySnapshot[];
};

export const renderScheduleReminder = (candidate: ScheduleReminderCandidate, kind: "d_day" | "d_minus_1", appUrl: string) => [
  `\uD83D\uDCC5 ${kind === "d_minus_1" ? "\uB0B4\uC77C" : "\uC624\uB298"} \uC77C\uC815 \uC54C\uB9BC`,
  `**${escapeDiscord(truncate(candidate.companyName, 300))}** \u00B7 ${escapeDiscord(truncate(candidate.projectName, 300))}`,
  `- ${candidate.scheduledOn} \u00B7 ${escapeDiscord(truncate(candidate.title, 160))}`,
  candidate.memo ? `  ${escapeDiscord(truncate(candidate.memo, 500))}` : null,
  `${appUrl}/projects/${candidate.projectId}/schedules`,
].filter(Boolean).join("\n");

export const renderCompanyBriefing = (company: CompanySnapshot, appUrl: string, weekLabel: string, isTest = false) => {
  const projects = company.projects ?? [];
  const parent = [`\uD83D\uDCEE ${isTest ? "\uD83E\uDDEA \uD14C\uC2A4\uD2B8 " : ""}${weekLabel} \uC9C0\uCD9C \uC5C5\uBB34 \uBE0C\uB9AC\uD551`, `**${escapeDiscord(truncate(company.company_name, 300))}**`, `\uC9C4\uD589 \uC0AC\uC5C5 ${projects.length}\uAC74`].join("\n");
  const projectMessages = projects.map((project) => {
    const expenses = project.expenses ?? [];
    const pending = expenses.filter(({ stage_key }) => stage_key !== "execution_completed");
    const completed = expenses.length - pending.length;
    const heading = `**${escapeDiscord(truncate(project.project_name, 300))}** \u00B7 \uC644\uB8CC ${completed}\uAC74\n${appUrl}/projects/${project.id}`;
    const rows = pending.length ? pending.map((expense) => `- ${escapeDiscord(truncate(expense.title, 120))} \u00B7 ${escapeDiscord(stageLabel[expense.stage_key] ?? expense.stage_key)} \u00B7 ${detailProgress(expense).label}`) : ["- \uC9C4\uD589 \uC911\uC778 \uC9C0\uCD9C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."];
    const schedules = project.schedules ?? [];
    const scheduleRows = schedules.length ? ["", "\uD83D\uDCC5 \uC774\uBC88 \uC8FC \uC8FC\uC694 \uC77C\uC815", ...schedules.map((schedule) => [`- ${schedule.scheduled_on} \u00B7 ${escapeDiscord(truncate(schedule.title, 160))}`, schedule.memo ? `  ${escapeDiscord(truncate(schedule.memo, 300))}` : null].filter(Boolean).join("\n"))] : [];
    return chunkProjectRows(heading, [...rows, ...scheduleRows]);
  }).flat();
  return { parent, threadName: truncate(`${isTest ? "\uD83E\uDDEA \uD14C\uC2A4\uD2B8 " : ""}${company.company_name} ${weekLabel}`, 100), projectMessages };
};
