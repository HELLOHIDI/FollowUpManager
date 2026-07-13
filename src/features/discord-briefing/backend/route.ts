import { createMutationClient } from "@/backend/supabase/client";
import { getDiscordBriefingConfig } from "@/backend/config";
import type { Hono } from "hono";
import { failure, respond, success } from "@/backend/http/response";
import { getSupabase, type AppEnv } from "@/backend/hono/context";
import { claimScheduledDelivery, DISCORD_MANAGER_NAMES, getActiveBriefingSnapshot, getSeoulWeek, isValidCronSecret, renderCompanyBriefing, renewScheduledDeliveryLease, type CompanySnapshot, type DiscordManagerName, type DiscordSupabaseClient } from "./service";

class DiscordAmbiguousDeliveryError extends Error {}

type DiscordMessage = { id: string };
type DiscordChannel = { permissions?: string; type: number };
type ScheduledDelivery = { claim_token: string; id: string; message_chunks: string[]; parent_message_id: string | null; sent_message_count: number; thread_id: string | null };

const discordRequest = async <T>(path: string, init: RequestInit): Promise<T> => {
  const config = getDiscordBriefingConfig();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try { response = await fetch(`https://discord.com/api/v10${path}`, { ...init, headers: { Authorization: `Bot ${config.botToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: controller.signal }); }
    catch { throw new DiscordAmbiguousDeliveryError("Discord request response was not received."); }
    finally { clearTimeout(timeout); }
    if (response.ok) {
      if (response.status === 204) return null as T;
      try { return await response.json() as T; }
      catch { throw new DiscordAmbiguousDeliveryError("Discord accepted the request but its response could not be read."); }
    }
    if (attempt === 2) {
      if (response.status >= 500) throw new DiscordAmbiguousDeliveryError(`Discord request failed after retries (${response.status}).`);
      throw new Error(`Discord request failed (${response.status}).`);
    }
    if (response.status !== 429 && response.status < 500) throw new Error(`Discord request failed (${response.status}).`);
    const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
    await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(retryAfter, 0), 5) * 1_000));
  }
  throw new Error("Discord retry loop exited unexpectedly.");
};

const sendCompany = async (channelId: string, company: CompanySnapshot, test: boolean) => {
  const config = getDiscordBriefingConfig();
  const template = renderCompanyBriefing(company, config.appUrl, getSeoulWeek().label, test);
  const parent = await discordRequest<DiscordMessage>(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify({ content: template.parent, allowed_mentions: { parse: [] } }) });
  const thread = await discordRequest<DiscordMessage>(`/channels/${channelId}/messages/${parent.id}/threads`, { method: "POST", body: JSON.stringify({ name: template.threadName, auto_archive_duration: 10080 }) });
  for (const content of template.projectMessages) await discordRequest(`/channels/${thread.id}/messages`, { method: "POST", body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) });
};

const ensureDeliveryLease = async (client: DiscordSupabaseClient, delivery: Pick<ScheduledDelivery, "claim_token" | "id">) => {
  const { data, error } = await renewScheduledDeliveryLease(client, delivery);
  if (error || !data) throw new Error("Discord delivery lease is no longer owned by this worker.");
};

const updateOwnedDelivery = async (client: DiscordSupabaseClient, delivery: Pick<ScheduledDelivery, "claim_token" | "id">, update: Record<string, unknown>) => {
  const { data, error } = await client.from("discord_weekly_briefing_deliveries").update(update).eq("id", delivery.id).eq("claim_token", delivery.claim_token).select("id").maybeSingle();
  if (error || !data) throw new DiscordAmbiguousDeliveryError("Discord delivery state could not be safely persisted.");
};

const beginExternalRequest = async (client: DiscordSupabaseClient, delivery: ScheduledDelivery, step: string) => {
  await ensureDeliveryLease(client, delivery);
  await updateOwnedDelivery(client, delivery, { external_request_started_at: new Date().toISOString(), external_request_step: step });
};

const resumeScheduledCompany = async (client: DiscordSupabaseClient, delivery: ScheduledDelivery, channelId: string, company: CompanySnapshot) => {
  const template = renderCompanyBriefing(company, getDiscordBriefingConfig().appUrl, getSeoulWeek().label);
  let parentId = delivery.parent_message_id;
  if (!parentId) {
    await beginExternalRequest(client, delivery, "parent");
    const parent = await discordRequest<DiscordMessage>(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify({ content: template.parent, allowed_mentions: { parse: [] } }) });
    parentId = parent.id;
    await updateOwnedDelivery(client, delivery, { parent_message_id: parentId, external_request_started_at: null, external_request_step: null });
  }
  let threadId = delivery.thread_id;
  if (!threadId) {
    await beginExternalRequest(client, delivery, "thread");
    const thread = await discordRequest<DiscordMessage>(`/channels/${channelId}/messages/${parentId}/threads`, { method: "POST", body: JSON.stringify({ name: template.threadName, auto_archive_duration: 10080 }) });
    threadId = thread.id;
    await updateOwnedDelivery(client, delivery, { thread_id: threadId, external_request_started_at: null, external_request_step: null });
  }
  for (let index = delivery.sent_message_count; index < delivery.message_chunks.length; index += 1) {
    await beginExternalRequest(client, delivery, `project-message-${index + 1}`);
    await discordRequest(`/channels/${threadId}/messages`, { method: "POST", body: JSON.stringify({ content: delivery.message_chunks[index], allowed_mentions: { parse: [] } }) });
    await updateOwnedDelivery(client, delivery, { sent_message_count: index + 1, external_request_started_at: null, external_request_step: null });
  }
  await updateOwnedDelivery(client, delivery, { status: "completed", completed_at: new Date().toISOString() });
};

const sendEmptyState = (channelId: string, test: boolean) => discordRequest(`/channels/${channelId}/messages`, {
  method: "POST",
  body: JSON.stringify({ content: `\uD83D\uDCEE ${test ? "\uD83E\uDDEA \uD14C\uC2A4\uD2B8 " : ""}${getSeoulWeek().label} \uC9C0\uCD9C \uC5C5\uBB34 \uBE0C\uB9AC\uD551\n\uC9C4\uD589 \uC911\uC778 \uC0AC\uC5C5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.`, allowed_mentions: { parse: [] } }),
});

const getChannels = (client: DiscordSupabaseClient) => client.from("discord_manager_channels").select("account_manager, discord_channel_id");

const REQUIRED_CHANNEL_PERMISSIONS = [1_024, 2_048, 34_359_738_368, 274_877_906_944];
const hasRequiredChannelPermissions = (channel: DiscordChannel) => {
  if (!channel.permissions) return false;
  const permissions = Number(channel.permissions);
  return Number.isSafeInteger(permissions) && REQUIRED_CHANNEL_PERMISSIONS.every((permission) => Math.floor(permissions / permission) % 2 === 1);
};

const recordTestDelivery = async (accountManager: DiscordManagerName, status: "completed" | "failed", errorMessage?: string) => {
  const { error } = await createMutationClient().from("discord_briefing_test_deliveries").insert({ account_manager: accountManager, error_message: errorMessage ?? null, status });
  if (error) throw new Error("Discord test delivery history could not be recorded.");
};

export const discordBriefingTestables = { discordRequest, hasRequiredChannelPermissions };

export const registerDiscordBriefingRoutes = (app: Hono<AppEnv>) => {
  app.get("/discord/channels", async (context) => {
    const { data, error } = await getChannels(getSupabase(context));
    return respond(context, error ? failure(500, "DISCORD_CHANNEL_FETCH_ERROR", "Unable to load Discord channels.") : success(data ?? []));
  });

  app.get("/discord/deliveries", async (context) => {
    const { data, error } = await getSupabase(context).from("discord_weekly_briefing_deliveries").select("seoul_week_key, account_manager, scope_key, status, external_request_step, last_error, updated_at").order("updated_at", { ascending: false }).limit(100);
    return respond(context, error ? failure(500, "DISCORD_DELIVERY_FETCH_ERROR", "Unable to load Discord delivery history.") : success(data ?? []));
  });

  app.put("/discord/channels/:accountManager", async (context) => {
    const accountManager = decodeURIComponent(context.req.param("accountManager")) as DiscordManagerName;
    const body = await context.req.json().catch(() => null) as { channelId?: unknown } | null;
    if (!DISCORD_MANAGER_NAMES.includes(accountManager)) return respond(context, failure(400, "INVALID_DISCORD_MANAGER", "A registered manager is required."));
    if (!body || typeof body.channelId !== "string" || !/^\d{17,20}$/.test(body.channelId)) return respond(context, failure(400, "INVALID_DISCORD_CHANNEL", "A Discord text channel ID is required."));
    try {
      const channel = await discordRequest<DiscordChannel>(`/channels/${body.channelId}`, { method: "GET" });
      if (channel.type !== 0 || !hasRequiredChannelPermissions(channel)) return respond(context, failure(400, "INVALID_DISCORD_CHANNEL", "The bot needs text-channel, thread-creation, and thread-message permissions."));
      const { error } = await getSupabase(context).from("discord_manager_channels").upsert({ account_manager: accountManager, discord_channel_id: body.channelId });
      return respond(context, error ? failure(500, "DISCORD_CHANNEL_WRITE_ERROR", "Unable to save the Discord channel.") : success({ accountManager, channelId: body.channelId }));
    } catch { return respond(context, failure(400, "DISCORD_CHANNEL_UNAVAILABLE", "The bot cannot access this channel.")); }
  });

  app.post("/discord/test", async (context) => {
    const body = await context.req.json().catch(() => null) as { accountManager?: unknown } | null;
    if (!body || typeof body.accountManager !== "string") return respond(context, failure(400, "INVALID_DISCORD_MANAGER", "A manager is required."));
    if (!DISCORD_MANAGER_NAMES.includes(body.accountManager as DiscordManagerName)) return respond(context, failure(400, "INVALID_DISCORD_MANAGER", "A registered manager is required."));
    const client = getSupabase(context);
    const { data: mapping } = await client.from("discord_manager_channels").select("discord_channel_id").eq("account_manager", body.accountManager).maybeSingle();
    if (!mapping) return respond(context, failure(400, "DISCORD_CHANNEL_NOT_CONFIGURED", "Configure the manager channel first."));
    try {
      const channel = await discordRequest<DiscordChannel>(`/channels/${mapping.discord_channel_id}`, { method: "GET" });
      if (channel.type !== 0 || !hasRequiredChannelPermissions(channel)) return respond(context, failure(400, "INVALID_DISCORD_CHANNEL", "The bot needs text-channel, thread-creation, and thread-message permissions."));
      const companies = (await getActiveBriefingSnapshot(client)).filter((item) => item.account_manager === body.accountManager);
      if (!companies.length) await sendEmptyState(mapping.discord_channel_id, true);
      for (const company of companies) await sendCompany(mapping.discord_channel_id, company, true);
      await recordTestDelivery(body.accountManager as DiscordManagerName, "completed");
      return respond(context, success({ delivered: true }));
    }
    catch {
      try { await recordTestDelivery(body.accountManager as DiscordManagerName, "failed", "Discord test delivery failed."); }
      catch { return respond(context, failure(500, "DISCORD_TEST_HISTORY_ERROR", "The Discord test result could not be recorded.")); }
      return respond(context, failure(502, "DISCORD_TEST_FAILED", "The Discord test delivery failed."));
    }
  });

  app.get("/discord/weekly-briefing", async (context) => {
    if (!isValidCronSecret(context.req.header("Authorization")?.replace(/^Bearer\s+/i, ""))) return respond(context, failure(401, "INVALID_CRON_SECRET", "Unauthorized."));
    const client = createMutationClient();
    const { data: mappings, error: mappingsError } = await getChannels(client);
    if (mappingsError) return respond(context, failure(500, "DISCORD_CHANNEL_FETCH_ERROR", "Unable to load Discord channels."));
    const companies = await getActiveBriefingSnapshot(client);
    const failures: string[] = [];
    let delivered = 0;
    const configuredManagers = new Set((mappings ?? []).map(({ account_manager }) => account_manager));
    for (const company of companies) if (!configuredManagers.has(company.account_manager)) failures.push(`${company.account_manager}:${company.id}:channel-not-configured`);
    for (const mapping of mappings ?? []) {
      const managedCompanies = companies.filter((item) => item.account_manager === mapping.account_manager);
      if (!managedCompanies.length) {
        let delivery: ScheduledDelivery | null = null;
        try {
          const claim = await claimScheduledDelivery(client, { accountManager: mapping.account_manager as DiscordManagerName, messageChunks: [], scopeKey: "manager-empty", weekKey: getSeoulWeek().key });
          if (claim.error) throw new Error("Unable to claim the empty-state delivery.");
          delivery = claim.data as ScheduledDelivery | null;
          if (delivery) {
          await beginExternalRequest(client, delivery, "empty-state");
          await sendEmptyState(mapping.discord_channel_id, false);
          await updateOwnedDelivery(client, delivery, { status: "completed", completed_at: new Date().toISOString(), external_request_started_at: null, external_request_step: null });
          delivered += 1;
          }
        }
        catch (error) {
          if (delivery) {
            const status = error instanceof DiscordAmbiguousDeliveryError ? "needs_review" : "failed";
            try { await updateOwnedDelivery(client, delivery, { status, last_error: error instanceof Error ? error.message : "Discord empty-state delivery failed.", ...(status === "failed" ? { external_request_started_at: null, external_request_step: null } : {}) }); }
            catch { /* A lost lease must not overwrite the new owner. */ }
          }
          failures.push(`${mapping.account_manager}:manager-empty`);
        }
        continue;
      }
      for (const company of managedCompanies) {
        let delivery: ScheduledDelivery | null = null;
        try {
          const template = renderCompanyBriefing(company, getDiscordBriefingConfig().appUrl, getSeoulWeek().label);
          const input = { accountManager: mapping.account_manager as DiscordManagerName, companyId: company.id, messageChunks: template.projectMessages, scopeKey: `company:${company.id}`, weekKey: getSeoulWeek().key };
          const claim = await claimScheduledDelivery(client, input);
          if (claim.error) throw new Error("Unable to claim the company delivery.");
          delivery = claim.data as ScheduledDelivery | null;
          if (!delivery) continue;
          await resumeScheduledCompany(client, delivery, mapping.discord_channel_id, company);
          delivered += 1;
        } catch (error) {
          if (delivery) {
            const status = error instanceof DiscordAmbiguousDeliveryError ? "needs_review" : "failed";
            try { await updateOwnedDelivery(client, delivery, { status, last_error: error instanceof Error ? error.message : "Discord delivery failed.", ...(status === "failed" ? { external_request_started_at: null, external_request_step: null } : {}) }); }
            catch { /* A lost lease must not overwrite the new owner. */ }
          }
          failures.push(`${mapping.account_manager}:${company.id}`);
        }
      }
    }
    return context.json({ delivered, failures });
  });
};
