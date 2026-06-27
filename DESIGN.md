# Design

## Source of Truth

- Status: Active
- Last refreshed: 2026-06-26
- Primary product surfaces: project dashboard, expense detail, project export
- Evidence reviewed: `vooster-docs/prd.md`, `vooster-docs/architecture.md`, `vooster-docs/design-guide.md`, `vooster-docs/ia.md`, `vooster-docs/step-by-step.md`, `vooster-docs/guideline.md`, `vooster-docs/clean-code.md`, Figma file `GrantFollow UI System Wireframes` (`PJN5kW4PRknfi0bM8maGtM`)
- Current Figma decision: keep the current workflow structure and apply a stronger color/system hierarchy. Do not switch to the denser proposed panel layout yet.
- Priority on conflict: PRD -> IA -> Architecture -> this DESIGN.md -> Design Guide -> Guideline -> Step-by-step -> Clean Code.

## Product Direction

GrantFollow is an operational dashboard for government grant expense follow-up. The approved UI direction is `Current+Color`: preserve the current workflow and make priority clearer with semantic color, badges, accent bars, readable amounts, and light surface depth.

Avoid:
- Dense side-by-side structural redesigns.
- A global sidebar for this MVP.
- Black/gray-only flat screens.
- Horizontal category cost chips.
- A fixed right Checklist panel on expense detail.
- Expanding CSV policy in this UI slice.

## Canonical Stages

Use these labels everywhere in code, tests, docs, UI, and exports:

1. `사업비 등록`
2. `사전 승인`
3. `집행 수행`
4. `집행 요청`
5. `집행 완료`

`budget_registration` displays as `사업비 등록`, not `예산 등록`.

## Design Principles

1. Preserve the current workflow shape before adding polish.
2. Use color for semantic priority, not decoration.
3. Prefer vertical operational flows for scan-heavy grant work.
4. Keep stage, evidence, history, and validation areas row-based and extensible.
5. Prove Korean labels and UI contracts with tests before claiming completion.

## Visual Language

- Primary: indigo `#5E6AD2`
- Ink/navy: `#0F172A`
- Semantic accents: success `#16A34A`, warning `#F59E0B`, error `#DC2626`, info `#06B6D4`
- Surfaces: cool gray backgrounds with white cards and restrained borders
- Typography: compact Korean-first operational copy; amounts use tabular numeric emphasis
- Shape: 8px-ish radius, border-first cards, light shadows only for major surfaces

## Dashboard Rules

- Section order is KPI -> category spend -> kanban.
- KPI cards may use colored numeric emphasis, semantic labels, and top accent bars.
- Category spend is a vertical category-group list.
- Category group default row shows:
  - 비목명
  - 건수
  - 총액
  - 단계 요약
- Category stage summary is derived from child expense counts, ordered by the canonical stage order, and omits zero-count stages.
- Child expenses appear only after expanding a category group.
- Expand/collapse must use accessible button or accordion semantics with `aria-expanded` and keyboard support.
- Kanban uses all five canonical stages and keeps one-step-forward movement behavior.

## Expense Detail Rules

- Do not use a fixed right Checklist panel.
- Keep the full-page route and render a 5-step stage indicator.
- After the stepper, use one long full-width detail card.
- The long card contains:
  - 기본 정보
  - 단계별 입력 섹션
  - 증빙 파일
  - 검증 메시지
  - 변경 이력
- Evidence, history, and validation stay inside the main detail flow so future requirements can add, remove, or reorder rows without redesigning a side panel.

## Export Rules

- Keep the flow as filters -> preview -> download.
- Default filters mean all period, all categories, and all stages.
- Show selected filters as chips/badges.
- Preview table must show what will be exported before download.
- CSV download CTA should be visually stronger than secondary controls.
- Exact CSV policy remains deferred; preserve existing CSV serialization behavior unless a separate export-policy decision changes it.

## Verification Expectations

Implementation should verify:

- Canonical Korean stage labels render correctly.
- Dashboard order remains KPI -> category spend -> kanban.
- Category groups are vertical, collapsed by default, and accessible.
- Kanban renders five stages.
- Expense detail has no fixed right Checklist panel.
- Export defaults to all filters and preserves CSV regression coverage.
- `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` pass or any gap is explicitly reported.
