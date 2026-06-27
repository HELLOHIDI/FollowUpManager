import { describe, expect, it } from "vitest";
import { DOCUMENT_MIME_TYPES, getDocumentMetadata, ProjectInputSchema, UploadIntentInputSchema } from "./schema";

const validProject = {
  agreementEndDate: "2026-12-31", agreementStartDate: "2026-01-01", assignmentName: "과제명", assignmentNumber: "A-001",
  governmentSubsidyAmount: "1000", hostInstitution: "기관", managerEmail: "owner@example.com", managerName: "담당자", managerPhone: null,
  projectName: "지원사업", projectNotes: null, selfCashAmount: "0", selfInKindAmount: "0",
};

describe("ProjectInputSchema", () => {
  it("accepts email-only contact and direct amounts", () => expect(ProjectInputSchema.safeParse(validProject).success).toBe(true));
  it("requires one contact", () => expect(ProjectInputSchema.safeParse({ ...validProject, managerEmail: null, managerPhone: null }).success).toBe(false));
  it("rejects zero total and reversed dates", () => {
    expect(ProjectInputSchema.safeParse({ ...validProject, governmentSubsidyAmount: "0" }).success).toBe(false);
    expect(ProjectInputSchema.safeParse({ ...validProject, agreementEndDate: "2025-12-31" }).success).toBe(false);
  });
  it("rejects impossible calendar dates", () => expect(ProjectInputSchema.safeParse({ ...validProject, agreementStartDate: "2026-02-30" }).success).toBe(false));
  it("rejects amounts beyond the JavaScript-safe boundary", () => expect(ProjectInputSchema.safeParse({ ...validProject, governmentSubsidyAmount: "9007199254740992" }).success).toBe(false));
});

describe("project document metadata", () => {
  it("canonicalizes documented aliases", () => {
    expect(getDocumentMetadata({ browserMimeType: "application/zip", fileSize: 10, originalFileName: "문서.hwpx" })?.canonicalMimeType).toBe(DOCUMENT_MIME_TYPES.hwpx);
    expect(getDocumentMetadata({ browserMimeType: "text/plain", fileSize: 10, originalFileName: "표.csv" })?.canonicalMimeType).toBe("text/csv");
  });
  it("rejects mismatched MIME and unsupported extensions", () => {
    expect(getDocumentMetadata({ browserMimeType: "image/png", fileSize: 10, originalFileName: "문서.pdf" })).toBeNull();
    expect(getDocumentMetadata({ browserMimeType: null, fileSize: 10, originalFileName: "실행.exe" })).toBeNull();
  });
  it("rejects path-like original filenames", () => {
    expect(UploadIntentInputSchema.safeParse({ browserMimeType: "application/pdf", fileSize: 10, originalFileName: "../문서.pdf" }).success).toBe(false);
  });
});
