import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfParseMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  destroy: vi.fn(),
  getText: vi.fn(),
  setWorker: vi.fn(),
}));

vi.mock("pdf-parse", () => {
  const PDFParse = vi.fn().mockImplementation((options) => {
    pdfParseMocks.construct(options);
    return {
      destroy: pdfParseMocks.destroy,
      getText: pdfParseMocks.getText,
    };
  }) as ReturnType<typeof vi.fn> & { setWorker: typeof pdfParseMocks.setWorker };
  PDFParse.setWorker = pdfParseMocks.setWorker;

  return { PDFParse };
});

import {
  extractPolicyPdfText,
  isUsablePolicyText,
  POLICY_PDF_TEXT_EXTRACTION_FAILED,
  TEXT_EXTRACTION_INSUFFICIENT,
} from "./pdf-text-extraction";

describe("program policy PDF text extraction", () => {
  beforeEach(() => {
    pdfParseMocks.construct.mockReset();
    pdfParseMocks.destroy.mockReset().mockResolvedValue(undefined);
    pdfParseMocks.getText.mockReset();
    pdfParseMocks.setWorker.mockClear();
  });

  it("classifies usable text conservatively", () => {
    expect(isUsablePolicyText("증빙")).toBe(false);
    expect(isUsablePolicyText("재료비 증빙서류 세금계산서 거래명세서 검수확인서 ".repeat(4))).toBe(true);
  });

  it("extracts text-layer content with normalized whitespace", async () => {
    pdfParseMocks.getText.mockResolvedValue({
      text: `재료비\t\t증빙서류 세금계산서


외주용역비   증빙서류 계약서 결과보고서 `.repeat(3),
    });

    const result = await extractPolicyPdfText(new Uint8Array([37, 80, 68, 70]));

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.text).toContain("재료비 증빙서류");
      expect(result.text).not.toContain("\t");
    }
    expect(pdfParseMocks.construct).toHaveBeenCalledWith({ data: expect.any(Uint8Array) });
    expect(pdfParseMocks.getText).toHaveBeenCalledWith({ lineEnforce: true, pageJoiner: "\n" });
    expect(pdfParseMocks.setWorker).toHaveBeenCalledWith(expect.stringContaining("pdf.worker.mjs"));
    expect(pdfParseMocks.destroy).toHaveBeenCalled();
  });

  it("returns an insufficient-text failure for image-only PDFs", async () => {
    pdfParseMocks.getText.mockResolvedValueOnce({ text: " " });
    await expect(extractPolicyPdfText(new Uint8Array([1]))).resolves.toEqual({
      ok: false,
      reason: TEXT_EXTRACTION_INSUFFICIENT,
    });
    expect(pdfParseMocks.destroy).toHaveBeenCalledTimes(1);
  });

  it("returns a distinct failure when the PDF parser throws", async () => {
    pdfParseMocks.getText.mockRejectedValueOnce(new Error("encrypted"));
    await expect(extractPolicyPdfText(new Uint8Array([2]))).resolves.toEqual({
      error: "encrypted",
      ok: false,
      reason: POLICY_PDF_TEXT_EXTRACTION_FAILED,
    });
    expect(pdfParseMocks.destroy).toHaveBeenCalledTimes(1);
  });
});
