# GrantFollow Information Architecture (IA)

3→2→1 우선순위(실시간 대시보드 → 지출 입력/증빙 → 온보딩/초기설정)와 “글로벌 내비 없음” + “Supabase Auth 기반 단일 내부 계정” 결정을 반영해, 한 화면에서 빠르게 보고-입력-확인하는 구조에 최적화합니다.

## 1. Site Map (사이트맵)
- / (루트, 마지막 사용 사업 대시보드로 리다이렉트)
- /projects/:projectId
  - #overview (KPI/요약)
  - #categories (비목별 지출 목록)
  - #kanban (지출 칸반)
- /projects/:projectId/expenses/:expenseId (지출 상세)
- /projects/:projectId/export (CSV 내보내기)
- /settings/company (기업 추가·수정·사업 등록 전용 플로우, 기본 접근은 /projects로 리다이렉트)
- /_health (운영 점검용, 비공개)

공개/보호 경로
- 공개 경로: /login
- 운영 점검 경로: /_health (업무 데이터 접근 없음, 배포/인프라 레벨 접근 제한 권장)
- 보호 경로: /projects, /projects/:projectId, /projects/:projectId/expenses/:expenseId, /projects/:projectId/export, /settings/company
- / 는 인증 상태에 따라 마지막 사용 사업 대시보드 또는 /login으로 리다이렉트합니다.

메모
- 대시보드 현황 파악은 /projects/:projectId 단일 화면 내 섹션 이동(앵커)로 완결됩니다.
- 개별 지출의 단계별 입력, 증빙, 히스토리 관리는 /projects/:projectId/expenses/:expenseId 상세 풀페이지에서 처리합니다.
- 기업 등록·수정·사업 등록은 `/projects`의 기업 카드에서 `/settings/company` 전용 플로우로 진입해 처리한다. 쿼리 없는 `/settings/company` 전체 설정 화면은 제공하지 않는다.

## 2. User Flow (사용자 흐름)
우선순위 기준으로 3가지 핵심 여정을 정의합니다.

- 핵심 여정 A: 실시간 현황 파악(1분 내)
  1) /projects/:projectId 진입 시 #overview 상단 고정 노출
  2) KPI 3종 확인(소진액·잔액·예산소진율) — 임계치에 따라 컬러 상태 표시
  3) KPI 또는 비목별 지출 그룹 클릭 → 자동으로 #categories 또는 #kanban 섹션으로 스크롤 → 관련 필터 자동 적용
  4) 필요 시 비목별 지출 목록 또는 칸반 카드 클릭 → 해당 지출 상세 풀페이지로 이동

- 핵심 여정 B: 지출 입력 + 증빙 업로드(반복)
  1) 전역 유틸 바의 “+ 지출” 클릭(N 단축키 지원)
  2) `/projects/:projectId/expenses` 빠른 등록 페이지에서 지출 제목, 비목 선택, 금액, 예상 날짜, 간단 메모 입력
  3) 저장(Cmd/Ctrl+S) → 카드가 #kanban의 ‘사업비 등록’ 칼럼에 생성
  4) 카드 클릭 시 지출 상세 풀페이지 이동 → 예상 지출일, 거래처명, 증빙, 메모, 단계별 입력정보 보완
  5) 영수증/세금계산서 파일 드래그&드롭 업로드(진행률/재시도/중복 감지)
  6) 상세 풀페이지 또는 칸반에서 forward-only 단계 이동(사업비 등록 → 사전 승인 → 집행 수행 → 집행 요청 → 집행 완료)
  7) 소프트 게이트 안내 확인 후 이동, 저장 시 KPI·차트 실시간 반영(#overview에 즉시 업데이트)

- 핵심 여정 C: 기업과 사업 선택
  1) `/projects`에서 현재 계정의 등록 기업과 각 기업의 사업 진입점을 확인
  2) “기업 추가하기”로 새 기업을 등록하거나 기업 카드의 “기업 정보 수정”으로 기존 기업을 수정
  3) 기업 카드의 “사업 등록”으로 해당 기업에 연결할 사업을 등록
  4) 저장 후 `/projects` 또는 신규 사업 대시보드로 이동

