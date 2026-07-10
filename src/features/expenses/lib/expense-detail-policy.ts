import type { ExpenseStageKey } from "@/features/domain/contracts";
import { EVIDENCE_DOCUMENT_OPTIONS, type ExpenseUpdateInput } from "../backend/schema";

export type ExpenseStageFieldKey = keyof ExpenseUpdateInput["stageFields"];
export type EvidenceDocumentOption = (typeof EVIDENCE_DOCUMENT_OPTIONS)[number];

export const expenseStageDetailCopy: Record<ExpenseStageKey, { description: string; fields: ExpenseStageFieldKey[] }> = {
  budget_registration: { description: "비목, 금액, 예상 지출일, 거래처와 메모를 정리합니다.", fields: [] },
  pre_approval: { description: "사전 승인 상태와 승인 참고 정보를 관리합니다.", fields: ["approvalReference", "preApprovalMemo"] },
  execution_in_progress: { description: "집행 수행 중 필요한 진행 메모와 산출물 메모를 관리합니다.", fields: ["executionMemo", "deliverableMemo"] },
  execution_request: { description: "집행 요청 상태, 요청일, 최종 요청 메모를 관리합니다.", fields: ["executionRequestMemo"] },
  execution_completed: { description: "집행 완료 상태와 최종 증빙 상태를 확인합니다.", fields: [] },
};

export const expenseStageFieldLabels: Record<ExpenseStageFieldKey, string> = { approvalReference: "승인번호 또는 승인 링크", deliverableMemo: "산출물 메모", executionMemo: "수행 상태 메모", executionRequestMemo: "최종 요청 메모", preApprovalMemo: "주관기관 확인 메모", stageChecklists: "진행 체크" };
export const preApprovalStatuses = [["not_required", "승인 불필요"], ["required", "승인 필요"], ["requested", "승인 요청 완료"], ["approved", "승인 완료"], ["rejected", "반려"], ["needs_review", "확인 필요"]] as const;
export const executionProgressStatuses = [["not_started", "수행 전"], ["in_progress", "수행 중"], ["delayed", "지연"], ["completed", "수행 완료"], ["needs_review", "확인 필요"]] as const;
export const executionRequestStatuses = [["draft", "작성 중"], ["ready_to_submit", "요청 준비 완료"], ["submitted", "요청 완료"], ["needs_supplement", "보완 필요"], ["completed", "집행 완료"]] as const;

const stageEvidenceKeys: Record<ExpenseStageKey, EvidenceDocumentOption["key"][]> = {
  budget_registration: ["quote", "comparative_quote", "contract", "etc"],
  pre_approval: ["pre_approval_document", "institution_confirmation", "pledge_letter", "etc"],
  execution_in_progress: ["contract", "purchase_order", "statement_of_work", "inspection_report", "evidence_photo", "deliverable_file", "etc"],
  execution_request: ["tax_invoice", "credit_card_receipt", "transfer_receipt", "vendor_business_registration", "vendor_bankbook_copy", "payment_receipt", "etc"],
  execution_completed: ["result_report", "completion_certificate", "participation_certificate", "travel_result_report", "advertising_result", "etc"],
};

export const evidenceOptionsForStage = (stageKey: ExpenseStageKey) =>
  EVIDENCE_DOCUMENT_OPTIONS.filter((option) => stageEvidenceKeys[stageKey].includes(option.key));
