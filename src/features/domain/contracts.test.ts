import { describe, expect, it } from "vitest";
import {
  DASHBOARD_VIEW_NAMES,
  DOMAIN_RESOURCE_ORDER,
  EXPENSE_STAGES,
  getExpenseStageIndex,
  getNextExpenseStageKey,
  isImmediateForwardExpenseStage,
} from "./contracts";
import type { Database } from "@/lib/supabase/types";

type Assert<T extends true> = T;
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
type RemovedCompanyColumn = Extract<
  keyof CompanyRow,
  | "business_region_sido"
  | "business_region_sigungu"
  | "business_address_detail"
  | "business_condition"
  | "business_type_detail"
>;
type _RemovedCompanyColumnsAreAbsent = Assert<
  RemovedCompanyColumn extends never ? true : false
>;
type _ProfileStatusIsRequired = Assert<
  {} extends Pick<CompanyInsert, "profile_status"> ? false : true
>;

describe("domain implementation contract", () => {
  it("keeps the vertical slice dependency order explicit", () => {
    expect(DOMAIN_RESOURCE_ORDER).toEqual([
      "companies",
      "projects",
      "project_budget_categories",
      "expenses",
      "expense_evidence_files",
      "expense_history_events",
    ]);
  });

  it("uses the five ordered database-backed expense stages", () => {
    expect(EXPENSE_STAGES.map(({ key }) => key)).toEqual([
      "budget_registration",
      "pre_approval",
      "execution_in_progress",
      "execution_request",
      "execution_completed",
    ]);
    expect(EXPENSE_STAGES.map(({ label }) => label)).toEqual([
      "사업비 등록",
      "사전 승인",
      "집행 수행",
      "집행 요청",
      "집행 완료",
    ]);
    expect(EXPENSE_STAGES[0].label).not.toBe("예산 등록");
    expect(EXPENSE_STAGES.map(({ label }) => label).join(" ")).not.toMatch(/[�]/);
    expect(new Set(EXPENSE_STAGES.map(({ key }) => key)).size).toBe(5);
    expect(new Set(EXPENSE_STAGES.map(({ label }) => label)).size).toBe(5);
  });

  it("resolves stage indexes and next stages from the canonical order", () => {
    expect(getExpenseStageIndex("budget_registration")).toBe(0);
    expect(getExpenseStageIndex("execution_completed")).toBe(4);
    expect(getNextExpenseStageKey("budget_registration")).toBe("pre_approval");
    expect(getNextExpenseStageKey("pre_approval")).toBe("execution_in_progress");
    expect(getNextExpenseStageKey("execution_in_progress")).toBe("execution_request");
    expect(getNextExpenseStageKey("execution_request")).toBe("execution_completed");
    expect(getNextExpenseStageKey("execution_completed")).toBeNull();
  });

  it("allows only immediate forward stage movement", () => {
    expect(isImmediateForwardExpenseStage("budget_registration", "pre_approval")).toBe(true);
    expect(isImmediateForwardExpenseStage("pre_approval", "execution_in_progress")).toBe(true);
    expect(isImmediateForwardExpenseStage("execution_in_progress", "execution_request")).toBe(true);
    expect(isImmediateForwardExpenseStage("execution_request", "execution_completed")).toBe(true);

    expect(isImmediateForwardExpenseStage("budget_registration", "budget_registration")).toBe(false);
    expect(isImmediateForwardExpenseStage("pre_approval", "budget_registration")).toBe(false);
    expect(isImmediateForwardExpenseStage("budget_registration", "execution_in_progress")).toBe(false);
    expect(isImmediateForwardExpenseStage("execution_completed", "execution_completed")).toBe(false);
  });

  it("pins every dashboard read model used by the future API", () => {
    expect(DASHBOARD_VIEW_NAMES).toHaveLength(5);
  });
});
