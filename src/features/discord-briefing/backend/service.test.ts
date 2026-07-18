import { describe, expect, it } from "vitest";
import { getSeoulWeek, renderCompanyBriefing, renderScheduleReminder } from "./service";

describe("Discord weekly briefing", () => {
  it("uses the approved Seoul week buckets", () => {
    expect(getSeoulWeek(new Date("2026-07-01T00:00:00+09:00")).key).toBe("2026-07-1");
    expect(getSeoulWeek(new Date("2026-07-08T00:00:00+09:00")).key).toBe("2026-07-2");
    expect(getSeoulWeek(new Date("2026-12-31T23:00:00+09:00")).key).toBe("2026-12-5");
    expect(getSeoulWeek(new Date("2027-01-01T00:00:00+09:00")).key).toBe("2027-01-1");
  });

  it("escapes unknown stage and detail status text", () => {
    const briefing = renderCompanyBriefing({ account_manager: "정현정", company_name: "A", id: "company", projects: [{ id: "project", project_name: "P", expenses: [{ id: "pending", title: "x", stage_key: "custom_*", stage_fields: {} }] }] }, "https://app.example.com", "7월 2주차");
    expect(briefing.projectMessages[0]).toContain("custom\\_\\*");
  });

  it("escapes mentions and excludes completed expenses", () => {
    const briefing = renderCompanyBriefing({ account_manager: "\uC815\uD604\uC815", company_name: "A", id: "company", projects: [{ id: "project", project_name: "P", expenses: [{ id: "pending", title: "@everyone *review*", stage_key: "pre_approval", stage_fields: {} }, { id: "done", title: "done", stage_key: "execution_completed", stage_fields: {} }] }] }, "https://app.example.com", "7\uC6D4 2\uC8FC\uCC28");
    expect(briefing.projectMessages[0]).toContain("/projects/project");
    expect(briefing.projectMessages[0]).not.toContain("/expenses/");
    expect(briefing.projectMessages[0]).toContain("@\u200beveryone");
    expect(briefing.projectMessages[0]).toContain("\uC0AC\uC804\uC900\uBE44");
    expect(briefing.projectMessages[0]).not.toContain("|");
  });

  it("keeps projects as separate messages inside one company weekly thread", () => {
    const briefing = renderCompanyBriefing({ account_manager: "\uC815\uD604\uC815", company_name: "A", id: "company", projects: [
      { id: "project-one", project_name: "\uC0AC\uC5C5 1", expenses: [{ id: "one", title: "\uC9C0\uCD9C 1", stage_key: "budget_registration", stage_fields: {} }] },
      { id: "project-two", project_name: "\uC0AC\uC5C5 2", expenses: [{ id: "two", title: "\uC9C0\uCD9C 2", stage_key: "pre_approval", stage_fields: { stage_checklists: { pre_approval: { progress: "managerConfirmed" } } } }] },
    ] }, "https://app.example.com", "7\uC6D4 2\uC8FC\uCC28");
    expect(briefing.projectMessages).toHaveLength(2);
    expect(briefing.parent).toContain("**A**");
    expect(briefing.threadName).toContain("A");
    expect(briefing.projectMessages[0]).toContain("/projects/project-one");
    expect(briefing.projectMessages[0]).not.toContain("project-two");
    expect(briefing.projectMessages[1]).toContain("/projects/project-two");
    expect(briefing.projectMessages[1]).toContain("\uB2F4\uB2F9\uC790 \uD655\uC778");
  });

  it("splits an oversized project only between expense rows", () => {
    const expenses = Array.from({ length: 30 }, (_, index) => ({ id: String(index), title: "x".repeat(120), stage_key: "pre_approval", stage_fields: {} }));
    const briefing = renderCompanyBriefing({ account_manager: "\uC815\uD604\uC815", company_name: "A", id: "company", projects: [{ id: "project", project_name: "P", expenses }] }, "https://app.example.com", "7\uC6D4 2\uC8FC\uCC28");
    expect(briefing.projectMessages.length).toBeGreaterThan(1);
    expect(briefing.projectMessages.every((message) => message.length <= 2_000)).toBe(true);
  });

  it("adds the weekly schedule section only when the project has schedules", () => {
    const withSchedule = renderCompanyBriefing({ account_manager: "\uC815\uD604\uC815", company_name: "A", id: "company", projects: [{ expenses: [], id: "project", project_name: "P", schedules: [{ id: "schedule", memo: "\uC99D\uC740 \uD30C\uC77C \uC900\uBE44", scheduled_on: "2026-07-20", title: "\uC911\uAC04 \uBCF4\uACE0\uC11C \uC81C\uCD9C" }] }] }, "https://app.example.com", "7\uC6D4 3\uC8FC\uCC28");
    const withoutSchedule = renderCompanyBriefing({ account_manager: "\uC815\uD604\uC815", company_name: "A", id: "company", projects: [{ expenses: [], id: "project", project_name: "P", schedules: [] }] }, "https://app.example.com", "7\uC6D4 3\uC8FC\uCC28");
    expect(withSchedule.projectMessages[0]).toContain("\uC774\uBC88 \uC8FC \uC8FC\uC694 \uC77C\uC815");
    expect(withSchedule.projectMessages[0]).toContain("2026-07-20");
    expect(withoutSchedule.projectMessages[0]).not.toContain("\uC774\uBC88 \uC8FC \uC8FC\uC694 \uC77C\uC815");
  });

  it("renders one weekly schedule heading for multiple schedules", () => {
    const briefing = renderCompanyBriefing({ account_manager: "\uC815\uD604\uC815", company_name: "A", id: "company", projects: [{ expenses: [], id: "project", project_name: "P", schedules: [{ id: "one", memo: null, scheduled_on: "2026-07-20", title: "A" }, { id: "two", memo: null, scheduled_on: "2026-07-21", title: "B" }] }] }, "https://app.example.com", "7\uC6D4 3\uC8FC\uCC28");
    expect(briefing.projectMessages[0].match(/\uC774\uBC88 \uC8FC \uC8FC\uC694 \uC77C\uC815/g)).toHaveLength(1);
  });

  it("renders a D-Day reminder without allowing Discord mentions", () => {
    const message = renderScheduleReminder({ accountManager: "\uC815\uD604\uC815", companyId: "company", companyName: "A", memo: "@everyone", projectId: "project", projectName: "P", scheduleId: "schedule", scheduledOn: "2026-07-20", title: "\uBCF4\uACE0" }, "d_day", "https://app.example.com");
    expect(message).toContain("\uC624\uB298 \uC77C\uC815 \uC54C\uB9BC");
    expect(message).toContain("@\u200beveryone");
    expect(message).toContain("/projects/project/schedules");
  });
});
