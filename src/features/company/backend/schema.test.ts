import { describe, expect, it } from "vitest";
import {
  CompanyResponseSchema,
  createCompanyInputSchema,
  getSeoulCalendarDate,
} from "./schema";

const validCompany = {
  accountManager: "정현정" as const,
  businessRegistrationNumber: "123-45-67890",
  businessType: "corporation" as const,
  companyName: " 테스트 기업 ",
  companySize: "small_enterprise" as const,
  corporateRegistrationNumber: "123456-1234567",
  foundedAt: "2026-06-22",
};

describe("company input contract", () => {
  const schema = createCompanyInputSchema(
    new Date("2026-06-22T14:59:59.000Z")
  );

  it("normalizes supported registration number formats", () => {
    expect(schema.parse(validCompany)).toMatchObject({
      businessRegistrationNumber: "1234567890",
      companyName: "테스트 기업",
      corporateRegistrationNumber: "1234561234567",
    });
  });

  it.each([
    "123-45-6789A",
    "123.45.67890",
    "123456789",
    "12345678901",
  ])("rejects invalid business registration input %s", (value) => {
    expect(
      schema.safeParse({ ...validCompany, businessRegistrationNumber: value })
        .success
    ).toBe(false);
  });

  it("requires exactly 13 corporate digits for corporations", () => {
    expect(
      schema.safeParse({ ...validCompany, corporateRegistrationNumber: null })
        .success
    ).toBe(false);
    expect(
      schema.safeParse({
        ...validCompany,
        corporateRegistrationNumber: "123456-123456A",
      }).success
    ).toBe(false);
  });

  it("clears a corporate number for sole proprietors", () => {
    expect(
      schema.parse({
        ...validCompany,
        businessType: "sole_proprietor",
      }).corporateRegistrationNumber
    ).toBeNull();
    expect(
      schema.parse({
        ...validCompany,
        businessType: "sole_proprietor",
        corporateRegistrationNumber: null,
      }).corporateRegistrationNumber
    ).toBeNull();
  });

  it("uses the Seoul calendar boundary for founded dates", () => {
    expect(getSeoulCalendarDate(new Date("2026-06-22T14:59:59.000Z"))).toBe(
      "2026-06-22"
    );
    expect(getSeoulCalendarDate(new Date("2026-06-22T15:00:00.000Z"))).toBe(
      "2026-06-23"
    );
    expect(schema.safeParse(validCompany).success).toBe(true);
    expect(
      schema.safeParse({ ...validCompany, foundedAt: "2026-06-23" }).success
    ).toBe(false);
    expect(
      schema.safeParse({ ...validCompany, foundedAt: "2026-02-30" }).success
    ).toBe(false);
  });

  it("evaluates the default clock at validation time", () => {
    let now = new Date("2026-06-22T14:59:59.000Z");
    const dynamicSchema = createCompanyInputSchema(() => now);

    expect(dynamicSchema.safeParse(validCompany).success).toBe(true);
    now = new Date("2026-06-22T15:00:00.000Z");
    expect(
      dynamicSchema.safeParse({ ...validCompany, foundedAt: "2026-06-23" })
        .success
    ).toBe(true);
  });
});

describe("company response contract", () => {
  const response = {
    accountManager: "정현정" as const,
    businessRegistrationNumber: "1234567890",
    businessType: "corporation" as const,
    companyName: "테스트 기업",
    companySize: "small_enterprise" as const,
    corporateRegistrationNumber: "1234561234567",
    createdAt: "2026-06-22T00:00:00.000Z",
    foundedAt: "2020-01-01",
    id: "22222222-2222-4222-8222-222222222222",
    profileStatus: "complete" as const,
    updatedAt: "2026-06-22T00:00:00.000Z",
  };

  it("rejects company type and registration-number disagreement", () => {
    expect(
      CompanyResponseSchema.safeParse({
        ...response,
        businessType: "sole_proprietor",
      }).success
    ).toBe(false);
  });

  it("rejects company size and profile-status disagreement", () => {
    expect(
      CompanyResponseSchema.safeParse({
        ...response,
        companySize: "unknown",
      }).success
    ).toBe(false);
  });
});
