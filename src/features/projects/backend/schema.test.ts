import { describe, expect, it } from "vitest";
import {
  DOCUMENT_MIME_TYPES,
  getDocumentMetadata,
  ProjectEvidenceTemplateSetupResponseSchema,
  ProjectInputSchema,
  SaveProjectEvidenceDocumentsInputSchema,
  UploadIntentInputSchema,
} from "./schema";

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

describe("project evidence template schemas", () => {
  it("accepts multiple manual template links per evidence document type", () => {
    const input = SaveProjectEvidenceDocumentsInputSchema.parse({
      documentTypes: [{
        displayName: "거래명세서",
        documentKey: "transaction_statement",
        sortOrder: 0,
        source: "custom",
        stageKey: "execution_request",
      }],
      links: [
        {
          documentKey: "transaction_statement",
          projectDocumentId: "11111111-1111-4111-8111-111111111111",
          sortOrder: 0,
        },
        {
          documentKey: "transaction_statement",
          projectDocumentId: "22222222-2222-4222-8222-222222222222",
          sortOrder: 1,
        },
      ],
    });

    expect(input.links).toHaveLength(2);
  });

  it("keeps empty institution template state valid", () => {
    expect(SaveProjectEvidenceDocumentsInputSchema.parse({ documentTypes: [], links: [] })).toEqual({
      documentTypes: [],
      links: [],
    });
  });

  it("returns document type and link metadata needed by the manual linking UI", () => {
    const response = ProjectEvidenceTemplateSetupResponseSchema.parse({
      documentTypes: [{
        displayName: "세금계산서",
        documentKey: "tax_invoice",
        id: "33333333-3333-4333-8333-333333333333",
        projectId: "44444444-4444-4444-8444-444444444444",
        sortOrder: 0,
        source: "policy",
        stageKey: "execution_request",
      }],
      links: [{
        documentKey: "tax_invoice",
        documentTypeId: "33333333-3333-4333-8333-333333333333",
        projectDocumentId: "55555555-5555-4555-8555-555555555555",
        sortOrder: 0,
      }],
    });

    expect(response.documentTypes[0]?.source).toBe("policy");
    expect(response.links[0]?.documentKey).toBe("tax_invoice");
  });
});
