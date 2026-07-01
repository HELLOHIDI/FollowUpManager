import { describe, expect, it } from "vitest";
import { parseTextDraft, resolvePolicyCategories, toStablePolicyKey, validateDraftBlockingErrors, validateDraftStructuralErrors } from "./service";

const clientForPolicyCategoryFallback = () => {
  const selects: string[] = [];
  const dataByTable: Record<string, unknown> = {
    budget_category_policy_templates: [
      { category_key: "material_cost", category_name: "Materials" },
    ],
    program_policy_versions: [
      {
        confirmed_at: null,
        confirmed_by: null,
        confirmed_summary: {},
        created_at: "2026-07-01T00:00:00.000Z",
        extraction_failure_reason: null,
        extraction_status: "succeeded",
        id: "22222222-2222-4222-8222-222222222222",
        operation_status: "draft_needs_review",
        project_id: "11111111-1111-4111-8111-111111111111",
        status: "needs_review",
        version_number: 1,
      },
    ],
    project_budget_categories: [
      { category_key: "material_cost" },
    ],
    projects: {
      company_id: "33333333-3333-4333-8333-333333333333",
      confirmed_policy_version_id: null,
      id: "11111111-1111-4111-8111-111111111111",
    },
  };

  const client = {
    from: (table: string) => {
      const chain: any = {
        eq: () => chain,
        is: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: dataByTable[table], error: null }),
        order: () => chain,
        select: (columns: string) => {
          selects.push(columns);
          return chain;
        },
        then: (resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason?: unknown) => unknown) =>
          Promise.resolve({ data: dataByTable[table] ?? [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  };

  return { client: client as any, selects };
};

describe("program evidence policy service helpers", () => {
  it("creates deterministic ASCII fallback keys when labels sanitize empty", () => {
    expect(toStablePolicyKey("!!!!", "category")).toMatch(/^category_[a-f0-9]{8}$/);
    expect(toStablePolicyKey("Material Cost", "category")).toBe("material_cost");
  });

  it("resolves fallback categories without relying on missing PostgREST relationships", async () => {
    const { client, selects } = clientForPolicyCategoryFallback();

    const result = await resolvePolicyCategories(client, "11111111-1111-4111-8111-111111111111");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(selects).not.toContain("category_key, budget_category_policy_templates(category_name)");
    expect(result.data.categories).toEqual([
      {
        categoryKey: "material_cost",
        categoryName: "Materials",
        sortOrder: 0,
        subcategories: [],
      },
    ]);
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

  it("validates custom accepted document lists for each evidence requirement", () => {
    const errors = validateDraftStructuralErrors({
      categories: [{
        categoryKey: "material_cost",
        categoryName: "Material cost",
        reviewStatus: "auto_confident",
        sortOrder: 0,
        sourceReference: { page: 1 },
      }],
      evidenceRequirements: [{
        acceptedDocuments: [
          { documentKey: "receipt", label: "Receipt" },
          { documentKey: "receipt", label: "Receipt duplicate" },
        ],
        categoryKey: "material_cost",
        documentKey: "receipt",
        evidenceKey: "payment_bundle",
        evidenceName: "Payment bundle",
        fulfillmentType: "all_of",
        requirementType: "required",
        reviewStatus: "auto_confident",
        sourceReference: { page: 1 },
      }, {
        acceptedDocuments: [
          { documentKey: "invoice", label: "Tax invoice" },
        ],
        categoryKey: "material_cost",
        documentKey: "invoice",
        evidenceKey: "invoice_bundle",
        evidenceName: "Invoice bundle",
        fulfillmentType: "all_of",
        requirementType: "required",
        reviewStatus: "auto_confident",
        sourceReference: { page: 1 },
      }],
      subcategories: [],
    });

    expect(errors).toEqual([
      "Duplicate accepted document key: payment_bundle/receipt",
      "all_of evidence requires at least two accepted documents: invoice_bundle",
    ]);
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
    expect(draft?.evidenceRequirements[0]?.acceptedDocuments).toEqual([
      expect.objectContaining({
        documentKey: draft?.evidenceRequirements[0]?.documentKey,
        label: draft?.evidenceRequirements[0]?.evidenceName,
      }),
    ]);
    expect(draft?.categories.some((category) => category.categoryName.includes("tech transfer"))).toBe(false);
  });

  it("extracts bullet evidence groups as common evidence and one-level subcategories", () => {
    const draft = parseTextDraft(
      [
        "budget_item\tevidence_documents",
        [
          "fees\t",
          "\u2022\uACF5\uD1B5(\uD544\uC218)",
          " |LINE| \u2460 Payment request",
          " |LINE| \u2461 Tax invoice",
          " |LINE| \u2022Tech transfer",
          " |LINE| \u2460 Tech summary",
          " |LINE| \u2461 Transfer contract",
        ].join(""),
        "payroll\t1. Payroll ledger |LINE| 2. Transfer confirmation",
      ].join("\n"),
      "policy.pdf",
    );

    const fees = draft?.categories.find((category) => category.categoryName === "fees");
    const techTransfer = draft?.subcategories.find((subcategory) => subcategory.subcategoryName === "Tech transfer");
    const feesEvidence = draft?.evidenceRequirements.filter((evidence) => evidence.categoryKey === fees?.categoryKey);

    expect(draft?.categories.map((category) => category.categoryName)).toEqual(["fees", "payroll"]);
    expect(techTransfer?.categoryKey).toBe(fees?.categoryKey);
    expect(feesEvidence?.filter((evidence) => evidence.subcategoryKey === null).map((evidence) => evidence.evidenceName)).toEqual([
      "Payment request",
      "Tax invoice",
    ]);
    expect(feesEvidence?.filter((evidence) => evidence.subcategoryKey === techTransfer?.subcategoryKey).map((evidence) => evidence.evidenceName)).toEqual([
      "Tech summary",
      "Transfer contract",
    ]);
  });

  it("extracts table section labels as common evidence and one-level subcategories", () => {
    const draft = parseTextDraft(
      [
        "budget_item\tevidence_documents",
        [
          "fees\t",
          "\uACF5\uD1B5\uC81C\uCD9C\uC11C\uB958",
          " |LINE| (\uD544\uC218)",
          " |LINE| \u2460 Payment request",
          " |LINE| \u2461 Tax invoice",
          " |LINE| \uBE44\uBAA9 \uC99D\uBE59\uC11C\uB958",
          " |LINE| Tech",
          " |LINE| transfer fee",
          " |LINE| \u2460 Tech summary",
          " |LINE| \u2461 Transfer contract",
          " |LINE| Seminar",
          " |LINE| fee",
          " |LINE| \u2460 Seminar catalog",
          " |LINE| Insurance fee \u2460 Insurance policy",
        ].join(""),
        "payroll\t1. Payroll ledger |LINE| 2. Transfer confirmation",
      ].join("\n"),
      "policy.pdf",
    );

    const fees = draft?.categories.find((category) => category.categoryName === "fees");
    const techTransfer = draft?.subcategories.find((subcategory) => subcategory.subcategoryName === "Tech transfer fee");
    const seminar = draft?.subcategories.find((subcategory) => subcategory.subcategoryName === "Seminar fee");
    const insurance = draft?.subcategories.find((subcategory) => subcategory.subcategoryName === "Insurance fee");
    const feesEvidence = draft?.evidenceRequirements.filter((evidence) => evidence.categoryKey === fees?.categoryKey);

    expect(draft?.subcategories.map((subcategory) => subcategory.subcategoryName)).toEqual(["Tech transfer fee", "Seminar fee", "Insurance fee"]);
    expect(techTransfer?.categoryKey).toBe(fees?.categoryKey);
    expect(seminar?.categoryKey).toBe(fees?.categoryKey);
    expect(insurance?.categoryKey).toBe(fees?.categoryKey);
    expect(feesEvidence?.filter((evidence) => evidence.subcategoryKey === null).map((evidence) => evidence.evidenceName)).toEqual([
      "Payment request",
      "Tax invoice",
    ]);
    expect(feesEvidence?.filter((evidence) => evidence.subcategoryKey === techTransfer?.subcategoryKey).map((evidence) => evidence.evidenceName)).toEqual([
      "Tech summary",
      "Transfer contract",
    ]);
    expect(feesEvidence?.filter((evidence) => evidence.subcategoryKey === seminar?.subcategoryKey).map((evidence) => evidence.evidenceName)).toEqual([
      "Seminar catalog",
    ]);
    expect(feesEvidence?.filter((evidence) => evidence.subcategoryKey === insurance?.subcategoryKey).map((evidence) => evidence.evidenceName)).toEqual([
      "Insurance policy",
    ]);
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

  it("stores and can apply evidence sort order from PDF numbering markers", () => {
    const draft = parseTextDraft(
      [
        "budget_item\tevidence_documents",
        "material_cost\t\u2460 Payment request |LINE| \u2462 Transaction statement |LINE| \u2461 Tax invoice",
        "outsourcing\t1. Contract |LINE| 2. Quote",
      ].join("\n"),
      "policy.pdf",
    );

    const materialEvidence = draft?.evidenceRequirements.filter((evidence) => evidence.categoryKey === draft.categories[0]?.categoryKey);
    const outsourcingEvidence = draft?.evidenceRequirements.filter((evidence) => evidence.categoryKey === draft.categories[1]?.categoryKey);

    expect(materialEvidence?.map((evidence) => [evidence.evidenceName, evidence.sortOrder])).toEqual([
      ["Payment request", 0],
      ["Transaction statement", 2],
      ["Tax invoice", 1],
    ]);
    expect(outsourcingEvidence?.map((evidence) => [evidence.evidenceName, evidence.sortOrder])).toEqual([
      ["Contract", 0],
      ["Quote", 1],
    ]);
    expect(
      [...(materialEvidence ?? [])]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((evidence) => evidence.evidenceName),
    ).toEqual(["Payment request", "Tax invoice", "Transaction statement"]);
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
