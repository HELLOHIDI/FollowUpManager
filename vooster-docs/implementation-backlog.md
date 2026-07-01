# FuManager 구현 백로그

상태: Slice 1 기업 등록 구현 완료  
기준일: 2026-06-22

## 1. 목적과 범위

이 문서는 제품 골격 이후의 실제 데이터 수직 슬라이스를 안전하게 구현하기 위한 실행 계약이다. 구현 순서는 `기업 → 프로젝트 → 프로젝트 비목 → 지출 → 대시보드 → 증빙/히스토리`로 고정한다.

Slice 1은 기업 목록·생성·상세·수정 API와 `/settings/company` 저장 UI를 구현했다. 임시 데이터 저장소와 가짜 KPI는 사용하지 않는다.

근거 문서 우선순위는 PRD → IA → Architecture → Design Guide → Guideline → Step-by-step → Clean-code 순이다. 세부 필드와 정책은 `policies/company-policy.md`, `project-policy.md`, `budget-category-policy.md`, `expense-execution-policy.md`, `evidence-policy.md`를 따른다.

## 2. 도메인 관계와 소유권

```text
companies
  └─ projects
       ├─ project_budget_categories ── budget_category_policy_templates
       └─ expenses
            ├─ expense_evidence_files
            └─ expense_history_events

projects + project_budget_categories + expenses
  └─ dashboard views
```

- 기업은 최상위 관리 주체이며 여러 프로젝트를 가진다.
- 프로젝트는 반드시 하나의 기업에 속한다. 삭제는 기본적으로 `deleted_at`을 사용하는 소프트 삭제다.
- 프로젝트 비목은 프로젝트별 예산 계획이며 정책 템플릿의 `category_key`를 참조한다. 비목 자체에는 업무 단계가 없다.
- 지출은 실행 단위이며 정확히 하나의 프로젝트 비목에 속한다. `(project_budget_category_id, project_id, category_key)` 일치는 DB 외래 키로 보장한다.
- 증빙은 지출에 속한다. `expense_id`와 `project_id`의 일치는 DB 외래 키로 보장하며 private Storage만 사용한다.
- 히스토리는 지출 변경 트랜잭션과 함께 append-only 이벤트로 생성한다. 사용자 UI에서 수정·삭제하는 CRUD 자원이 아니다.
- 대시보드는 원천 테이블을 수정하지 않는 읽기 모델이다.

## 3. 공통 서버 경계

- 모든 `/api/companies`, `/api/projects`, `/api/project*`, `/api/expenses` 요청은 `withAuthenticatedUser` 이후에만 실행한다.
- 읽기는 요청 access token으로 만든 authenticated Supabase client를 사용한다.
- mutation은 인증 성공 후 service 함수 안에서만 service-role client를 지연 생성한다. 전역 middleware 또는 Hono context에 service-role client를 넣지 않는다.
- 브라우저는 service-role 키를 알 수 없으며 Supabase 도메인 테이블에 직접 쓰지 않는다.
- 자식 자원 접근 시 URL의 모든 부모 ID를 함께 조회 조건에 사용한다. 부모 관계가 맞지 않으면 존재 여부를 노출하지 않고 404를 반환한다.
- Zod는 params/query/body와 DB→DTO 응답 경계 모두를 검증한다. DB snake_case row를 브라우저 DTO camelCase로 매핑한다.
- 성공 응답은 DTO 자체를 반환하고 오류는 기존 `{ error: { code, message, details? } }` 형태를 사용한다.
- 오류 상태: 인증 실패 401, 입력 오류 400, 없음/소유권 불일치 404, 중복 409, 예상하지 못한 저장 오류 500.
- 로그에는 `requestId`, route, 안정적인 resource ID, error code만 남긴다. token, service-role key, 비밀번호, 증빙 signed URL은 기록하지 않는다.

## 4. feature 모듈 책임

각 feature는 실제 구현할 때 필요한 파일만 추가한다. 빈 디렉터리, 범용 repository, base service, 공통 CRUD 추상화는 만들지 않는다.

