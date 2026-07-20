import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const lifecycle = vi.hoisted(() => ({
  claim: vi.fn(),
  createMutationClient: vi.fn(),
  getSnapshot: vi.fn(),
  getDueReminders: vi.fn(),
  renew: vi.fn(),
  renewReminder: vi.fn(),
  render: vi.fn(),
  renderReminder: vi.fn(),
  claimReminder: vi.fn(),
}));

vi.mock("@/backend/config", () => ({ getDiscordBriefingConfig: () => ({ appUrl: "https://app.example.com", botToken: "token", cronSecret: "secret" }) }));
vi.mock("@/backend/supabase/client", () => ({ createMutationClient: lifecycle.createMutationClient }));
vi.mock("./service", () => ({
  DISCORD_MANAGER_NAMES: ["manager"],
  claimScheduleReminderDelivery: lifecycle.claimReminder,
  claimScheduledDelivery: lifecycle.claim,
  getActiveBriefingSnapshot: lifecycle.getSnapshot,
  getDueScheduleReminderCandidates: lifecycle.getDueReminders,
  getSeoulScheduleRange: () => ({ today: "2026-07-20", weekEnd: "2026-07-26", weekStart: "2026-07-20" }),
  getSeoulWeek: () => ({ key: "2026-7-2", label: "7\uC6D4 2\uC8FC\uCC28" }),
  isValidCronSecret: (value: string | undefined) => value === "secret",
  renewScheduledDeliveryLease: lifecycle.renew,
  renewScheduleReminderLease: lifecycle.renewReminder,
  renderCompanyBriefing: lifecycle.render,
  renderScheduleReminder: lifecycle.renderReminder,
}));

import { discordBriefingTestables, registerDiscordBriefingRoutes } from "./route";

const channelPermissions = String(1_024 + 2_048 + 34_359_738_368 + 274_877_906_944);
const company = { account_manager: "manager", company_name: "Company", id: "company-1", projects: [] };
const delivery = { claim_token: "claim", id: "delivery-1", message_chunks: ["chunk"], parent_message_id: null, sent_message_count: 0, thread_id: null };

const ownedDeliveryClient = (updates: Record<string, unknown>[]) => ({
  from: vi.fn((table: string) => {
    if (table === "discord_manager_channels") return { select: vi.fn().mockResolvedValue({ data: [{ account_manager: "manager", discord_channel_id: "channel" }], error: null }) };
    return {
      update: vi.fn((update: Record<string, unknown>) => {
        updates.push(update);
        return { eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "delivery-1" }, error: null }) })) })) })) };
      }),
    };
  }),
});

