import { describe, expect, it } from "vitest";
import { parseTextDraft, toStablePolicyKey, validateDraftBlockingErrors, validateDraftStructuralErrors } from "./service";

describe("program evidence policy service helpers", () => {
  it("creates deterministic ASCII fallback keys for non-ASCII labels", () => {
    expect(toStablePolicyKey("材料費", "category")).toMatch(/^category_[a-f0-9]{8}$/);
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

  it("creates a draft from policy table rows without subcategories", () => {
    const draft = parseTextDraft(
      [
        "budget_item\tevidence_documents",
        "material_cost\t1. Payment request |LINE| 2. Tax invoice |LINE| 3. Transaction statement",
        "outsourcing\t1. Payment request |LINE| 2. Contract |LINE| 3. Quote",
        "fees\t- common required |LINE| 1. Payment request |LINE| 2. Tax invoice |LINE| - tech transfer |LINE| 1. Tech transfer contract",
      ].join("\n"),
      "policy.pdf",
    );

    expect(draft?.categories.map((category) => category.categoryName)).toEqual(["material_cost", "outsourcing", "fees"]);
    expect(draft?.subcategories).toEqual([]);
    expect(draft?.evidenceRequirements.length).toBe(9);
    expect(draft?.categories[0]?.reviewStatus).toBe("needs_admin_review");
    expect(draft?.categories[0]?.sourceReference).toEqual({});
    expect(draft?.evidenceRequirements[0]?.categoryKey).toBe(draft?.categories[0]?.categoryKey);
    expect(draft?.categories.some((category) => category.categoryName.includes("tech transfer"))).toBe(false);
  });

  it("keeps unnumbered wrapped evidence text with the previous numbered item", () => {
    const draft = parseTextDraft(
      [
        "budget_item\tevidence_documents",
        "material_cost\t1. Payment request |LINE| statement continuation |LINE| 2. Tax invoice",
        "outsourcing\t1. Contract |LINE| 2. Quote",
      ].join("\n"),
      "policy.pdf",
    );

    expect(draft?.evidenceRequirements.map((evidence) => evidence.evidenceName)).toContain("Payment request (statement continuation)");
    expect(draft?.evidenceRequirements.map((evidence) => evidence.evidenceName)).toContain("Tax invoice");
  });

  it("merges split category labels when a continued table row starts from the second evidence item", () => {
    const draft = parseTextDraft(
      [
        "budget_item\tevidence_documents",
        "intellectual_property\t1. Tax invoice",
        "asset_acquisition\t2. Transaction statement |LINE| 3. Contract",
        "payroll\t1. Payroll ledger |LINE| 2. Transfer confirmation",
      ].join("\n"),
      "policy.pdf",
    );

    expect(draft?.categories.map((category) => category.categoryName)).toEqual(["intellectual_property asset_acquisition", "payroll"]);
    expect(draft?.evidenceRequirements.filter((evidence) => evidence.categoryKey === draft?.categories[0]?.categoryKey)).toHaveLength(3);
  });

  it("rejects text that does not have policy table rows", () => {
    const draft = parseTextDraft("material_cost\nevidence: receipt", "policy.pdf");

    expect(draft).toBeNull();
  });
});