| Feature | DTO/Zod 책임 | Hono route/service 책임 | React Query 책임 |
| --- | --- | --- | --- |
| `company` | 기업 생성·수정 입력, 기업 상세/목록 DTO, 조건부 법인번호 검증, 사업자번호 10자리 검증 | 기업 목록·상세·생성·수정, 중복 409 매핑 | `companyKeys`, 목록/상세 query, create/update mutation과 관련 query invalidation |
| `projects` | 사업 기간·금액·담당자 검증, 계산된 합계와 상태 DTO | 기업 소유권 확인, 목록·상세·생성·수정·소프트 삭제, 예산 합계 불변식 유지 | `projectKeys`, 회사별 목록/상세 query, mutation 후 프로젝트와 회사 목록 invalidation |
| `budget-categories` | 정책 템플릿 DTO, 프로젝트 비목 입력/정렬 DTO, 예산액 검증 | 정책 템플릿 읽기, 프로젝트 비목 목록·생성·수정·소프트 삭제, 프로젝트 예산 합계 검증 | `budgetCategoryKeys`, 정책/프로젝트 비목 query와 mutation |
| `expenses` | 빠른 등록, 상세 수정, 단계 변경, 5단계 DTO와 상태 enum 검증 | 프로젝트·비목 일치 확인, 지출 CRUD, 단계 변경 소프트 게이트, 같은 트랜잭션의 히스토리 기록 | `expenseKeys`, 프로젝트 목록·상세 query, create/update/stage/delete mutation |
| `dashboard` | KPI·비목 요약·칸반 카드 read DTO | DB view를 프로젝트 ID로 조회하고 하나의 대시보드 응답으로 조합 | `dashboardKeys`, 프로젝트 대시보드 query, 관련 mutation 성공 시 invalidation |
| `evidence` | upload intent, metadata, signed URL DTO와 파일 정책 검증 | private Storage 업로드 조정, metadata 저장, signed URL, 소프트 삭제, 히스토리 기록 | `evidenceKeys`, 지출별 목록/signed URL query와 upload/delete mutation |

서버 전용 schema는 `features/<feature>/backend/schema.ts`, 서비스는 `backend/service.ts`, 라우트는 `backend/route.ts`에 둔다. 브라우저 응답 schema와 DTO는 `features/<feature>/lib/dto.ts`, query hook은 `hooks/`에 둔다. 동일한 Zod schema를 서버와 클라이언트가 모두 써야 할 때만 `lib/`에 둔다.

## 5. API 자원 계약

### 기업 수직 슬라이스

```text
GET    /api/companies
POST   /api/companies
GET    /api/companies/:companyId
PATCH  /api/companies/:companyId
```

- 첫 구현은 기업 목록/생성/상세/수정까지만 포함한다. 삭제는 이번 Slice에서 제외하며 후속 정책 결정 전 API와 UI를 제공하지 않는다.
- 저장 시 `profile_status`를 서버 정책 함수로 계산한다. 클라이언트 입력을 신뢰하지 않는다.
- 저장 입력은 기업명, 회사 형태, 기업규모, 사업자등록번호, 설립일, 법인일 때의 법인등록번호로 제한한다.

### 프로젝트 수직 슬라이스

```text
GET    /api/companies/:companyId/projects
POST   /api/companies/:companyId/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId
```

- 합계와 자기부담금 불변식은 server service와 DB constraint가 함께 보장한다.
- 생성 성공 DTO의 `id`로 `/projects/:projectId`에 이동한다.

### 프로젝트 비목 수직 슬라이스

```text
GET    /api/budget-category-policies
GET    /api/projects/:projectId/budget-categories
POST   /api/projects/:projectId/budget-categories
PATCH  /api/projects/:projectId/budget-categories/:budgetCategoryId
DELETE /api/projects/:projectId/budget-categories/:budgetCategoryId
```

- 정책 템플릿은 read-only다.
- 프로젝트 생성 시 활성 정책 템플릿이 프로젝트 비목으로 자동 시드된다.
- 동일 프로젝트의 `category_key` 중복은 409로 매핑한다.
- 비목 예산 합계가 프로젝트 총예산과 다른 경우 저장 차단 여부는 비목 정책 구현 시 확정하되, 최소한 상태를 응답 DTO에 명시한다.

### 지출과 대시보드 수직 슬라이스

```text
GET    /api/projects/:projectId/expenses
POST   /api/projects/:projectId/expenses
GET    /api/projects/:projectId/expenses/:expenseId
PATCH  /api/projects/:projectId/expenses/:expenseId
PATCH  /api/projects/:projectId/expenses/:expenseId/stage
DELETE /api/projects/:projectId/expenses/:expenseId
GET    /api/projects/:projectId/dashboard
```

