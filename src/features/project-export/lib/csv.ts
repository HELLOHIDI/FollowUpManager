import type { ProjectExportResponse } from "../backend/schema";

const csvColumns = [
  ["title", "지출명"],
  ["categoryName", "비목"],
  ["fundingSourceKey", "재원"],
  ["amount", "금액"],
  ["stageLabel", "단계"],
  ["expectedSpendDate", "예상 지출일"],
  ["executionRequestDate", "집행 요청일"],
  ["vendorName", "거래처"],
  ["memo", "메모"],
  ["createdAt", "등록일"],
] as const;

const escapeCsvCell = (value: unknown) => {
  const rawText = value === null || value === undefined ? "" : String(value);
  const text = /^[\s\x00-\x1f]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildProjectExportCsv = (data: ProjectExportResponse) => {
  const header = csvColumns.map(([, label]) => escapeCsvCell(label)).join(",");
  const rows = data.rows.map((row) =>
    csvColumns.map(([key]) => escapeCsvCell(row[key])).join(","),
  );
  return ["\uFEFF" + header, ...rows].join("\r\n");
};
