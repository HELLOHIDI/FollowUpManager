import { describe, expect, it } from "vitest";
import { ExpenseEvidenceUploadInputSchema, getEvidenceFileMetadata, MAX_EVIDENCE_FILE_SIZE } from "./schema";

describe("expense evidence schema", () => {
  it("accepts policy-approved document extensions and normalizes metadata", () => {
    const input = {
      browserMimeType: "application/pdf",
      documentKey: "tax_invoice",
      fileSize: 1024,
      originalFileName: "invoice.pdf",
      requirementKey: null,
    };

    const parsed = ExpenseEvidenceUploadInputSchema.parse(input);

    expect(getEvidenceFileMetadata(parsed)).toEqual({
      canonicalMimeType: "application/pdf",
      extension: "pdf",
    });
  });

  it("accepts common archive image and HWP evidence files", () => {
    const base = {
      documentKey: "tax_invoice",
      fileSize: 1024,
      requirementKey: null,
    };

    expect(getEvidenceFileMetadata(ExpenseEvidenceUploadInputSchema.parse({ ...base, browserMimeType: "application/x-7z-compressed", originalFileName: "docs.7z" }))?.extension).toBe("7z");
    expect(getEvidenceFileMetadata(ExpenseEvidenceUploadInputSchema.parse({ ...base, browserMimeType: "image/heif-sequence", originalFileName: "photo.heif" }))?.extension).toBe("heif");
    expect(getEvidenceFileMetadata(ExpenseEvidenceUploadInputSchema.parse({ ...base, browserMimeType: "application/haansofthwp", originalFileName: "form.hwp" }))?.extension).toBe("hwp");
  });

  it("rejects blocked executable extensions and oversize files", () => {
    const blocked = {
      browserMimeType: "application/octet-stream",
      documentKey: "tax_invoice",
      fileSize: 1024,
      originalFileName: "installer.exe",
      requirementKey: null,
    };

    expect(getEvidenceFileMetadata(ExpenseEvidenceUploadInputSchema.parse(blocked))).toBeNull();
    expect(
      ExpenseEvidenceUploadInputSchema.safeParse({
        ...blocked,
        fileSize: MAX_EVIDENCE_FILE_SIZE + 1,
        originalFileName: "large.pdf",
      }).success,
    ).toBe(false);
  });
});
