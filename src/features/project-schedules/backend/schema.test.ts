import { describe, expect, it } from "vitest";
import { ProjectScheduleInputSchema } from "./schema";
import { getSeoulScheduleRange } from "./service";

describe("project schedule schema", () => {
  it("requires a real calendar date and nonblank title", () => {
    expect(ProjectScheduleInputSchema.safeParse({ title: "", scheduledOn: "2026-07-20" }).success).toBe(false);
    expect(ProjectScheduleInputSchema.safeParse({ title: "마감", scheduledOn: "2026-02-30" }).success).toBe(false);
  });

  it("normalizes a blank memo to null", () => {
    expect(ProjectScheduleInputSchema.parse({ title: "마감", scheduledOn: "2026-07-20", memo: "  " }).memo).toBeNull();
  });
});

describe("KST schedule week", () => {
  it("uses Monday through Sunday instead of a day-of-month bucket", () => {
    expect(getSeoulScheduleRange(new Date("2026-07-19T14:59:59.000Z"))).toMatchObject({ today: "2026-07-19", weekStart: "2026-07-13", weekEnd: "2026-07-19" });
    expect(getSeoulScheduleRange(new Date("2026-07-19T15:00:00.000Z"))).toMatchObject({ today: "2026-07-20", weekStart: "2026-07-20", weekEnd: "2026-07-26" });
  });
});
