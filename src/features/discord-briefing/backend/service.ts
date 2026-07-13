import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDiscordBriefingConfig } from "@/backend/config";
import { COMPANY_ACCOUNT_MANAGERS } from "@/features/company/backend/schema";
import type { Database } from "@/lib/supabase/types";

export type DiscordSupabaseClient = SupabaseClient<Database>;

export const DISCORD_MANAGER_NAMES = COMPANY_ACCOUNT_MANAGERS;
export type DiscordManagerName = (typeof COMPANY_ACCOUNT_MANAGERS)[number];

export const getSeoulWeek = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Seoul",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
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

export const claimScheduledDelivery = async (
  client: DiscordSupabaseClient,
  input: { accountManager: DiscordManagerName; companyId?: string; messageChunks: string[]; scopeKey: string; weekKey: string },
) => client.rpc("claim_discord_weekly_briefing_delivery", {
  p_account_manager: input.accountManager,
  p_company_id: input.companyId ?? null,
  p_message_chunks: input.messageChunks,
  p_scope_key: input.scopeKey,
  p_seoul_week_key: input.weekKey,
}).maybeSingle();

export const renewScheduledDeliveryLease = async (
  client: DiscordSupabaseClient,
  delivery: { claim_token: string; id: string },
) => client.rpc("renew_discord_weekly_briefing_delivery_lease", {
  p_claim_token: delivery.claim_token,
  p_delivery_id: delivery.id,
});

type ExpenseSnapshot = { id: string; stage_key: string; title: string; pre_approval_status: string | null; execution_progress_status: string | null; execution_request_status: string | null };
type ProjectSnapshot = { id: string; project_name: string; expenses: ExpenseSnapshot[] | null };
export type CompanySnapshot = { id: string; account_manager: DiscordManagerName; company_name: string; projects: ProjectSnapshot[] | null };

const stageLabel: Record<string, string> = {
  budget_registration: "\uC0AC\uC5C5\uBE44 \uB4F1\uB85D", pre_approval: "\uC0AC\uC804 \uC2B9\uC778", execution_in_progress: "\uC9D1\uD589 \uC911", execution_request: "\uC9D1\uD589 \uC694\uCCAD", execution_completed: "\uC9D1\uD589 \uC644\uB8CC",
};
const statusLabel = (expense: ExpenseSnapshot) => {
  const status = expense.stage_key === "pre_approval" ? expense.pre_approval_status : expense.stage_key === "execution_in_progress" ? expense.execution_progress_status : expense.stage_key === "execution_request" ? expense.execution_request_status : null;
  return escapeDiscord(status ?? "\uC138\uBD80 \uC0C1\uD0DC \uBBF8\uC785\uB825");
};
const escapeDiscord = (value: string) => value.replace(/([\\`*_~>|])/g, "\\$1").replace(/@/g, "@\u200b");
const truncate = (value: string, limit: number) => value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
const DISCORD_MESSAGE_LIMIT = 2_000;

const chunkProjectRows = (heading: string, rows: string[]) => {
  const chunks: string[] = [];
  let chunk = heading;
  for (const row of rows) {
    if (`${chunk}\n${row}`.length > DISCORD_MESSAGE_LIMIT && chunk !== heading) {
      chunks.push(chunk);
      chunk = `${heading}\n${row}`;
      continue;
    }
    chunk = `${chunk}\n${row}`;
  }
  return [...chunks, chunk];
};

export const getActiveBriefingSnapshot = async (client: DiscordSupabaseClient, date = new Date()) => {
  const seoulDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
  const { data, error } = await client.from("companies").select("id, account_manager, company_name, projects!inner(id, project_name, agreement_start_date, agreement_end_date, deleted_at, expenses(id, stage_key, title, pre_approval_status, execution_progress_status, execution_request_status, deleted_at))").is("deleted_at", null).is("projects.deleted_at", null).lte("projects.agreement_start_date", seoulDate).gte("projects.agreement_end_date", seoulDate).order("company_name").order("project_name", { referencedTable: "projects" }).order("title", { referencedTable: "projects.expenses" });
  if (error) throw new Error("Unable to load the weekly briefing snapshot.");
  return (data ?? []).map((company: any) => ({ ...company, projects: (company.projects ?? []).map((project: any) => ({ ...project, expenses: (project.expenses ?? []).filter((expense: any) => !expense.deleted_at) })) })) as CompanySnapshot[];
};

export const renderCompanyBriefing = (company: CompanySnapshot, appUrl: string, weekLabel: string, isTest = false) => {
  const projects = company.projects ?? [];
  const parent = [
    `\uD83D\uDCEE ${isTest ? "\uD83E\uDDEA \uD14C\uC2A4\uD2B8 " : ""}${weekLabel} \uC9C0\uCD9C \uC5C5\uBB34 \uBE0C\uB9AC\uD551`,
    `**${escapeDiscord(truncate(company.company_name, 300))}**`,
    `\uC9C4\uD589 \uC0AC\uC5C5 ${projects.length}\uAC74`,
  ].join("\n");
  const projectMessages = projects.map((project) => {
    const expenses = project.expenses ?? [];
    const pending = expenses.filter(({ stage_key }) => stage_key !== "execution_completed");
    const completed = expenses.length - pending.length;
    const heading = `**${escapeDiscord(truncate(project.project_name, 300))}** · \uC644\uB8CC ${completed}\uAC74`;
    const rows = pending.length ? pending.map((expense) => `- ${escapeDiscord(truncate(expense.title, 120))} · ${escapeDiscord(stageLabel[expense.stage_key] ?? expense.stage_key)} · ${statusLabel(expense)}\n  ${appUrl}/projects/${project.id}/expenses/${expense.id}`) : ["- \uC9C4\uD589 \uC911\uC778 \uC9C0\uCD9C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."];
    return chunkProjectRows(heading, rows);
  }).flat();
  return { parent, threadName: truncate(`${isTest ? "\uD83E\uDDEA \uD14C\uC2A4\uD2B8 " : ""}${company.company_name} ${weekLabel}`, 100), projectMessages };
};
