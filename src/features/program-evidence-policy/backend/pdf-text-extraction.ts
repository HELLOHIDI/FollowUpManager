import "server-only";
import { PDFParse } from "pdf-parse";

export const TEXT_EXTRACTION_INSUFFICIENT = "TEXT_EXTRACTION_INSUFFICIENT" as const;
export const MIN_USABLE_POLICY_TEXT_LENGTH = 80;

export type PolicyPdfTextExtractionResult =
  | { ok: true; text: string }
  | { ok: false; reason: typeof TEXT_EXTRACTION_INSUFFICIENT; error?: string };

const normalizeExtractedText = (text: string) =>
  text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const isUsablePolicyText = (text: string) =>
  normalizeExtractedText(text).replace(/\s/g, "").length >= MIN_USABLE_POLICY_TEXT_LENGTH;

export const extractPolicyPdfText = async (data: ArrayBuffer | Uint8Array): Promise<PolicyPdfTextExtractionResult> => {
  const parser = new PDFParse({ data: data instanceof Uint8Array ? data : new Uint8Array(data) });

  try {
    const result = await parser.getText({ lineEnforce: true, pageJoiner: "\n" });
    const text = normalizeExtractedText(result.text ?? "");
    return isUsablePolicyText(text)
      ? { ok: true, text }
      : { ok: false, reason: TEXT_EXTRACTION_INSUFFICIENT };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      reason: TEXT_EXTRACTION_INSUFFICIENT,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
};