describe("Discord API boundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lifecycle.claim.mockReset();
    lifecycle.createMutationClient.mockReset();
    lifecycle.getSnapshot.mockReset();
    lifecycle.getDueReminders.mockReset();
    lifecycle.renew.mockReset();
    lifecycle.renewReminder.mockReset();
    lifecycle.render.mockReset();
    lifecycle.renderReminder.mockReset();
    lifecycle.claimReminder.mockReset();
    lifecycle.render.mockReturnValue({ parent: "parent", projectMessages: ["chunk"], threadName: "thread" });
    lifecycle.renderReminder.mockReturnValue("reminder");
    lifecycle.renew.mockResolvedValue({ data: true, error: null });
    lifecycle.renewReminder.mockResolvedValue({ data: true, error: null });
  });

  it("requires view, send, and thread permissions", () => {
    expect(discordBriefingTestables.hasRequiredChannelPermissions({ type: 0, permissions: channelPermissions })).toBe(true);
    expect(discordBriefingTestables.hasRequiredChannelPermissions({ type: 0, permissions: "2048" })).toBe(false);
  });


  it("retries a rate limit", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(Response.json({ id: "message" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(discordBriefingTestables.discordRequest<{ id: string }>("/channels/1/messages", { method: "POST", body: "{}" })).resolves.toEqual({ id: "message" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("treats an unreadable successful response as ambiguous", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    await expect(discordBriefingTestables.discordRequest("/channels/1/messages", { method: "POST" })).rejects.toThrow("accepted the request");
    vi.unstubAllGlobals();
  });

  it("treats exhausted 5xx responses as ambiguous", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503, headers: { "Retry-After": "0" } })));
    await expect(discordBriefingTestables.discordRequest("/channels/1/messages", { method: "POST" })).rejects.toThrow("after retries");
    vi.unstubAllGlobals();
  });

  it("rejects Cron calls without the configured secret before any database access", async () => {
    const app = new Hono();
    registerDiscordBriefingRoutes(app as never);
    expect((await app.request("/discord/weekly-briefing")).status).toBe(401);
    expect((await app.request("/discord/weekly-briefing", { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
  });

  it("sends one protected D-Day reminder with mentions disabled", async () => {
    const updates: Record<string, unknown>[] = [];
    lifecycle.createMutationClient.mockReturnValue(ownedDeliveryClient(updates));
    lifecycle.getDueReminders.mockResolvedValue([{ accountManager: "manager", companyId: "company-1", companyName: "Company", memo: null, projectId: "project-1", projectName: "Project", scheduleId: "schedule-1", scheduledOn: "2026-07-20", title: "Report" }]);
    lifecycle.claimReminder.mockResolvedValue({ data: { claim_token: "claim", id: "reminder-1", message_content: "reminder" }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "message-id" })));
    const app = new Hono();
    registerDiscordBriefingRoutes(app as never);

    const response = await app.request("/discord/schedule-reminders", { headers: { Authorization: "Bearer secret" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ delivered: 1, failures: [] });
    expect(lifecycle.claimReminder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "d_day" }));
    expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).toMatchObject({ allowed_mentions: { parse: [] }, content: "reminder" });
    expect(updates).toContainEqual(expect.objectContaining({ status: "completed" }));
    vi.unstubAllGlobals();
  });

  it("records a D-1 failure without calling Discord when its channel is not configured", async () => {
    const updates: Record<string, unknown>[] = [];
    const noChannelClient = ownedDeliveryClient(updates);
    noChannelClient.from.mockImplementation((table: string) => table === "discord_manager_channels"
      ? { select: vi.fn().mockResolvedValue({ data: [], error: null }) }
      : { update: vi.fn((update: Record<string, unknown>) => { updates.push(update); return { eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "reminder-1" }, error: null }) })) })) })) }; }) });
    lifecycle.createMutationClient.mockReturnValue(noChannelClient);
    lifecycle.getDueReminders.mockResolvedValue([{ accountManager: "manager", companyId: "company-1", companyName: "Company", memo: null, projectId: "project-1", projectName: "Project", scheduleId: "schedule-1", scheduledOn: "2026-07-21", title: "Report" }]);
    lifecycle.claimReminder.mockResolvedValue({ data: { claim_token: "claim", id: "reminder-1", message_content: "reminder" }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = new Hono();
    registerDiscordBriefingRoutes(app as never);

    const response = await app.request("/discord/schedule-reminders", { headers: { Authorization: "Bearer secret" } });

    expect(await response.json()).toEqual({ delivered: 0, failures: ["manager:schedule-1:d_minus_1:channel-not-configured"] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates).toContainEqual(expect.objectContaining({ status: "failed" }));
    vi.unstubAllGlobals();
  });

  it("delivers a scheduled company through parent, thread, and chunk checkpoints with mentions disabled", async () => {
    const updates: Record<string, unknown>[] = [];
    lifecycle.createMutationClient.mockReturnValue(ownedDeliveryClient(updates));
    lifecycle.getSnapshot.mockResolvedValue([company]);
    lifecycle.claim.mockResolvedValue({ data: delivery, error: null });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ id: "parent-id" }))
      .mockResolvedValueOnce(Response.json({ id: "thread-id" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })));
    const app = new Hono();
    registerDiscordBriefingRoutes(app as never);

    const response = await app.request("/discord/weekly-briefing", { headers: { Authorization: "Bearer secret" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ delivered: 1, failures: [] });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[2]?.[0]).toBe("https://discord.com/api/v10/channels/thread-id/messages");
    for (const [url, init] of (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => !String(url).endsWith("/threads"))) {
      expect(JSON.parse((init as RequestInit).body as string).allowed_mentions).toEqual({ parse: [] });
    }
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ parent_message_id: "parent-id" }),
      expect.objectContaining({ thread_id: "thread-id" }),
      expect.objectContaining({ sent_message_count: 1 }),
      expect.objectContaining({ status: "completed" }),
    ]));
    vi.unstubAllGlobals();
  });

  it("resumes after a sent project message without duplicate Discord calls", async () => {
    const updates: Record<string, unknown>[] = [];
    lifecycle.createMutationClient.mockReturnValue(ownedDeliveryClient(updates));
    lifecycle.getSnapshot.mockResolvedValue([company]);
    lifecycle.claim.mockResolvedValue({ data: { ...delivery, parent_message_id: "parent-id", thread_id: "thread-id", sent_message_count: 1 }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = new Hono();
    registerDiscordBriefingRoutes(app as never);

    const response = await app.request("/discord/weekly-briefing", { headers: { Authorization: "Bearer secret" } });

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates).toContainEqual(expect.objectContaining({ status: "completed" }));
    vi.unstubAllGlobals();
  });

  it("marks an unacknowledged scheduled Discord request for review", async () => {
    const updates: Record<string, unknown>[] = [];
    lifecycle.createMutationClient.mockReturnValue(ownedDeliveryClient(updates));
    lifecycle.getSnapshot.mockResolvedValue([company]);
    lifecycle.claim.mockResolvedValue({ data: delivery, error: null });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network failed")));
    const app = new Hono();
    registerDiscordBriefingRoutes(app as never);

    const response = await app.request("/discord/weekly-briefing", { headers: { Authorization: "Bearer secret" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ delivered: 0, failures: ["manager:company-1"] });
    expect(updates).toContainEqual(expect.objectContaining({ status: "needs_review" }));
    vi.unstubAllGlobals();
  });

  it("records manual tests separately from scheduled delivery state", async () => {
    const historyInsert = vi.fn().mockResolvedValue({ error: null });
    lifecycle.createMutationClient.mockReturnValue({ from: vi.fn(() => ({ insert: historyInsert })) });
    lifecycle.getSnapshot.mockResolvedValue([]);
    const mappingClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { discord_channel_id: "channel" }, error: null }) })) })) })),
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const app = new Hono();
    app.use("*", async (context, next) => {
      context.set("supabase" as never, mappingClient as never);
      await next();
    });
    registerDiscordBriefingRoutes(app as never);

    const response = await app.request("/discord/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountManager: "manager" }) });

    expect(response.status).toBe(200);
    expect(historyInsert).toHaveBeenCalledWith(expect.objectContaining({ account_manager: "manager", status: "completed" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lifecycle.claim).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
