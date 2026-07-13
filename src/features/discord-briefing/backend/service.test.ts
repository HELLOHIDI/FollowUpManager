import { describe, expect, it } from "vitest";
import { getSeoulWeek, renderCompanyBriefing } from "./service";

describe("Discord weekly briefing", () => {
  it("uses the approved Seoul week buckets", () => {
    expect(getSeoulWeek(new Date("2026-07-01T00:00:00+09:00")).key).toBe("2026-07-1");
    expect(getSeoulWeek(new Date("2026-07-08T00:00:00+09:00")).key).toBe("2026-07-2");
    expect(getSeoulWeek(new Date("2026-12-31T23:00:00+09:00")).key).toBe("2026-12-5");
    expect(getSeoulWeek(new Date("2027-01-01T00:00:00+09:00")).key).toBe("2027-01-1");
  });

  it("escapes unknown stage and detail status text", () => {
    const briefing = renderCompanyBriefing({ account_manager: "정현정", company_name: "A", id: "company", projects: [{ id: "project", project_name: "P", expenses: [{ id: "pending", title: "x", stage_key: "custom_*", pre_approval_status: null, execution_progress_status: null, execution_request_status: null }] }] }, "https://app.example.com", "7월 2주차");
    expect(briefing.projectMessages[0]).toContain("custom\\_\\*");
  });

  it("escapes mentions and excludes completed expenses", () => {
    const briefing = renderCompanyBriefing({ account_manager: "\uC815\uD604\uC815", company_name: "A", id: "company", projects: [{ id: "project", project_name: "P", expenses: [{ id: "pending", title: "@everyone *review*", stage_key: "pre_approval", pre_approval_status: null, execution_progress_status: null, execution_request_status: null }, { id: "done", title: "done", stage_key: "execution_completed", pre_approval_status: null, execution_progress_status: null, execution_request_status: null }] }] }, "https://app.example.com", "7\uC6D4 2\uC8FC\uCC28");
    expect(briefing.projectMessages[0]).toContain("@\u200beveryone");
    expect(briefing.projectMessages[0]).not.toContain("/expenses/done");
    expect(briefing.projectMessages[0]).toContain("\uC138\uBD80 \uC0C1\uD0DC \uBBF8\uC785\uB825");
  });

  it("splits an oversized project only between expense rows", () => {
    const expenses = Array.from({ length: 30 }, (_, index) => ({ id: String(index), title: "x".repeat(120), stage_key: "pre_approval", pre_approval_status: "requested", execution_progress_status: null, execution_request_status: null }));
    const briefing = renderCompanyBriefing({ account_manager: "\uC815\uD604\uC815", company_name: "A", id: "company", projects: [{ id: "project", project_name: "P", expenses }] }, "https://app.example.com", "7\uC6D4 2\uC8FC\uCC28");
    expect(briefing.projectMessages.length).toBeGreaterThan(1);
    expect(briefing.projectMessages.every((message) => message.length <= 2_000)).toBe(true);
  });
});
