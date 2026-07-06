import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { createExpense, filterPolicyEvidenceRows, getExpenseDetail, getExpenseHistory, listExpenseEvidence, listProjectExpensesPage, relinkExpenseEvidence, updateExpense, updateExpenseStage, uploadExpenseEvidence } from "./service";

const PROJECT_ID = "10000000-0000-4000-8000-000000000002";
const CATEGORY_ID = "10000000-0000-4000-8000-000000000003";
const EXPENSE_ID = "44444444-4444-4444-8444-444444444444";

type ChainResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

type TableResult = {
  select?: ChainResult;
  insert?: ChainResult;
  update?: ChainResult;
};

type RpcResult = Record<string, ChainResult>;

const baseExpenseRow = (overrides: Record<string, unknown> = {}) => ({
  id: EXPENSE_ID,
  project_id: PROJECT_ID,
  project_budget_category_id: CATEGORY_ID,
  category_key: "material_cost",
  title: "sample expense",
  amount: 300,
  stage_key: "budget_registration",
  expected_spend_date: null,
  funding_source_key: "government_subsidy",
  vendor_name: null,
  memo: null,
  pre_approval_status: null,
  execution_progress_status: null,
  execution_request_status: null,
  execution_request_date: null,
  stage_fields: {},
  deleted_at: null,
  ...overrides,
});

type ChainCall = {
  method: "eq" | "is";
  mode: "select" | "insert" | "update";
  args: unknown[];
};

