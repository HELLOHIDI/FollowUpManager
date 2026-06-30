# Program Evidence Extraction V1 Policy

Status: approved for first implementation slice on 2026-06-30.

This document is the implementation baseline for the first real program evidence
policy extraction slice. When this document conflicts with older planning notes
in `program-evidence-policy.md`, use this document for V1.

## 1. Project Creation Flow

- Project creation is split into two steps.
- Step 1 saves only basic project information: project name, institution,
  contract period, total budget, and related project metadata.
- Saving Step 1 immediately creates the project.
- Legacy fallback budget categories are created immediately after project
  creation so the project is usable even if the setup flow is abandoned.
- Step 2 is a project setup page for policy files and category/evidence setup.
- If the user skips Step 2, the project keeps the legacy fallback categories and
  moves to the project dashboard.
- Step 2 must provide a clear `Start with default categories` action.

## 2. File Roles

- The policy PDF upload and general institution file upload are separate UI
  areas.
- The policy PDF is the only automatic extraction input in V1.
- V1 accepts exactly one policy PDF per policy setup attempt.
- General institution files may be uploaded as reference/storage files, but they
  are not used for automatic extraction in V1.
- Multi-PDF merge, source priority, and automatic extraction from reference files
  are backlog items.

## 3. Extraction Scope

- OCR is excluded from V1.
- V1 extracts only from text-layer PDFs or from manually pasted extracted text.
- If a PDF has no usable text layer, the extraction must fail gracefully and keep
  the legacy fallback categories.
- Manual policy creation from an empty policy is excluded from V1. The fallback is
  to continue with legacy categories.
- CSV extraction/export effects are excluded from this feature and remain a
  backlog concern.

## 4. Draft Quality Threshold

- Extraction creates a review draft only when at least two category candidates
  are found and at least one category has one or more evidence requirement
  candidates.
- If the threshold is not met, no draft is created. The project keeps the legacy
  fallback categories.
- Partial but threshold-passing extraction results are allowed, but the draft is
  treated as requiring admin review.
- Extraction never auto-confirms a policy.

## 5. Review Editing Scope

- V1 review allows editing category names, deleting categories, and adding,
  editing, or deleting evidence requirement items.
- Category reordering, advanced conditional rules, visual rule builders, and
  complex dependency logic are backlog items.
- V1 does not need to store or show source page numbers, snippets, coordinates,
  or raw text references for extracted items.

## 6. Applying A Confirmed Policy

- Confirming the reviewed policy replaces the project's legacy fallback
  categories with policy-based categories.
- If the project already has expenses, V1 blocks policy replacement and shows a
  clear explanation.
- Confirmed policy categories and evidence requirements apply only after the
  policy is confirmed.
- Existing expenses are not automatically migrated to a new policy in V1.

## 7. Failure Message And Logging

- User-facing extraction failure copy:
  `이 PDF에서는 자동 추출할 수 있는 텍스트를 충분히 찾지 못했어요. 기본 비목으로 시작하거나, 텍스트를 붙여넣어 다시 시도할 수 있어요.`
- Internal error logging should preserve a machine-readable reason such as
  `TEXT_EXTRACTION_INSUFFICIENT`.
- Technical error details should not be exposed as the primary user-facing
  message.

## 8. V1 Completion Criteria

- Creating a project without policy setup leaves the project usable with legacy
  fallback categories.
- Creating a project with a valid text-layer policy PDF produces a review draft
  when the draft quality threshold is met.
- Extraction failure does not block project use.
- Confirming a reviewed policy applies policy-based categories/evidence only when
  the project has no existing expenses.
- The setup page clearly separates policy PDF upload from general institution
  file uploads.
