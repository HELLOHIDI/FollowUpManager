import { describe, expect, it } from "vitest";
import { parseTextDraft, toStablePolicyKey, validateDraftBlockingErrors, validateDraftStructuralErrors } from "./service";

describe("program evidence policy service helpers", () => {
  it("creates deterministic ASCII fallback keys for Korean labels", () => {
    expect(toStablePolicyKey("재료비", "category")).toMatch(/^category_[a-f0-9]{8}$/);
    expect(toStablePolicyKey("Material Cost", "category")).toBe("material_cost");
  });

  it("blocks confirmation while rows still require admin review", () => {
    const errors = validateDraftBlockingErrors({
      categories: [{
        categoryKey: "material_cost",
        categoryName: "Material cost",
        reviewStatus: "needs_admin_review",
        sortOrder: 0,
        sourceReference: { page: 1 },
      }],
      evidenceRequirements: [{
        categoryKey: "material_cost",
        documentKey: "receipt",
        evidenceKey: "receipt",
        evidenceName: "Receipt",
        fulfillmentType: "single",
        requirementType: "required",
        reviewStatus: "auto_confident",
        sourceReference: { page: 1 },
      }],
      subcategories: [],
    });

    expect(errors).toContain("Category requires admin review: material_cost");
  });

  it("separates structural draft errors from review-readiness errors before saving", () => {
    const errors = validateDraftStructuralErrors({
      categories: [
        {
          categoryKey: "material_cost",
          categoryName: "Material cost",
          reviewStatus: "needs_admin_review",
          sortOrder: 0,
          sourceReference: { page: 1 },
        },
        {
          categoryKey: "material_cost",
          categoryName: "Duplicate",
          reviewStatus: "auto_confident",
          sortOrder: 1,
          sourceReference: { page: 1 },
        },
      ],
      evidenceRequirements: [{
        categoryKey: "material_cost",
        documentKey: "receipt",
        evidenceKey: "receipt",
        evidenceName: "Receipt",
        fulfillmentType: "single",
        requirementType: "required",
        reviewStatus: "needs_admin_review",
        sourceReference: { page: 1 },
      }],
      subcategories: [],
    });

    expect(errors).toEqual(["Duplicate category key: material_cost"]);
  });

  it("allows common evidence requirements without category linkage", () => {
    const errors = validateDraftBlockingErrors({
      categories: [{
        categoryKey: "material_cost",
        categoryName: "Material cost",
        reviewStatus: "auto_confident",
        sortOrder: 0,
        sourceReference: { page: 1 },
      }],
      evidenceRequirements: [{
        categoryKey: null,
        documentKey: "business_registration",
        evidenceKey: "business_registration",
        evidenceName: "Business registration",
        fulfillmentType: "single",
        requirementType: "required",
        reviewStatus: "auto_confident",
        sourceReference: { page: 1 },
      }],
      subcategories: [],
    });

    expect(errors).toEqual([]);
  });

  it("does not require source references before confirmation in V1", () => {
    const errors = validateDraftBlockingErrors({
      categories: [{
        categoryKey: "material_cost",
        categoryName: "Material cost",
        reviewStatus: "auto_confident",
        sortOrder: 0,
        sourceReference: {},
      }],
      evidenceRequirements: [{
        categoryKey: "material_cost",
        documentKey: "receipt",
        evidenceKey: "receipt",
        evidenceName: "Receipt",
        fulfillmentType: "single",
        requirementType: "required",
        reviewStatus: "auto_confident",
        sourceReference: {},
        subcategoryKey: "equipment",
      }],
      subcategories: [{
        categoryKey: "material_cost",
        reviewStatus: "needs_admin_review",
        sortOrder: 0,
        sourceReference: {},
        subcategoryKey: "equipment",
        subcategoryName: "Equipment",
      }],
    });

    expect(errors).toContain("Subcategory requires admin review: equipment");
    expect(errors).not.toContain("Category source reference is required: material_cost");
    expect(errors).not.toContain("Subcategory source reference is required: equipment");
    expect(errors).not.toContain("Evidence source reference is required: receipt");
  });

  it("creates a conservative draft from text-layer policy text", () => {
    const draft = parseTextDraft(
      [
        "사업비 비목",
        "1. 재료비",
        "증빙서류: 세금계산서, 거래명세서, 검수확인서",
        "2. 외주용역비",
        "증빙서류: 계약서, 견적서, 결과보고서",
      ].join("\n"),
      "policy.pdf",
    );

    expect(draft?.categories).toHaveLength(2);
    expect(draft?.evidenceRequirements.length).toBeGreaterThanOrEqual(2);
    expect(draft?.categories[0]?.reviewStatus).toBe("needs_admin_review");
    expect(draft?.categories[0]?.sourceReference).toEqual({});
    expect(draft?.evidenceRequirements[0]?.categoryKey).toBe(draft?.categories[0]?.categoryKey);
  });

  it("rejects text that does not meet the V1 draft threshold", () => {
    const draft = parseTextDraft("재료비\n증빙서류: 영수증", "policy.pdf");

    expect(draft).toBeNull();
  });
});