접근성/키보드
- /(검색), N(새 지출), Cmd/Ctrl+S(저장), ]/[ (지출 단계 이동), 1–3(로컬 섹션 단축: 개요/비목/칸반)

## 3. Navigation Structure (네비게이션 구조)
- 글로벌 내비게이션: 없음(None)
  - 상단 유틸리티 바 제공(탐색이 아닌 작업 중심)
    - 좌측: 프로젝트 스위처(검색 가능, 최근 사용), 기간 필터(협약기간 프리셋)
    - 중앙: 글로벌 검색(/)
    - 우측: + 지출(Primary), ⋯(내보내기/도움말), 사용자/환경(설정 진입)
  - 장점: 화면 가로폭 최대 확보(칸반·차트 가독성↑), 전환 비용↓, MVP 러닝커브↓
  - 레퍼런스: Notion의 단일 화면 작업 모델, Linear의 작업 우선 헤더

- 로컬 내비게이션(대시보드 내부 Scrollspy/Pills)
  - 개요 · 비목별 지출 · 지출(칸반)
  - 클릭 시 부드러운 스크롤 + URL 해시(#overview 등) 업데이트, 현재 섹션 강조(aria-current)

- 푸터
  - 최소 정보(버전, 빌드 날짜, 문의 링크). 모바일에서는 숨김 또는 접힘.

반응형
- 데스크톱: 유틸 바 56px 고정, 로컬 내비는 바닥마진 8–12px로 콘텐츠 밀착
- 태블릿: 로컬 내비를 세그먼트 컨트롤로 축소, 칸반은 2–3칼럼
- 모바일: 로컬 내비를 수평 스크롤 탭으로, +지출 플로팅 버튼 고정

접근성
- 스킵 링크: “개요로/칸반으로 건너뛰기”
- 키보드 포커스 2px Primary, 유틸 바 요소 순서 Tab 흐름 최적화

보안/접근 메모
- MVP에서는 Supabase Auth 기반 단일 내부 계정 로그인을 유지합니다.
- 인증은 내부 데이터 보호를 위한 최소 접근 제어이며, 다중 사용자 역할/권한 관리와 분리합니다.
- 다중 사용자 역할/권한 관리는 MVP 범위에서 제외합니다.
- 운영 단계에서는 noindex 헤더, 레이트 리미트, 비공개 배포 정책 등 배포 레벨 방어도 병행합니다.

## 4. Page Hierarchy (페이지 계층 구조)
- / (Depth 1) — 마지막 프로젝트로 리다이렉트
- /projects (Depth 1, 옵션) — 프로젝트 선택/검색(오버레이로 대체 가능)
  - /projects/:projectId (Depth 2) — 대시보드(단일 화면)
    - #overview (Depth 3)
    - #categories (Depth 3)
    - #kanban (Depth 3)
  - /projects/:projectId/expenses/:expenseId (Depth 3) — 지출 상세 풀페이지
- /projects/:projectId/export (Depth 2)
- /settings (Depth 1)
  - /settings/company (Depth 2, 기업 추가·수정·사업 등록 전용)
- /_health (Depth 1, 운영 전용)

라우팅 원칙
- 대시보드가 기본이다.
- 빠른 지출 생성은 모달로 처리해 입력 비용을 낮춘다.
- 개별 지출의 단계별 누적 입력, 증빙, 변경 히스토리는 상세 풀페이지로 분리해 정보량 증가에 대응한다.

## 5. Content Organization (콘텐츠 구성)
| 페이지/섹션 | 핵심 콘텐츠 요소 |
|---|---|
| /projects/:projectId #overview | KPI 카드(소진액·잔액·예산소진율), 기간 필터, 누적/기간 대비 시각화, 임계치 상태 배지 |
| /projects/:projectId #categories | 비목별 지출 목록(비목 그룹, 하위 지출명, 금액, 단계, 그룹별 합계/건수) |
| /projects/:projectId #kanban | 5단계 칸반(사업비 등록/사전 승인/집행 수행/집행 요청/집행 완료), 칼럼 헤더(개수/합계), 카드(제목·금액·날짜·메타), forward-only 단계 이동 |
| /projects/:projectId/expenses/:expenseId | 지출 기본정보, 단계 진행상태, 단계별 누적 입력 폼, 비목 정책 패널, 증빙 현황, 변경 히스토리 |
| 전역 유틸 바 | 프로젝트 스위처, 글로벌 검색, 기간 프리셋, +지출, ⋯(내보내기/도움말), 사용자/환경 |
| 지출 빠른 등록 페이지 | 지출 제목, 비목 선택 드롭다운, 금액, 예상 날짜, 간단 메모, 카드 생성 액션 |
| /projects/:projectId/export | 필터(기간/비목/단계), 미리보기 테이블, CSV 다운로드, 내보내기 규칙 안내 |
| /settings/company | 기업 추가·수정 폼, 사업 등록 폼, 조건부 법인번호, 저장 피드백(토스트). 다중 기업 목록은 `/projects`에서 제공 |

텍스트/숫자 가독성
- 숫자/금액 컬럼: 탭울러 숫자 폰트, 우측 정렬, 천단위 구분
- 마이크로카피: 짧고 해결책 동반(예: “집행 요청에는 영수증이 필요해요 — 지금 추가할까요?”)

반응형
- KPI: 데스크톱 3열 → 태블릿 2열 → 모바일 1열
- 칸반: 데스크톱 5컬럼 → 태블릿 2–3 → 모바일 1(수평 스크롤 허용)

## 6. Interaction Patterns (인터랙션 패턴)
- 로컬 섹션 내비게이션: Scrollspy + 부드러운 스크롤, URL 해시 동기화
- 칸반 보드: forward-only 단계 이동, 단계 간 소프트 게이트 안내(체크리스트/준비도 0–100%)
- 빠른 등록: `+ 지출` 클릭 시 `/projects/:projectId/expenses`로 이동하며, 페이지 전환 후 카드가 생성된다
- 지출 카드 클릭: 드로어를 열지 않고 `/projects/:projectId/expenses/:expenseId` 상세 풀페이지로 이동
- 지출 상세 풀페이지: 단계별 누적 입력 폼, 증빙 현황, 검증 메시지, 변경 히스토리를 하나의 full-width long-card 흐름 안에서 제공
- 인라인 편집: 비목/테이블 셀 Enter 확정, Esc 취소
- 피드백: Skeleton 로딩, 토스트(성공 3초, 오류 수동 닫기), 필드 인라인 에러
- 단축키: N(새 지출), /(검색), Cmd/Ctrl+S(저장), ](다음 단계), 1–4(섹션 점프)
- 포커스/접근성: 2px Primary 포커스 링, aria-label/aria-current, 스크린리더 레이블(비목/잔액/소진률 명시)
- 파일 업로드 어디서든 드래그: 포커스된 지출 상세 또는 업로드 영역으로 흡수 업로드

## 7. URL Structure (URL 구조)
일관·가독·딥링크를 우선하며, 내부툴 특성상 SEO는 차단 지향(그래도 명명 규칙은 유지).

- 기본 규칙
  - 리소스 중심: /projects/:projectId
  - 지출 상세: /projects/:projectId/expenses/:expenseId
  - 섹션 앵커: #overview, #categories, #kanban
  - 필터 파라미터: ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=:id&status=:phase
  - 내보내기: /projects/:projectId/export?from=…&to=…&category=…&status=…
  - 읽기 쉬운 영문 슬러그 사용, 소문자-케밥케이스
  - 파일 경로는 노출하지 않고 서명 URL 사용(만료 시간 포함)

- 예시
  - https://app.domain.com/projects/abc123#overview
  - https://app.domain.com/projects/abc123#kanban?status=approved
  - https://app.domain.com/projects/abc123/expenses/exp456
  - https://app.domain.com/projects/abc123/export?from=2026-06-01&to=2026-06-30

- SEO/보안
  - 메타/헤더: noindex, nofollow, noarchive
  - canonical은 프로젝트 기준으로 고정
  - 서버/엣지 레벨 레이트 리미트, 리퍼러 정책 strict-origin-when-cross-origin

- 접근성
  - 해시 변경 시 포커스가 해당 섹션 헤딩으로 이동(스크린리더 공지)

## 8. Component Hierarchy (컴포넌트 계층 구조)
- 글로벌 컴포넌트
  - AppShell
    - UtilityBar (프로젝트 스위처, 검색, 기간 프리셋, +지출, ⋯메뉴)
    - ToastContainer
    - SkipLinks
  - ProjectSwitcher (Command Palette 스타일, 최근 항목)
  - GlobalSearch (단축키 /, 결과 하이라이트)
  - DateRangePreset (이번 달/분기/협약기간)
  - Modal/Drawer (확인/간단 설정, 우측 480–640px)
  - FileDropzone (전역 드래그 감지, 진행률)
  - Tooltip/Popover
  - ConfirmDialog

- 대시보드(프로젝트 컨텍스트)
  - DashboardPage (/projects/:projectId)
    - LocalNavPills (Scrollspy)
    - SectionOverview (#overview)
      - KpiCard (소진액/잔액/예산소진율)
      - TrendMiniChart (게이지/세그먼트 바)
    - SectionCategories (#categories)
      - CategoryExpenseList
    - CategoryGroup (비목명, 지출 건수, 합계)
    - ExpenseChildRow (지출명, 금액, 단계)
    - SectionKanban (#kanban)
      - KanbanBoard
        - KanbanColumn (사업비 등록/사전 승인/집행 수행/집행 요청/집행 완료)
        - ExpenseCard (제목·금액·날짜·준비도·메타)
      - ExpenseQuickCreateSheet (/projects/:projectId/expenses)
    - EmptyStateBanner (온보딩 체크리스트)

- 지출 상세
  - ExpenseDetailPage (/projects/:projectId/expenses/:expenseId)
    - ExpenseDetailHeader (뒤로가기, 제목, 비목, 대표 금액, 저장 상태)
    - ExpenseStageStepper (사업비 등록/사전 승인/집행 수행/집행 요청/집행 완료)
    - ExpenseStageSections
      - BudgetRegistrationSection
      - PreApprovalSection
      - ExecutionInProgressSection
      - ExecutionRequestSection
      - ExecutionCompletedSection
      - ExecutionRequestSection
    - ExpenseSoftGateDialog
    - ExpenseEvidencePanel
    - ExpenseValidationSection
    - ExpenseHistoryTimeline

- 내보내기
  - ExportPage (/projects/:projectId/export)
    - FilterBar (기간/비목/단계)
    - PreviewTable
    - DownloadButton (CSV)

- 설정
  - CompanyFlowPage (/settings/company)
    - CompanyForm (기업명/회사 형태/기업규모/사업자등록번호/설립일/조건부 법인등록번호)
    - ProjectForm (선택 기업의 사업 등록)
    - SaveAction + Toast

스타일/토큰(Design Guide 준수)
- 컬러: Primary #5E6AD2, Navi #0F172A, 상태 색(성공/경고/오류/정보), 그레이스케일 G-50~G-900
- 타이포: Pretendard, 숫자 탭울러 적용
- 레이아웃: 데스크톱 12col, 태블릿 8col, 모바일 4col
- 스페이싱: 4/8/12/16/24/32/40

반응형 요약
- KPI: 3→2→1열
- 칸반: 4→2–3→1컬럼(모바일 수평 스크롤 허용)
- 드로어: 후속 사업 설정 등 짧은 보조 작업에 한해 모바일 전폭 오버레이, 데스크톱 480–640px 고정 폭. 기업 등록·수정에는 사용하지 않는다.

접근성
- 버튼/라벨 대비 AA 이상, 포커스 링 명확화
- 테이블/차트 대체 텍스트(요약 수치 제공)
- 키보드 내비 완전 지원, 라이브 리전으로 저장/오류 공지

기술 메모
- 데이터 저장소: Supabase PostgreSQL
- 파일 저장소: Supabase Storage(서명 URL)
- 배포: Vercel(프리뷰/프로덕션), GitHub Actions CI/CD
- 성능: 지연 로딩(칸반/최근 섹션), 캐시/옵션 프리패치, 차트 가벼운 렌더

---
## Operation Dashboard Slice 1 information architecture (2026-06-23)

- `#overview`: three KPI cards for total budget, remaining budget, and burn ratio, backed by completed-only spend.
- `#categories`: expense-backed groups only. Group headers expose Korean policy category name, count, and canonical amount total; children expose title, amount, and the five-stage label and link to expense detail.
- `#kanban`: anchor and explicit future-slice placeholder only. No interactive kanban behavior is active in Slice 1.
- Loading, empty, project-not-found, integrity-error, and retryable-error states are distinct.

## Operation Dashboard Slice 2 information architecture (2026-06-24)

- `/projects/:projectId/expenses`: quick-registration entry page. It exposes a top-level `+ 지출` action, the expense-create sheet, and expense-backed category groups on the same page.
- Quick registration uses the canonical `amount` field, a project budget category selector, an optional expected date, and an optional memo. It does not move stage state.
- The kanban and stage-mutation path remain out of scope for this slice.

## Operation Dashboard Slice 3 information architecture (2026-06-24)

- `/projects/:projectId#kanban`: 5-stage board for stage visibility and drag-and-drop based movement.
- Slice 3 persists only one-step forward movement. The mutation receives `targetStageKey`, but the service accepts only the immediate next stage in this slice.
- Stage control includes drag-and-drop plus an accessible next-step button/keyboard path that uses the same mutation.
- Reverse movement, multi-stage jump movement, soft-gate UI, missing-info toast/badge guidance, and automatic history remain deferred.
- `/projects/:projectId/expenses/:expenseId`: detailed edit flow, evidence, and history remain on the full page.
- Slice 3 does not move quick registration back into kanban; `/projects/:projectId/expenses` remains the entry point.

## Figma Current+Color IA alignment (2026-06-26)

- The selected design direction keeps the current workflow structure and rejects a dense side-by-side redesign for now.
- Dashboard section order is KPI -> category spend -> kanban.
- Category spend is a vertical category-group list, not horizontal category chips.
- Real kanban design uses all five canonical stages: `사업비 등록`, `사전 승인`, `집행 수행`, `집행 요청`, `집행 완료`.
- Expense detail no longer uses a fixed right Checklist panel in the current direction. Stage data, missing fields, evidence, history, and validation should live in a long, full-width detail card that can grow or be reordered as requirements change.
- Export remains filters -> preview -> download, with selected filters and export readiness shown before CSV download.

## Current+Color implementation alignment (2026-06-26)

- Canonical expense stage labels are `사업비 등록`, `사전 승인`, `집행 수행`, `집행 요청`, `집행 완료`.
- The `/projects/:projectId` dashboard keeps the order KPI -> category spend -> kanban.
- `#categories` renders vertical category groups. Groups are collapsed by default, expose category name/count/total/stage summary, and reveal child expenses after expansion.
- `#kanban` renders all five canonical stages and keeps immediate-forward movement semantics.
- `/projects/:projectId/expenses/:expenseId` remains a full page. It uses a 5-step stage indicator and a long main detail card for basic info, stage rows, evidence, validation, and history.
- `/projects/:projectId/export` keeps filters -> preview -> download. Default filters represent all period, all categories, and all stages.
