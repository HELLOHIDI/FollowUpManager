import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfParseMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  destroy: vi.fn(),
  getTable: vi.fn(),
  getText: vi.fn(),
  setWorker: vi.fn(),
}));

vi.mock("pdf-parse", () => {
  const PDFParse = vi.fn().mockImplementation((options) => {
    pdfParseMocks.construct(options);
    return {
      destroy: pdfParseMocks.destroy,
      getTable: pdfParseMocks.getTable,
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
  TABLE_CELL_LINE_SEPARATOR,
  TEXT_EXTRACTION_INSUFFICIENT,
} from "./pdf-text-extraction";

describe("program policy PDF text extraction", () => {
  beforeEach(() => {
    pdfParseMocks.construct.mockReset();
    pdfParseMocks.destroy.mockReset().mockResolvedValue(undefined);
    pdfParseMocks.getTable.mockReset().mockResolvedValue({ pages: [] });
    pdfParseMocks.getText.mockReset();
    pdfParseMocks.setWorker.mockClear();
  });

  it("classifies usable text conservatively", () => {
    expect(isUsablePolicyText("재료비")).toBe(false);
    expect(isUsablePolicyText("재료비 증빙서류 세금계산서 거래명세서 검수조서 외주용역비 계약서 결과보고서 ".repeat(3))).toBe(true);
  });

  it("extracts text-layer content with normalized whitespace", async () => {
    pdfParseMocks.getText.mockResolvedValue({
      text: `재료비\t\t증빙서류 세금계산서


외주용역비  증빙서류 계약서 결과보고서`.repeat(3),
    });

    const result = await extractPolicyPdfText(new Uint8Array([37, 80, 68, 70]));

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.text).toContain("재료비\t\t증빙서류 세금계산서");
      expect(result.text).toContain("외주용역비 증빙서류 계약서");
    }
    expect(pdfParseMocks.construct).toHaveBeenCalledWith({ data: expect.any(Uint8Array) });
    expect(pdfParseMocks.getTable).toHaveBeenCalled();
    expect(pdfParseMocks.getText).toHaveBeenCalledWith({ lineEnforce: true, pageJoiner: "\n" });
    expect(pdfParseMocks.setWorker).toHaveBeenCalledWith(expect.stringContaining("pdf.worker.mjs"));
    expect(pdfParseMocks.destroy).toHaveBeenCalled();
  });

  it("prepends detected policy table rows to the extracted text", async () => {
    pdfParseMocks.getText.mockResolvedValue({ text: "plain text ".repeat(20) });
    pdfParseMocks.getTable.mockResolvedValue({
      pages: [{
        tables: [[
          ["비목", "집행 증빙서류"],
          ["재료비", "① 세금계산서\n② 거래명세서\n③ 검수조서"],
        ]],
      }],
    });

    const result = await extractPolicyPdfText(new Uint8Array([37, 80, 68, 70]));

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.text).toContain(`재료비\t① 세금계산서${TABLE_CELL_LINE_SEPARATOR}② 거래명세서`);
      expect(result.text).toContain("③ 검수조서");
      expect(result.text).toContain("plain text");
    }
  });

  it("ignores non-policy tables from later document sections", async () => {
    pdfParseMocks.getText.mockResolvedValue({ text: "plain text ".repeat(20) });
    pdfParseMocks.getTable.mockResolvedValue({
      pages: [{
        tables: [
          [
            ["section", "content"],
            ["refund", "1. refund reason"],
          ],
          [
            ["\uBE44\uBAA9", "\uC9D1\uD589 \uC99D\uBE59\uC11C\uB958"],
            ["material_cost", "1. Tax invoice\n2. Transaction statement"],
          ],
        ],
      }],
    });

    const result = await extractPolicyPdfText(new Uint8Array([37, 80, 68, 70]));

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.text).toContain("material_cost\t1. Tax invoice");
      expect(result.text).not.toContain("refund");
    }
  });

  it("continues with text extraction when table detection fails", async () => {
    pdfParseMocks.getText.mockResolvedValue({ text: "재료비 증빙서류 세금계산서 거래명세서 검수조서 외주용역비 계약서 결과보고서 ".repeat(3) });
    pdfParseMocks.getTable.mockRejectedValue(new Error("table unavailable"));

    await expect(extractPolicyPdfText(new Uint8Array([37, 80, 68, 70]))).resolves.toMatchObject({ ok: true });
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
