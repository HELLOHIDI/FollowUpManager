import type { ExpenseStageKey } from "@/features/domain/contracts";
import { EVIDENCE_DOCUMENT_OPTIONS } from "../backend/schema";

export type EvidenceDocumentOption = (typeof EVIDENCE_DOCUMENT_OPTIONS)[number];

export const expenseStageDetailCopy: Record<ExpenseStageKey, { description: string }> = {
  budget_registration: { description: "단계 진행에 필요한 확인 항목과 메모를 남깁니다." },
  pre_approval: { description: "단계 진행에 필요한 확인 항목과 메모를 남깁니다." },
  execution_in_progress: { description: "단계 진행에 필요한 확인 항목과 메모를 남깁니다." },
  execution_request: { description: "단계 진행에 필요한 확인 항목과 메모를 남깁니다." },
  execution_completed: { description: "단계 진행에 필요한 확인 항목과 메모를 남깁니다." },
};

const stageEvidenceKeys: Record<ExpenseStageKey, EvidenceDocumentOption["key"][]> = {
  budget_registration: ["quote", "comparative_quote", "contract", "etc"],
  pre_approval: ["pre_approval_document", "institution_confirmation", "pledge_letter", "etc"],
  execution_in_progress: ["contract", "purchase_order", "statement_of_work", "inspection_report", "evidence_photo", "deliverable_file", "etc"],
  execution_request: ["tax_invoice", "credit_card_receipt", "transfer_receipt", "vendor_business_registration", "vendor_bankbook_copy", "payment_receipt", "etc"],
  execution_completed: ["result_report", "completion_certificate", "participation_certificate", "travel_result_report", "advertising_result", "etc"],
};

export const evidenceOptionsForStage = (stageKey: ExpenseStageKey) =>
  EVIDENCE_DOCUMENT_OPTIONS.filter((option) => stageEvidenceKeys[stageKey].includes(option.key));
