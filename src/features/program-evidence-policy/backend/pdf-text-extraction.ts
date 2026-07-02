import "server-only";
import path from "path";
import { pathToFileURL } from "url";

export const TEXT_EXTRACTION_INSUFFICIENT = "TEXT_EXTRACTION_INSUFFICIENT" as const;
export const POLICY_PDF_TEXT_EXTRACTION_FAILED = "POLICY_PDF_TEXT_EXTRACTION_FAILED" as const;
export const MIN_USABLE_POLICY_TEXT_LENGTH = 80;
export const TABLE_CELL_LINE_SEPARATOR = " |LINE| ";

export type PolicyPdfTextExtractionResult =
  | { ok: true; text: string }
  | { ok: false; reason: typeof TEXT_EXTRACTION_INSUFFICIENT | typeof POLICY_PDF_TEXT_EXTRACTION_FAILED; error?: string };

const normalizeExtractedText = (text: string) =>
  text
    .replace(/\u0000/g, "")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeTableCell = (value: unknown) =>
  String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(TABLE_CELL_LINE_SEPARATOR);

const hasPolicyEvidenceHeader = (table: unknown[]) => {
  const headerText = table
    .slice(0, 3)
    .flatMap((row) => (Array.isArray(row) ? row : []))
    .map((cell) => normalizeTableCell(cell))
    .join(" ");

  return /\uBE44\uBAA9/.test(headerText) && /\uC99D\uBE59/.test(headerText);
};

const serializePolicyTables = (tableResult: unknown) => {
  const pages = (tableResult as { pages?: Array<{ tables?: unknown[] }> }).pages;
  if (!Array.isArray(pages)) {
    return "";
  }

  const rows: string[] = [];
  for (const page of pages) {
    if (!Array.isArray(page.tables)) {
      continue;
    }

    for (const table of page.tables) {
      if (!Array.isArray(table)) {
        continue;
      }
      if (!hasPolicyEvidenceHeader(table)) {
        continue;
      }

      for (const row of table) {
        if (!Array.isArray(row) || row.length < 2) {
          continue;
        }

        const categoryCell = normalizeTableCell(row[0]);
        const evidenceCell = normalizeTableCell(row.slice(1).join("\n"));
        if (!categoryCell || !evidenceCell) {
          continue;
        }

        rows.push(`${categoryCell}\t${evidenceCell}`);
      }
    }
  }

  return rows.join("\n");
};

export const isUsablePolicyText = (text: string) =>
  normalizeExtractedText(text).replace(/\s/g, "").length >= MIN_USABLE_POLICY_TEXT_LENGTH;

let isPdfWorkerConfigured = false;

type PDFParseConstructor = {
  new (options: { data: Uint8Array }): {
    destroy: () => Promise<unknown>;
    getTable: () => Promise<unknown>;
    getText: (options: { lineEnforce: boolean; pageJoiner: string }) => Promise<{ text?: string }>;
  };
  setWorker: (workerSrc?: string) => string;
};

const getPDFParse = async (): Promise<PDFParseConstructor> => {
  const canvas = await import("@napi-rs/canvas");
  const globals = globalThis as Record<string, unknown>;
  globals.DOMMatrix ??= canvas.DOMMatrix;
  globals.ImageData ??= canvas.ImageData;
  globals.Path2D ??= canvas.Path2D;

  return (await import("pdf-parse")).PDFParse as PDFParseConstructor;
};

const configurePdfWorker = async () => {
  const PDFParse = await getPDFParse();
  if (isPdfWorkerConfigured) {
    return PDFParse;
  }

  const workerPath = path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  PDFParse.setWorker(pathToFileURL(workerPath).href);
  isPdfWorkerConfigured = true;
  return PDFParse;
};

export const extractPolicyPdfText = async (data: ArrayBuffer | Uint8Array): Promise<PolicyPdfTextExtractionResult> => {
  const PDFParse = await configurePdfWorker();

  const parser = new PDFParse({ data: data instanceof Uint8Array ? data : new Uint8Array(data) });

  try {
    const result = await parser.getText({ lineEnforce: true, pageJoiner: "\n" });
    const tableText = await parser.getTable().then(serializePolicyTables).catch(() => "");
    const text = normalizeExtractedText([tableText, result.text ?? ""].filter(Boolean).join("\n"));
    return isUsablePolicyText(text)
      ? { ok: true, text }
      : { ok: false, reason: TEXT_EXTRACTION_INSUFFICIENT };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      reason: POLICY_PDF_TEXT_EXTRACTION_FAILED,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
};