- 빠른 등록은 제목, 프로젝트 비목, 예상 금액, 예상 날짜, 메모의 최소 입력만 받는다.
- 단계 key는 `budget_registration`, `pre_approval`, `execution_in_progress`, `execution_request`, `execution_completed`로 고정한다.
- 단계 변경은 입력 누락을 경고하되 데이터 무결성 오류가 아니면 허용한다.
- 지출 변경과 `expense_history_events` 기록은 하나의 DB 트랜잭션/RPC 경계로 처리한다. 둘 중 하나만 성공하는 구현은 금지한다.
- 대시보드는 `project_kpi_summary`, `project_category_amount_summary`, `project_kanban_stage_summary`, `project_expenses_by_category`, `project_expenses_by_stage` view를 사용한다.

### 증빙과 히스토리 후속 증분

```text
GET    /api/projects/:projectId/expenses/:expenseId/evidence
POST   /api/projects/:projectId/expenses/:expenseId/evidence
POST   /api/projects/:projectId/expenses/:expenseId/evidence/:evidenceId/signed-url
DELETE /api/projects/:projectId/expenses/:expenseId/evidence/:evidenceId
GET    /api/projects/:projectId/expenses/:expenseId/history
```

- bucket은 `expense-evidence` private 고정이다.
- 경로는 `companyId/projectId/expenseId/documentKey/...` 구조를 사용한다.
- metadata와 Storage 작업의 보상 처리 및 히스토리 기록 순서를 테스트로 고정한다.
- 히스토리는 조회만 공개하고 직접 생성·수정·삭제 route를 제공하지 않는다.

## 6. 구현 순서와 완료 게이트

### Slice 1 — 기업

- schema/DTO/service/route/query/form을 세로로 완성한다.
- 인증된 admin의 다중 기업 생성·조회·수정과 중복·조건부 필드 정책을 통합 테스트한다.
- `/settings/company`의 disabled 상태를 실제 서버 상태 UI로 교체한다.
- 기업·사업 사이드바와 운영 대시보드 연결은 프로젝트 또는 대시보드 Slice로 연기한다.

### Slice 2 — 프로젝트

- 기업 설정의 기업 하위에서 프로젝트를 등록하고, 등록 후 `/projects/:projectId`로 이동한다.
- 기업별 하위 사업 셀, 별도 관리 화면, 기관 제공 서류 add/delete/open을 연결한다.
- `/projects` 실제 목록과 UtilityBar 데이터 연결은 대시보드 Slice로 연기한다.

### Slice 3 — 칸반 / 단계 이동

- 칸반은 5단계 상태를 보여주고, Slice 3의 기본 이동 UX는 드래그 앤 드롭으로 시작한다.
- Slice 3의 저장 정책은 한 번에 바로 다음 단계로만 이동하는 forward-only다.
- 단계 변경 API는 `targetStageKey`를 받되, 현재 서비스 정책에서만 "현재 단계의 바로 다음 단계"인지 검증한다. 후속 slice에서 기관/사업별 운영 방식에 따라 앞 단계 건너뛰기를 같은 API로 열 수 있다.
- 단계 이동 버튼과 키보드 단축키는 드래그 앤 드롭과 동일한 API를 호출한다.
- 입력 누락 안내, 소프트 게이트 UI, 토스트/배지 안내, 역방향 이동, 단계 건너뛰기, 자동 히스토리는 후속 slice로 미룬다.
- `execution_completed` 이동 시 예산 초과는 서버/DB 오류로 차단하고, UI는 낙관 업데이트를 되돌린 뒤 일반 오류 메시지만 표시한다.
- 단계 이동과 카드 렌더링의 최소 상태를 테스트한다.

### Slice 4 — 지출과 대시보드

- 빠른 등록→칸반 카드→상세 수정→단계 이동→대시보드 집계 흐름을 완성한다.
- 지출과 히스토리 원자성을 검증한다.

### Slice 5 — 증빙과 히스토리 UI

- private Storage, signed URL, 중복 감지 안내, 삭제 보상 처리와 상세 타임라인을 연결한다.

