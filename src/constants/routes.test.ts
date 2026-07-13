import { describe, expect, it } from "vitest";
import { getProjectIdFromPathname, routes } from "./routes";

describe("product routes", () => {
  it("provides the FAQ route", () => {
    expect(routes.faq).toBe("/faq");
  });

  it("encodes dynamic route segments", () => {
    expect(routes.project("지원 사업")).toBe("/projects/%EC%A7%80%EC%9B%90%20%EC%82%AC%EC%97%85");
    expect(routes.projectExpenses("p/1")).toBe("/projects/p%2F1/expenses");
    expect(routes.expense("p/1", "e 1")).toBe("/projects/p%2F1/expenses/e%201");
  });

  it("reads the project id only from project detail paths", () => {
    expect(getProjectIdFromPathname("/projects/demo/export")).toBe("demo");
    expect(getProjectIdFromPathname("/projects/demo/expenses")).toBe("demo");
    expect(getProjectIdFromPathname("/projects/%EC%A7%80%EC%9B%90")).toBe("지원");
    expect(getProjectIdFromPathname("/projects")).toBeNull();
    expect(getProjectIdFromPathname("/settings/company")).toBeNull();
  });
});