const buildChain = (result: TableResult, calls: ChainCall[] = []) => {
  let mode: "select" | "insert" | "update" = "select";
  const chain: any = {
    select: () => chain,
    insert: () => {
      mode = "insert";
      return chain;
    },
    update: () => {
      mode = "update";
      return chain;
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", mode, args });
      return chain;
    },
    is: (...args: unknown[]) => {
      calls.push({ method: "is", mode, args });
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () =>
      (mode === "insert" ? result.insert ?? result.select : mode === "update" ? result.update ?? result.select : result.select) ?? { data: null },
    single: async () =>
      (mode === "insert" ? result.insert ?? result.select : mode === "update" ? result.update ?? result.select : result.select) ?? { data: null },
    then: (resolve: (value: ChainResult) => unknown, reject?: (reason?: unknown) => unknown) =>
      Promise.resolve((mode === "insert" ? result.insert ?? result.select : mode === "update" ? result.update ?? result.select : result.select) ?? { data: [] }).then(resolve, reject),
  };
  return chain;
};

const clientFor = (results: Record<string, TableResult>) =>
  ({
    from: (table: string) => buildChain(results[table] ?? { select: { data: [] } }),
    rpc: (name: string) => Promise.resolve({ data: null, ...(results[`rpc:${name}`]?.select ?? {}) }),
  }) as unknown as import("@supabase/supabase-js").SupabaseClient<Database>;

const clientForWithCalls = (results: Record<string, TableResult>, rpcResults: RpcResult = {}) => {
  const tables: string[] = [];
  const chainCalls: ChainCall[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const client = {
    from: (table: string) => {
      tables.push(table);
      return buildChain(results[table] ?? { select: { data: [] } }, chainCalls);
    },
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ args, name });
      return Promise.resolve(rpcResults[name] ?? { data: null });
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient<Database>;

  return { chainCalls, client, rpcCalls, tables };
};

const clientForMissingFundingSourceColumn = (rpcData: unknown = null) => {
  const expenseSelects: string[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const client = {
    from: (table: string) => {
      if (table === "budget_category_policy_templates") {
        return buildChain({
          select: {
            data: [{ category_key: "material_cost", category_name: "Materials" }],
          },
        });
      }

      let selectedColumns = "";
      const chain: any = {
        select: (columns: string) => {
          selectedColumns = columns;
          expenseSelects.push(columns);
          return chain;
        },
        eq: () => chain,
        maybeSingle: async () => {
          if (selectedColumns.includes("funding_source_key")) {
            return {
              data: null,
              error: {
                code: "PGRST204",
                message: "Could not find the 'funding_source_key' column of 'expenses' in the schema cache",
              },
            };
          }

          return { data: baseExpenseRow({ funding_source_key: undefined }) };
        },
      };
      return chain;
    },
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ args, name });
      return Promise.resolve({ data: rpcData, error: null });
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient<Database>;

  return { client, expenseSelects, rpcCalls };
};

const fullUpdateInput = {
  amount: 300,
  categoryKey: "material_cost",
  executionProgressStatus: null,
  executionRequestDate: null,
  executionRequestStatus: null,
  expectedSpendDate: null,
  fundingSourceKey: "self_cash",
  memo: null,
  preApprovalStatus: null,
  stageFields: {},
  title: "sample expense",
  vendorName: null,
} as const;

const policySnapshot = {
  category_key: "material_cost",
  category_name: "Materials",
  evidence_requirements: [
    {
      accepted_documents: [
        { documentKey: "receipt", label: "Receipt" },
        { documentKey: "transfer_confirm", label: "Transfer confirmation" },
      ],
      condition_text: null,
      document_key: "receipt",
      evidence_key: "payment_bundle",
      evidence_name: "Payment bundle",
      fulfillment_type: "all_of",
      requirement_type: "required",
      sort_order: 0,
      source_reference: {},
    },
  ],
};

describe("expense service", () => {
  it("filters policy evidence snapshots to common, selected category, and selected subcategory rows", () => {
    const rows = [
      { category_id: null, condition_text: null, document_key: "common", evidence_key: "common", evidence_name: "Common", fulfillment_type: "single", requirement_type: "required", sort_order: 0, source_reference: {}, subcategory_id: null },
      { category_id: "cat-1", condition_text: null, document_key: "category_second", evidence_key: "category_second", evidence_name: "Category second", fulfillment_type: "single", requirement_type: "required", sort_order: 1, source_reference: {}, subcategory_id: null },
      { category_id: "cat-1", condition_text: null, document_key: "category_first", evidence_key: "category_first", evidence_name: "Category first", fulfillment_type: "single", requirement_type: "required", sort_order: 0, source_reference: {}, subcategory_id: null },
      { category_id: "cat-1", condition_text: null, document_key: "sub", evidence_key: "sub", evidence_name: "Sub", fulfillment_type: "single", requirement_type: "required", sort_order: 0, source_reference: {}, subcategory_id: "sub-1" },
      { category_id: "cat-1", condition_text: null, document_key: "other_sub", evidence_key: "other_sub", evidence_name: "Other sub", fulfillment_type: "single", requirement_type: "required", sort_order: 0, source_reference: {}, subcategory_id: "sub-2" },
      { category_id: "cat-2", condition_text: null, document_key: "other_cat", evidence_key: "other_cat", evidence_name: "Other cat", fulfillment_type: "single", requirement_type: "required", sort_order: 0, source_reference: {}, subcategory_id: null },
    ];

    expect(filterPolicyEvidenceRows(rows, "cat-1", "sub-1").map((row) => row.evidence_key)).toEqual(["common", "category_first", "category_second", "sub"]);
    expect(filterPolicyEvidenceRows(rows, "cat-1", null).map((row) => row.evidence_key)).toEqual(["common", "category_first", "category_second"]);
  });

  it("lists grouped expense rows and template-based category options", async () => {
    const result = await listProjectExpensesPage(
      clientFor({
        projects: { select: { data: { id: PROJECT_ID, project_name: "Project", deleted_at: null } } },
        budget_category_policy_templates: {
          select: {
            data: [{ category_key: "material_cost", category_name: "Materials" }],
          },
        },
        project_expenses_by_category: {
          select: {
            data: [
              {
                category_key: "material_cost",
                category_name: "Materials",
                sort_order: 1,
                expense_id: "22222222-2222-4222-8222-222222222222",
                title: "sample expense",
                amount: 300,
                stage_key: "budget_registration",
              },
              {
                category_key: "material_cost",
                category_name: "Materials",
                sort_order: 1,
                expense_id: "33333333-3333-4333-8333-333333333333",
                title: "second expense",
                amount: 200,
                stage_key: "execution_completed",
              },
            ],
          },
        },
        expenses: { select: { count: 2, data: [] } },
      }),
      PROJECT_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.project.name).toBe("Project");
    expect(result.data.categoryOptions).toEqual([
      {
        categoryKey: "material_cost",
        categoryName: "Materials",
        sortOrder: 0,
        subcategories: [],
      },
    ]);
    expect(result.data.fundingSourceOptions.map((option) => option.fundingSourceKey)).toEqual([
      "government_subsidy",
      "self_cash",
      "self_in_kind",
    ]);
    expect(result.data.categories[0]).toMatchObject({
      categoryKey: "material_cost",
      categoryName: "Materials",
      expenseCount: 2,
      totalAmount: 500,
    });
  });

  it("creates an expense through the policy-locked RPC", async () => {
    const { client, rpcCalls } = clientForWithCalls({}, {
      create_expense_with_policy_lock: { data: baseExpenseRow() },
    });

    const result = await createExpense(client, PROJECT_ID, {
      title: "sample expense",
      categoryKey: "material_cost",
      fundingSourceKey: "government_subsidy",
      amount: 300,
      expectedSpendDate: null,
      memo: null,
    });

    expect(result.ok).toBe(true);
    expect(rpcCalls[0]).toEqual({
      name: "create_expense_with_policy_lock",
      args: expect.objectContaining({
        p_amount: 300,
        p_category_key: "material_cost",
        p_project_id: PROJECT_ID,
        p_subcategory_key: null,
      }),
    });
    if (!result.ok) return;
    expect(result.data.stageKey).toBe("budget_registration");
    expect(result.data.projectBudgetCategoryId).toBe(CATEGORY_ID);
    expect(result.data.fundingSourceKey).toBe("government_subsidy");
  });

  it("rejects unavailable category keys", async () => {
    const result = await createExpense(
      clientFor({
        "rpc:create_expense_with_policy_lock": {
          select: {
            error: { code: "P0001", message: "EXPENSE_CATEGORY_UNAVAILABLE" },
          },
        },
      }),
      PROJECT_ID,
      {
        title: "sample expense",
        categoryKey: "material_cost",
        fundingSourceKey: "government_subsidy",
        amount: 300,
        expectedSpendDate: null,
        memo: null,
      },
    );

    expect(result.ok).toBe(false);
    if (!("error" in result)) return;
    expect(result.error.code).toBe("EXPENSE_CATEGORY_MISMATCH");
  });

  it("rejects confirmed-policy categories with subcategories when subcategory is missing", async () => {
    const result = await createExpense(
      clientFor({
        "rpc:create_expense_with_policy_lock": {
          select: {
            error: { code: "P0001", message: "EXPENSE_CATEGORY_UNAVAILABLE" },
          },
        },
      }),
      PROJECT_ID,
      {
        title: "sample expense",
        categoryKey: "material_cost",
        subcategoryKey: null,
        fundingSourceKey: "government_subsidy",
        amount: 300,
        expectedSpendDate: null,
        memo: null,
      },
    );

    expect(result.ok).toBe(false);
    if (!("error" in result)) return;
    expect(result.error.code).toBe("EXPENSE_CATEGORY_MISMATCH");
  });

  it("loads and updates expense funding source", async () => {
    const detail = await getExpenseDetail(
      clientFor({
        expenses: {
          select: {
            data: baseExpenseRow(),
          },
        },
        budget_category_policy_templates: {
          select: {
            data: [{ category_key: "material_cost", category_name: "Materials" }],
          },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
    );

    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.data.fundingSourceKey).toBe("government_subsidy");

    const updated = await updateExpense(
      clientFor({
        expenses: {
          select: {
            data: baseExpenseRow(),
          },
        },
        project_budget_categories: {
          select: { data: { id: CATEGORY_ID, deleted_at: null, is_active: true } },
        },
        "rpc:update_expense_with_history": {
          select: {
            data: baseExpenseRow({ funding_source_key: "self_cash" }),
          },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
      fullUpdateInput,
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.fundingSourceKey).toBe("self_cash");
  });

  it("falls back to a direct expense update when the update RPC is not available", async () => {
    const { chainCalls, client, rpcCalls } = clientForWithCalls({
      expenses: {
        select: { data: baseExpenseRow() },
        update: { data: baseExpenseRow({ amount: 500, funding_source_key: "self_cash" }) },
      },
      project_budget_categories: {
        select: { data: { id: CATEGORY_ID, deleted_at: null, is_active: true } },
      },
    }, {
      update_expense_with_history: {
        error: { code: "PGRST202", message: "function not found" },
      },
    });

    const updated = await updateExpense(client, PROJECT_ID, EXPENSE_ID, {
      ...fullUpdateInput,
      amount: 500,
      fundingSourceKey: "self_cash",
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.amount).toBe(500);
    expect(updated.data.fundingSourceKey).toBe("self_cash");
    expect(rpcCalls).toContainEqual(expect.objectContaining({ name: "update_expense_with_history" }));
    expect(chainCalls).toContainEqual({ method: "is", mode: "update", args: ["deleted_at", null] });
  });

  it("loads expense detail with a default funding source when the DB has not applied the funding source column yet", async () => {
    const { client, expenseSelects } = clientForMissingFundingSourceColumn();

    const detail = await getExpenseDetail(client, PROJECT_ID, EXPENSE_ID);

    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(expenseSelects[0]).toContain("funding_source_key");
    expect(expenseSelects[1]).not.toContain("funding_source_key");
    expect(detail.data.fundingSourceKey).toBe("government_subsidy");
  });

  it("updates an expense stage when the DB has not applied the funding source column yet", async () => {
    const { client, expenseSelects, rpcCalls } = clientForMissingFundingSourceColumn(
      baseExpenseRow({ funding_source_key: undefined, stage_key: "pre_approval" }),
    );

    const result = await updateExpenseStage(client, PROJECT_ID, EXPENSE_ID, {
      targetStageKey: "pre_approval",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(expenseSelects).toHaveLength(2);
    expect(expenseSelects[0]).toContain("funding_source_key");
    expect(expenseSelects[1]).not.toContain("funding_source_key");
    expect(result.data.stageKey).toBe("pre_approval");
    expect(result.data.fundingSourceKey).toBe("government_subsidy");
    expect(rpcCalls).toContainEqual({
      name: "update_expense_stage_with_history",
      args: {
        p_changed_by: null,
        p_current_stage_key: "budget_registration",
        p_expense_id: EXPENSE_ID,
        p_project_id: PROJECT_ID,
        p_target_stage_key: "pre_approval",
      },
    });
  });

  it("updates an expense stage only to the immediate next stage", async () => {
    const { client, rpcCalls, tables } = clientForWithCalls({
      expenses: {
        select: {
          data: baseExpenseRow(),
        },
      },
    }, {
      update_expense_stage_with_history: {
        data: baseExpenseRow({ stage_key: "pre_approval", deleted_at: undefined }),
      },
    });

    const result = await updateExpenseStage(client, PROJECT_ID, EXPENSE_ID, {
      targetStageKey: "pre_approval",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.stageKey).toBe("pre_approval");
    expect(tables).toEqual(["expenses"]);
    expect(tables).not.toContain("expense_history_events");
    expect(rpcCalls).toContainEqual({
      name: "update_expense_stage_with_history",
      args: {
        p_changed_by: null,
        p_current_stage_key: "budget_registration",
        p_expense_id: EXPENSE_ID,
        p_project_id: PROJECT_ID,
        p_target_stage_key: "pre_approval",
      },
    });
  });

  it("rejects non-immediate expense stage movement", async () => {
    const result = await updateExpenseStage(
      clientFor({
        expenses: {
          select: {
            data: baseExpenseRow(),
          },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
      { targetStageKey: "execution_in_progress" },
    );

    expect(result.ok).toBe(false);
    if (!("error" in result)) return;
    expect(result.error.code).toBe("INVALID_EXPENSE_STAGE_TRANSITION");
  });

  it("returns a generic fetch error when the expense stage update fails", async () => {
    const result = await updateExpenseStage(
      clientFor({
        expenses: {
          select: {
            data: baseExpenseRow(),
          },
        },
        "rpc:update_expense_stage_with_history": {
          select: { data: null, error: new Error("stage cap") },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
      { targetStageKey: "pre_approval" },
    );

    expect(result.ok).toBe(false);
    if (!("error" in result)) return;
    expect(result.error.code).toBe("EXPENSES_FETCH_ERROR");
  });

  it("returns a stage transition conflict when the stage RPC detects stale state", async () => {
    const result = await updateExpenseStage(
      clientFor({
        expenses: {
          select: {
            data: baseExpenseRow(),
          },
        },
        "rpc:update_expense_stage_with_history": {
          select: {
            data: null,
            error: { code: "P0002", message: "EXPENSE_NOT_FOUND_OR_STALE_STAGE" },
          },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
      { targetStageKey: "pre_approval" },
    );

    expect(result.ok).toBe(false);
    if (!("error" in result)) return;
    expect(result.error.code).toBe("INVALID_EXPENSE_STAGE_TRANSITION");
  });

  it("returns recent expense history in read-only order", async () => {
    const result = await getExpenseHistory(
      clientFor({
        expenses: {
          select: { data: { id: EXPENSE_ID, deleted_at: null } },
        },
        expense_history_events: {
          select: {
            data: [
              {
                after_value: { stageKey: "pre_approval" },
                before_value: { stageKey: "budget_registration" },
                changed_at: "2026-06-24T00:00:00.000Z",
                changed_by: null,
                event_type: "stage_changed",
                expense_id: EXPENSE_ID,
                id: "55555555-5555-4555-8555-555555555555",
                summary: "단계가 변경되었습니다.",
              },
            ],
          },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.events[0]).toMatchObject({
      eventType: "stage_changed",
      expenseId: EXPENSE_ID,
      summary: "단계가 변경되었습니다.",
    });
  });

  it("lists active expense evidence and marks possible duplicates without blocking", async () => {
    const result = await listExpenseEvidence(
      clientFor({
        projects: {
          select: { data: { id: PROJECT_ID, company_id: "10000000-0000-4000-8000-000000000001", deleted_at: null } },
        },
        expenses: {
          select: { data: { id: EXPENSE_ID, project_id: PROJECT_ID, deleted_at: null } },
        },
        expense_evidence_files: {
          select: {
            data: [
              {
                deleted_at: null,
                document_key: "tax_invoice",
                expense_id: EXPENSE_ID,
                file_extension: "pdf",
                file_size: 1024,
                id: "55555555-5555-4555-8555-555555555555",
                mime_type: "application/pdf",
                original_file_name: "invoice.pdf",
                project_id: PROJECT_ID,
                requirement_key: null,
                storage_path: "companies/company/projects/project/expenses/expense/tax_invoice/file.pdf",
                uploaded_at: "2026-06-25T00:00:00.000Z",
              },
              {
                deleted_at: null,
                document_key: "tax_invoice",
                expense_id: EXPENSE_ID,
                file_extension: "pdf",
                file_size: 1024,
                id: "66666666-6666-4666-8666-666666666666",
                mime_type: "application/pdf",
                original_file_name: "invoice.pdf",
                project_id: PROJECT_ID,
                requirement_key: null,
                storage_path: "companies/company/projects/project/expenses/expense/tax_invoice/file-2.pdf",
                uploaded_at: "2026-06-25T00:01:00.000Z",
              },
            ],
          },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.files).toHaveLength(2);
    expect(result.data.files.map((file) => file.duplicateStatus)).toEqual(["possible_duplicate", "possible_duplicate"]);
  });

  it("builds policy-backed evidence requirements and keeps unmatched files unclassified", async () => {
    const result = await listExpenseEvidence(
      clientFor({
        projects: {
          select: { data: { id: PROJECT_ID, company_id: "10000000-0000-4000-8000-000000000001", deleted_at: null } },
        },
        expenses: {
          select: { data: baseExpenseRow({ policy_snapshot: policySnapshot, policy_version_id: "77777777-7777-4777-8777-777777777777" }) },
        },
        expense_evidence_files: {
          select: {
            data: [
              {
                deleted_at: null,
                document_key: "receipt",
                expense_id: EXPENSE_ID,
                file_extension: "pdf",
                file_size: 1024,
                id: "55555555-5555-4555-8555-555555555555",
                mime_type: "application/pdf",
                original_file_name: "receipt.pdf",
                project_id: PROJECT_ID,
                requirement_key: "payment_bundle",
                storage_path: "companies/company/projects/project/expenses/expense/receipt/file.pdf",
                uploaded_at: "2026-06-25T00:00:00.000Z",
              },
              {
                deleted_at: null,
                document_key: "legacy_misc",
                expense_id: EXPENSE_ID,
                file_extension: "pdf",
                file_size: 512,
                id: "66666666-6666-4666-8666-666666666666",
                mime_type: "application/pdf",
                original_file_name: "legacy.pdf",
                project_id: PROJECT_ID,
                requirement_key: null,
                storage_path: "companies/company/projects/project/expenses/expense/legacy/file.pdf",
                uploaded_at: "2026-06-25T00:01:00.000Z",
              },
            ],
          },
        },
        expense_evidence_requirement_statuses: {
          select: { data: [] },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.policySnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.data.requirements).toEqual([
      expect.objectContaining({
        acceptedDocuments: [
          expect.objectContaining({ documentKey: "receipt", uploaded: true }),
          expect.objectContaining({ documentKey: "transfer_confirm", uploaded: false }),
        ],
        fulfillmentType: "all_of",
        requirementKey: "payment_bundle",
        status: "not_uploaded",
      }),
    ]);
    expect(result.data.unclassifiedFiles.map((file) => file.id)).toEqual(["66666666-6666-4666-8666-666666666666"]);
  });

  it("rejects uploads when the selected document is not accepted by the policy requirement", async () => {
    const result = await uploadExpenseEvidence(
      clientFor({
        projects: {
          select: { data: { id: PROJECT_ID, company_id: "10000000-0000-4000-8000-000000000001", deleted_at: null } },
        },
        expenses: {
          select: { data: baseExpenseRow({ policy_snapshot: policySnapshot }) },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
      null,
      {
        browserMimeType: "application/pdf",
        documentKey: "not_allowed",
        file: {
          arrayBuffer: async () => new ArrayBuffer(0),
          name: "bad.pdf",
          size: 10,
          type: "application/pdf",
        },
        fileSize: 10,
        originalFileName: "bad.pdf",
        requirementKey: "payment_bundle",
      },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "EXPENSE_EVIDENCE_STATE_CONFLICT" },
    });
  });

  it("relinks an unclassified evidence file by updating only evidence metadata", async () => {
    const result = await relinkExpenseEvidence(
      clientFor({
        projects: {
          select: { data: { id: PROJECT_ID, company_id: "10000000-0000-4000-8000-000000000001", deleted_at: null } },
        },
        expenses: {
          select: { data: baseExpenseRow({ policy_snapshot: policySnapshot }) },
        },
        expense_evidence_files: {
          select: {
            data: {
              deleted_at: null,
              document_key: "legacy_misc",
              expense_id: EXPENSE_ID,
              file_extension: "pdf",
              file_size: 512,
              id: "66666666-6666-4666-8666-666666666666",
              mime_type: "application/pdf",
              original_file_name: "legacy.pdf",
              project_id: PROJECT_ID,
              requirement_key: null,
              storage_path: "companies/company/projects/project/expenses/expense/legacy/file.pdf",
              uploaded_at: "2026-06-25T00:01:00.000Z",
            },
          },
          update: {
            data: {
              deleted_at: null,
              document_key: "receipt",
              expense_id: EXPENSE_ID,
              file_extension: "pdf",
              file_size: 512,
              id: "66666666-6666-4666-8666-666666666666",
              mime_type: "application/pdf",
              original_file_name: "legacy.pdf",
              project_id: PROJECT_ID,
              requirement_key: "payment_bundle",
              storage_path: "companies/company/projects/project/expenses/expense/legacy/file.pdf",
              uploaded_at: "2026-06-25T00:01:00.000Z",
            },
          },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
      "66666666-6666-4666-8666-666666666666",
      null,
      { documentKey: "receipt", requirementKey: "payment_bundle" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      documentKey: "receipt",
      id: "66666666-6666-4666-8666-666666666666",
      requirementKey: "payment_bundle",
    });
  });

  it("fails relinking when audit history cannot be recorded", async () => {
    const result = await relinkExpenseEvidence(
      clientFor({
        projects: {
          select: { data: { id: PROJECT_ID, company_id: "10000000-0000-4000-8000-000000000001", deleted_at: null } },
        },
        expenses: {
          select: { data: baseExpenseRow({ policy_snapshot: policySnapshot }) },
        },
        expense_evidence_files: {
          select: {
            data: {
              deleted_at: null,
              document_key: "legacy_misc",
              expense_id: EXPENSE_ID,
              file_extension: "pdf",
              file_size: 512,
              id: "66666666-6666-4666-8666-666666666666",
              mime_type: "application/pdf",
              original_file_name: "legacy.pdf",
              project_id: PROJECT_ID,
              requirement_key: null,
              storage_path: "companies/company/projects/project/expenses/expense/legacy/file.pdf",
              uploaded_at: "2026-06-25T00:01:00.000Z",
            },
          },
          update: {
            data: {
              deleted_at: null,
              document_key: "receipt",
              expense_id: EXPENSE_ID,
              file_extension: "pdf",
              file_size: 512,
              id: "66666666-6666-4666-8666-666666666666",
              mime_type: "application/pdf",
              original_file_name: "legacy.pdf",
              project_id: PROJECT_ID,
              requirement_key: "payment_bundle",
              storage_path: "companies/company/projects/project/expenses/expense/legacy/file.pdf",
              uploaded_at: "2026-06-25T00:01:00.000Z",
            },
          },
        },
        expense_history_events: {
          insert: { error: new Error("history failed") },
        },
      }),
      PROJECT_ID,
      EXPENSE_ID,
      "66666666-6666-4666-8666-666666666666",
      null,
      { documentKey: "receipt", requirementKey: "payment_bundle" },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 500,
      error: { code: "EXPENSES_FETCH_ERROR" },
    });
  });
});