각 slice는 targeted unit/integration/E2E, `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`가 통과해야 다음 slice로 진행한다. DB 계약 변경이 꼭 필요하면 기존 migration을 수정하지 않고 다음 번호의 forward-only migration을 추가한다.

## 7. 테스트 계약

- DTO: DB snake_case→API camelCase 매핑과 응답 Zod 검증.
- Service: 성공, 없음, 중복, DB 오류, 부모 소유권 불일치, soft-deleted 제외.
- Route: auth middleware 적용, params/body 오류 400, 안정적인 오류 코드.
- Security: 인증 실패 시 service-role client 생성 0회, mutation service 진입 후에만 1회.
- Query hooks: query key 안정성, enabled 조건, mutation 후 정확한 invalidation.
- DB: fresh reset, RLS read/write 차이, FK/unique/check constraints, 트랜잭션 원자성.
- E2E: 빈 상태→생성→목록/상세 반영→새로고침 후 유지→삭제/복구 정책.

## 8. 명시적 제외 범위

- 범용 repository/base service, 이벤트 버스, CQRS 프레임워크.
- 브라우저의 직접 domain mutation과 service-role 노출.
- 사용자별 기업/프로젝트 권한, 역할, 팀원 초대, 사용자별 감사 추적.
- 가짜 집계, localStorage/in-memory CRUD, 임시 mutation API.
- PDF, 알림, OCR, 자동 정산 적합성 판단.

## 9. 5단계 완료 증거

- `src/features/domain/contracts.ts`가 생성된 Supabase 타입에서 도메인 record를 파생한다.
- 5단계 key와 수직 슬라이스 순서는 단위 테스트로 고정한다.
- fresh local Supabase에 migration `0001`~`0011`이 적용된다.
- 생성 타입이 현재 스키마와 일치하고 typecheck/build가 통과한다.
- 실제 CRUD route, mutation hook, 저장 가능한 폼은 아직 존재하지 않는다.
## Operation Dashboard Slice 1 boundary (2026-06-23)

Included now: policy/schema alignment, migration 0015 and generated contracts, read-only dashboard endpoint, React Query boundary, KPI cards, expense-backed category groups, state handling, SQL/unit/integration/E2E verification.

Deferred: expense creation, stage mutation/history automation, search and filters, quick registration, interactive kanban/drag-and-drop, expense editing/evidence, export, and independent category-budget allocation UI.

## Operation Dashboard Slice 2 boundary (2026-06-24)

Included now: `/projects/:projectId/expenses` quick-registration page, top-level `+ 지출` entrypoint, expense creation API, category-select options, and grouped expense-by-category list.

Decision locked for this slice: the create flow uses canonical `expenses.amount` and creates a new expense in `budget_registration`; stage movement stays deferred to the kanban slice.

Deferred: stage changes, drag-and-drop, detailed editing, evidence, history automation, search/filters, export, and live refresh.

## Program Evidence Policy boundary (2026-06-29)

Included later: upload a program evidence PDF during project registration, extract a policy draft, review and edit categories/subcategories/evidence requirements, confirm an immutable policy version, and apply the confirmed policy to expense category selection and evidence requirement display.

Scope locked for phase 1: customize only program categories, optional subcategories, evidence requirements, dashboard category grouping, and filters. Keep dashboard grouping at the top-level category; show subcategories as row/card labels and filter options. Keep CSV export policy integration, common KPI formulas, kanban stages, stage movement rules, and expense card structure unchanged.

Policy upload lifecycle: allow optional upload during project registration and later upload of new policy PDF versions from the project management screen. New uploads create draft versions and never mutate an existing confirmed policy or existing expense snapshots automatically.

Policy document scope: each policy version has exactly one primary PDF for automatic extraction. Additional PDFs are reference documents only; they can support manual review but are not auto-merged into the draft in phase 1.

Phase 1 admin review scope: allow editing category/subcategory/evidence display names and stable keys, requirement type, fulfillment type, condition text, source mapping, and review status. Do not implement executable conditional rules yet; keep conditional requirements as reviewable guidance text.

Stable key rule: generate category, subcategory, and evidence keys automatically from display names as ASCII slugs. Admins may edit keys only before confirmation; confirmed keys are immutable. Validate slug format and uniqueness, preserve the original Korean/source labels separately, and use confirmed keys for snapshots, dashboard grouping, and filters.

