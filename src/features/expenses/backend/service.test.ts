import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { createExpense, getExpenseDetail, getExpenseHistory, listExpenseEvidence, listProjectExpensesPage, updateExpense, updateExpenseStage } from "./service";

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
      Promise.resolve(result.select ?? { data: [] }).then(resolve, reject),
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

describe("expense service", () => {
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

  it("creates an expense and auto-seeds the project category when missing", async () => {
    const result = await createExpense(
      clientFor({
        projects: {
          select: { data: { id: PROJECT_ID, deleted_at: null } },
        },
        project_budget_categories: {
          select: { data: null },
          insert: { data: { id: CATEGORY_ID } },
        },
        budget_category_policy_templates: {
          select: {
            data: { category_key: "material_cost", is_active: true },
          },
        },
        expenses: {
          insert: {
            data: baseExpenseRow(),
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

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.stageKey).toBe("budget_registration");
    expect(result.data.projectBudgetCategoryId).toBe(CATEGORY_ID);
    expect(result.data.fundingSourceKey).toBe("government_subsidy");
  });

  it("rejects unavailable category keys", async () => {
    const result = await createExpense(
      clientFor({
        projects: {
          select: { data: { id: PROJECT_ID, deleted_at: null } },
        },
        budget_category_policy_templates: {
          select: { data: null },
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

  it("loads expense detail with a default funding source when the DB has not applied the funding source column yet", async () => {
    const { client, expenseSelects } = clientForMissingFundingSourceColumn();

    const detail = await getExpenseDetail(client, PROJECT_ID, EXPENSE_ID);

    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(expenseSelects).toHaveLength(2);
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
});
