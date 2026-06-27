import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTHENTICATED_PATH,
  LOGIN_PATH,
  buildLoginRedirectPath,
  getSafeRedirectPath,
  isAuthEntryPath,
  isRootPath,
  shouldProtectPath,
} from "./auth";

describe("auth route policy", () => {
  it("recognizes only the login page as an auth entry", () => {
    expect(isAuthEntryPath(LOGIN_PATH)).toBe(true);
    expect(isAuthEntryPath("/")).toBe(false);
  });

  it("recognizes the root path", () => {
    expect(isRootPath("/")).toBe(true);
    expect(isRootPath("/projects")).toBe(false);
  });

  it("protects only documented product route families", () => {
    expect(shouldProtectPath("/projects/project-1")).toBe(true);
    expect(shouldProtectPath("/settings/company")).toBe(true);
    expect(shouldProtectPath("/signup")).toBe(false);
    expect(shouldProtectPath("/unknown")).toBe(false);
  });
});

describe("getSafeRedirectPath", () => {
  it("preserves a protected internal path with query and hash", () => {
    expect(getSafeRedirectPath("/projects/project-1?tab=budget#overview")).toBe(
      "/projects/project-1?tab=budget#overview"
    );
  });

  it.each([
    null,
    "",
    "/",
    LOGIN_PATH,
    "/api/example",
    "/unknown",
    "https://example.com/projects/project-1",
    "//example.com/projects/project-1",
    "/\\example.com/projects/project-1",
    "projects/project-1",
  ])("falls back for unsafe or non-product destination %s", (destination) => {
    expect(getSafeRedirectPath(destination)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });
});

describe("buildLoginRedirectPath", () => {
  it("encodes the protected destination as a query parameter", () => {
    expect(buildLoginRedirectPath("/projects/project-1?tab=budget")).toBe(
      "/login?redirectedFrom=%2Fprojects%2Fproject-1%3Ftab%3Dbudget"
    );
  });
});