Confirmation scope: the current authenticated internal user can confirm a reviewed policy in phase 1. Before confirmation, show a checklist and confirmation modal. Store confirmed_by, confirmed_at, and summary counts for categories, subcategories, and evidence requirements. Do not build a role-based approval workflow yet.

Expense policy snapshot rule: on expense creation or category/subcategory change, store the confirmed policy version id, selected category/subcategory keys and labels, and an evidence requirements snapshot. Render evidence requirements from the snapshot, while using the policy version id for source traceability.

Evidence fulfillment display: in phase 1, loosely match uploaded evidence files to policy requirements by document key and show only not_uploaded, uploaded, or waived statuses. Display required, conditional, and optional as badges/guidance, preserve conditional text, handle any_of/all_of for status display, allow waived only as a manual admin state, and never block expense save or stage movement because evidence is missing.

Pre-MVP data reset allowance: during the phase 1 policy migration, existing expenses, legacy project categories, and expense evidence links/metadata may be reset. Preserve company records, project records, uploaded policy PDFs, policy versions, confirmed policies, and source references. This destructive allowance expires once real production data exists.

Fallback locked: when no policy PDF is uploaded, or when an uploaded policy is not confirmed yet, keep the existing category selection and expense card/detail layout.

Unconfirmed policy UX: on expense create/detail screens, show only a low-severity banner explaining that the project is still using the existing category flow until policy review is complete. Provide a CTA to project management/policy review, do not open policy editing inside expense screens, and show "reupload needed" only when extraction failed.

Legacy category boundary: keep the existing default category set only as a legacy fallback category set. Use it only for projects without a confirmed policy, and never merge it into confirmed policy projects or use it as the seed/default for extracted policy drafts.

Extraction failure fallback: when the primary PDF cannot produce a usable draft, preserve the PDF and keep the project on the existing category selection and expense card/detail layout. Do not provide from-scratch manual policy creation in phase 1.

Usable draft gate: treat an extracted policy draft as usable only when it has at least one top-level category, each extracted top-level category can receive a display name and stable key, and at least one evidence requirement is connected to either a category or common evidence. If this gate fails, preserve the PDF and extraction failure details, then keep the project on the existing category selection and expense card/detail layout until a policy is confirmed.

Preview scope: before confirmation, show a policy application summary only: expense category options, subcategory-bearing categories, evidence requirement counts, dashboard group order, and filter options. Do not render the full dashboard, full expense card UI, CSV file, or CSV column preview in phase 1.

Admin review UI: use row-based table editing for top-level categories, subcategories, and evidence requirements. Allow row-level add/edit/delete, connect rows by stable keys, and defer complex tree drag editing or embedded policy editing inside expense screens.

Source evidence display: show original file name, page, table/row position, and raw source text for each extracted item. Provide PDF open/download only in phase 1; do not build an embedded PDF viewer.

Confirmation blocking errors: block confirmation only for missing/duplicate stable keys, missing display names, missing evidence requirement type or fulfillment type, missing source references, and remaining needs_admin_review/manual_required items. Do not block confirmation because conditional text semantics are not machine-interpretable.

Project policy operation status: show a project-level status badge for legacy_fallback, draft_needs_review, confirmed_policy, or extraction_failed. Use this status to drive low-severity expense-screen banners and project-management review/reupload actions.

Existing expense handling: never auto-update existing expenses when a policy is confirmed or a new version is confirmed. Keep their snapshots as-is, show a low-severity "created under previous/legacy policy" notice where relevant, and defer bulk reapply.

Policy version list: in phase 1, show only version/status/primary PDF/confirmed metadata/summary counts. Defer version diff comparison.

Extraction failure actions: limit actions to primary PDF reupload, source PDF view/download, and continuing with the existing category flow. Do not provide empty manual policy creation in phase 1.

Phase 1 completion gate: PDF upload -> draft or failure fallback -> row-based review/edit -> confirmation -> policy category/subcategory/evidence display on new expense creation -> dashboard top-level category grouping and filters reflect the confirmed policy.

Deferred: automatic policy confirmation, manual policy creation from an empty draft after extraction failure, multi-PDF policy auto-merge, OCR-only image PDF support, CSV export policy integration, custom KPI formulas, custom kanban stages, custom stage movement rules, evidence authenticity verification, external institution integration, and blocking expense save/stage movement based on missing evidence.
