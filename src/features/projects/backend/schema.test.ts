import { describe, expect, it } from "vitest";
import {
  ProjectEvidenceTemplateSetupResponseSchema,
  SaveProjectEvidenceDocumentsInputSchema,
} from "./schema";

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
