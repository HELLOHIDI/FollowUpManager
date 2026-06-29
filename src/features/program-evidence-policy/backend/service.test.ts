import { describe, expect, it } from "vitest";
import { toStablePolicyKey, validateDraftBlockingErrors } from "./service";

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

  it("requires source references and reviewed subcategories before confirmation", () => {
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

    expect(errors).toContain("Category source reference is required: material_cost");
    expect(errors).toContain("Subcategory requires admin review: equipment");
    expect(errors).toContain("Subcategory source reference is required: equipment");
    expect(errors).toContain("Evidence source reference is required: receipt");
  });
});
