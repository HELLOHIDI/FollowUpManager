import { describe, expect, it } from "vitest";
import { buildProjectExportCsv } from "../lib/csv";

describe("buildProjectExportCsv", () => {
  it("builds a UTF-8 CSV with escaped cells", () => {
    const csv = buildProjectExportCsv({
      project: { id: "11111111-1111-4111-8111-111111111111", name: "Export Project" },
      filters: { category: null, from: null, stage: null, to: null },
      categoryOptions: [],
      stageOptions: [],
      rows: [
        {
          amount: 1200,
          categoryKey: "material_cost",
          categoryName: "재료비",
          createdAt: "2026-06-24T00:00:00.000Z",
          expectedSpendDate: "2026-06-30",
          executionRequestDate: null,
          fundingSourceKey: "government_subsidy",
          id: "22222222-2222-4222-8222-222222222222",
          memo: "쉼표, 포함",
          stageKey: "budget_registration",
          stageLabel: "사업비 등록",
          title: "시제품 재료",
          vendorName: "A \"Vendor\"",
        },
      ],
    });

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("지출명,비목,재원,금액");
    expect(csv).toContain('"A ""Vendor"""');
    expect(csv).toContain('"쉼표, 포함"');
  });

  it("neutralizes spreadsheet formulas in exported text cells", () => {
    const csv = buildProjectExportCsv({
      project: { id: "11111111-1111-4111-8111-111111111111", name: "Export Project" },
      filters: { category: null, from: null, stage: null, to: null },
      categoryOptions: [],
      stageOptions: [],
      rows: [
        {
          amount: 1200,
          categoryKey: "material_cost",
          categoryName: "\u0001-1+2",
          createdAt: "2026-06-24T00:00:00.000Z",
          expectedSpendDate: "2026-06-30",
          executionRequestDate: null,
          fundingSourceKey: "government_subsidy",
          id: "22222222-2222-4222-8222-222222222222",
          memo: " \t\r\n+SUM(1,1)",
          stageKey: "budget_registration",
          stageLabel: "사업비 등록",
          title: " =cmd",
          vendorName: "\t@vendor",
        },
      ],
    });

    expect(csv).toContain("' =cmd");
    expect(csv).toContain("'\u0001-1+2");
    expect(csv).toContain("'\t@vendor");
    expect(csv).toContain("\"' \t\r\n+SUM(1,1)\"");
  });
});
