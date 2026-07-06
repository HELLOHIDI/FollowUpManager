# FuManager Design Guide

## 1. Overall Mood (전체적인 무드)
- 컨셉: Trustworthy & Professional(차분한 컬러, 정돈된 레이아웃)
- 의도: 사업비 잔액·소진률, 비목별 지출, 단계별 증빙 상태를 명확히 확인할 수 있도록 가독성을 최우선으로 한 정보 설계와 안정적인 쿨 톤 팔레트를 채택합니다.
- 사용자 여정 반영:
  - 온보딩: 이번 Slice는 `/settings/company`의 기업 등록·수정까지만 제공하며 대시보드 연결은 후속 Slice에서 제공
  - 사업 생성 후: KPI 카드와 차트가 0 기준으로 생성, 비목 보드(노션형)에서 빠르게 예산 구조 확정
  - 지출 관리: 비목별 지출 카드를 칸반으로 단계 이동, 자동 갱신으로 즉시 현황 확인
- 무드 키워드: 명료함, 신뢰, 절제된 컬러 사용, 데이터 우선

## 2. Reference Service (참조 서비스)
- Name: Linear
- Description: 이슈/프로젝트 트래킹 도구
- Design Mood: 미니멀, 차분한 모노톤 기반, 절제된 액센트 블루와 정교한 인터랙션
- Primary Color: #3182F6
- Secondary Color: #0B0F19

## 3. Color & Gradient (색상 & 그라데이션)
- Palette Mood: Toss-inspired clear blue, soft neutral surfaces, strong numeric contrast
- Primary Color: Toss Blue #3182F6 (주요 액션, 링크/강조, 활성 포커스)
- Primary Strong: #2272EB (작은 CTA, hover/pressed, 대비 보강)
- Secondary/Navi: Toss Gray #191F28 / #333D4B (헤더/내비게이션, 강조 타이포)
- Accent — Success: #03B26C
- Accent — Warning: #FE9800
- Accent — Error: #F04452
- Accent — Info: #18A5A5
- Grayscale
  - G-900 #191F28
  - G-800 #333D4B
  - G-700 #4E5968
  - G-600 #6B7684
  - G-500 #8B95A1
  - G-400 #B0B8C1
  - G-300 #D1D6DB
  - G-200 #E5E8EB
  - G-100 #F2F4F6
  - G-50  #F9FAFB
- Chart Palette(비목 구분 예시 6색): #3182F6, #18A5A5, #03B26C, #FE9800, #F04452, #A234C7
- Color Usage(우선순위별)
  - 배경: G-50/G-100, 카드/표는 G-100/G-200
  - 본문 텍스트: G-800, 보조 텍스트: G-600
  - 인터랙션: Primary(#3182F6) — 핵심 CTA/링크/포커스 링
  - 경계선/디바이더: 1px G-200, Hover 시 G-100로 미세 음영
  - 상태/알림/배지: Success/Warning/Error/Info를 weak/fill 배지와 명확한 텍스트로 표시. 아이콘은 꼭 필요한 액션에만 제한
- 접근성: 본문 대비 AA 4.5:1 이상, 버튼 레이블 AA 3:1 이상
- 접근성 추가 기준: 핵심 숫자/금액/비율은 AA보다 강한 대비를 우선하고, 작은 CTA/텍스트 링크는 Primary Strong(#2272EB)을 사용합니다.

## 4. Typography & Font (타이포그래피 & 폰트)
- Primary Font: Pretendard(한글/영문 겸용), system-ui 폴백
- Numeric/Code: Tabular 숫자 활성(가능 시), 대안으로 Inter/JetBrains Mono 혼용 허용
- Type Scale(기본 라인하이트 1.4~1.6)
  - H1: 28px / 700
  - H2: 22px / 600
  - H3: 18px / 600
  - Body: 14px / 400
  - Small: 12px / 500
  - Caption: 11px / 500
- 원칙
  - 대문자 남용 지양, 자간/색 대비로 계층 구분
  - 숫자/금액 컬럼은 고정 폭 폰트 또는 Tabular 옵션 적용

## 5. Layout & Structure (레이아웃 & 구조)
- Navigation: 글로벌 좌측 사이드바는 MVP에서 사용하지 않습니다. 핵심 화면은 `/projects/:projectId` 단일 대시보드 중심으로 구성하고, 상단 `UtilityBar`와 대시보드 내부 `LocalNavPills` 앵커 내비게이션을 사용합니다.
- 지출 상세: 칸반 카드 클릭 시 `/projects/:projectId/expenses/:expenseId` 풀페이지로 이동합니다. 대시보드는 현황 파악과 빠른 생성에 집중하고, 상세 풀페이지는 단계별 누적 입력·증빙·히스토리 관리를 담당합니다.
- UtilityBar 구성
  - 좌측: `ProjectSwitcher`, `DateRangePreset`
  - 중앙: `GlobalSearch`
  - 우측: `+ 지출` 버튼, 설정 메뉴
- LocalNavPills 구성: `#overview`, `#categories`, `#kanban` 앵커 기반 이동과 Scrollspy 상태 표시
- 대시보드 섹션 순서
  1) KPI 카드(3개): 소진액, 잔액, 예산소진율
  2) 비목별 지출 목록: 비목 그룹 아래 하위 지출을 묶고 금액·단계 중심으로 확인
  3) 지출 보드(칸반): 단계별 진행 관리
- Grid & Spacing
  - Grid: Desktop 12col(24px gutter), Tablet 8col(16px), Mobile 4col(12px)
  - Spacing Scale: 4/8/12/16/24/32/40
  - KPI 카드: Desktop 3열, Tablet 2열, Mobile 1열
- 반응형
  - 데스크톱 우선, 태블릿 완전 대응
  - 모바일은 현황 조회·간단 입력 위주(첨부는 기기 파일/카메라 허용)

## 6. Visual Style (비주얼 스타일)
- 아이콘: 기본 UI에서는 최소화하고, 뒤로가기·검색·파일 첨부·더보기·닫기·삭제처럼 의미 전달에 필요한 액션에만 사용
- 이미지/일러스트: 업무툴 특성상 최소화, 빈 상태/튜토리얼에서도 장식보다 명확한 텍스트와 단일 CTA 우선
- 차트: 모노톤 베이스, 선택/하이라이트만 컬러. 범례는 12px Small, 툴팁은 숫자 정렬 우선
- 로딩/상태: Skeleton + 미세한 Shimmer, 토스트는 우상단 3초(오류는 수동 닫기)
- 포커스: 2px 외곽선 Primary 40% 투명, 키보드 내비 명확 표기

## 7. UX Guide (UX 가이드)
- 대상: 전문가+초보자 모두
  - 전문가: 키보드 퍼스트, 인라인 편집, 단축키(N: 새 지출, /: 검색, Cmd/Ctrl+S: 저장, ] [ : 단계 이동)
  - 초보자: 온보딩 체크리스트, 툴팁(비목/소진률/잔액 용어), 빈 상태 가이드
- 기업 설정 흐름
  1) `/settings/company`에서 등록 기업 목록과 선택 기업 폼을 나란히 표시
  2) 기업 추가 시 빈 등록 폼을 유지하고, 기존 기업 선택 시 수정 폼으로 전환
  3) 법인 선택 시에만 법인등록번호를 노출하고, 기업규모 미확정은 검토 필요 배지로 안내
  4) 기업 등록 후 사업 또는 대시보드로 자동 이동하지 않는다.
- 비목별 지출 목록
  - 비목은 그룹 기준으로 표시하고, 같은 비목의 지출은 하위항목으로 묶어 표시
  - 하위 지출 항목은 지출명, 금액, 단계만 우선 노출
  - 비목별 합계와 지출 건수를 그룹 헤더에서 확인
- 지출 칸반(5단계, forward-only 이동)
  1) 사업비 등록: 비목/금액/예상 날짜
  2) 사전 승인: 승인일자, 승인번호/링크, 승인서 파일
  3) 집행 수행: 수행 시작일, 계약/발주서(권장)
  4) 집행 요청: 신청일, 영수증/세금계산서 파일
  5) 집행 완료: 최종 정산 금액, 완료 시점, 정산 증빙
  - Slice 3의 단계 이동은 다음 단계로만 진행한다. 역방향 이동, 드래그 앤 드롭, 자동 이력은 후속 slice로 미룬다.
  - `+ 지출`: 칸반이 아니라 `/projects/:projectId/expenses` 빠른 등록 페이지를 연다. 지출 제목·비목 선택·금액·예상 날짜·메모만 우선 입력한다.
  - 카드 상세: 카드 클릭 시 우측 드로어를 열지 않고 지출 상세 풀페이지로 이동합니다. 상세 풀페이지에서 예상 지출일, 거래처, 단계별 입력정보, 증빙, 변경 히스토리를 관리합니다.
- 지출 상세 풀페이지
  - 상단: 뒤로가기, 지출 제목, 비목, 대표 금액, 현재 단계, 저장 상태, 단계 이동 버튼을 한 줄로 배치합니다.
  - 진행상태: 사업비 등록 → 사전 승인 → 집행 수행 → 집행 요청 → 집행 완료 5단계 스텝퍼를 사용합니다.
  - 본문: 단계별 입력정보를 누적 섹션으로 표시하고, 현재 단계 섹션은 테두리·배지·헤더 색으로 강조합니다.
  - 우측 패널: 선택된 비목 정책, 증빙 현황, 변경 히스토리 요약을 sticky 패널로 제공합니다.
  - 이전 단계 정보는 접힘/펼침이 가능하되, 항상 수정할 수 있어야 합니다.
  - 소프트 게이트: 단계 이동 시 누락 정보와 준비 항목을 안내하되, forward-only 이동 자체는 허용합니다.
- 파일 업로드
  - 어디서든 드래그 시 포커스 카드로 업로드, 진행률/실패 재시도 제공
  - 중복 방지: 파일 해시 기반 감지 → “기존 사용/새로 추가” 선택
- 마이크로카피 톤
  - 짧고 명확: “저장됨 2초 전”, “승인번호가 비어 있어요”
  - 경고는 해결책 동반: “집행 요청에는 영수증 파일이 필요해요 — 지금 추가할까요?”

## 8. KPI 계산 및 대시보드 규칙
- KPI 구성(3개 고정)
  1) 소진액: “집행 완료” 단계 카드 금액 합계
  2) 잔액: 총예산 − 소진액
  3) 예산소진율(협약기간 대비): (소진액/총예산) ÷ (경과일/전체일) × 100
     - 임계값 컬러: 100% 초과 시 Error, 80~100% Warning, 미만은 Default
     - 표기 예: 120%(기간 대비 초과), 75%(적정 이하)
- 표시 방식
  - KPI 카드는 단색 모노톤 바탕에 수치 강조(숫자 우선, 단위/설명 보조)
  - 예산소진율: 원형 게이지 또는 세그먼트 바(프로젝트 길이에 관계없는 직관)

## 9. UI Component Guide (UI 컴포넌트 가이드)
- 버튼
  - Fill Primary: 배경 #3182F6, 텍스트 #FFFFFF, Hover/Pressed: #2272EB, 핵심 CTA
  - Fill Dark: 배경 #4E5968, 텍스트 #FFFFFF, 강한 중립 액션
  - Fill Danger: 배경 #F04452, 텍스트 #FFFFFF, 파괴적 확인
  - Weak Primary: 배경 #E8F3FF, 텍스트 #2272EB, 보조 CTA
  - Weak Neutral: 배경 #F2F4F6, 텍스트 #4E5968, 취소/닫기/초기화
  - Weak Danger: 연한 Red 배경, 진한 Red 텍스트, 약한 위험 액션
  - 크기: 기본 40px, S 32px, 강조 CTA 48px, 단일 주요 CTA는 최대 52px. 모서리는 기본 10px, 강조 12px
- 입력 필드
  - 기본 Box: 높이 44px, G-50 배경, G-200 테두리, 10px 모서리, Focus Toss Blue 2px 외곽선
  - Amount: 오른쪽 정렬, tabular 숫자, 금액/KPI 입력에 사용
  - Search: 40px 높이, 검색/필터에 사용
  - Compact: 32px 높이, 테이블/목록 인라인 편집에만 사용
  - 에러: Red #F04452 테두리 + 구체적인 해결 문구
- 셀렉트/칩 필터
  - 태그형 칩: 선택 시 배경 G-200, 활성은 Primary 테두리
- 날짜 선택
  - 단일 날짜 + 기간 프리셋(이번 달/분기/협약기간)
- 파일 업로더
  - 드롭존: 점선 G-300, Hover G-200, 진행률 바 Primary
- 카드
  - 기본: 흰 배경, 12px 모서리, 20~24px padding, 아주 약한 shadow
  - KPI 카드: 아이콘보다 숫자 우선, 수치 대(22~28px), 라벨 소(12px), tabular 숫자
  - 비목 카드: 이름/예산액/남은액, 합계 바 포함. 색상 장식은 상태/진행 의미가 있을 때만 사용
- 테이블
  - 고정 헤더, 열 정렬/필터, 행 Hover G-50
  - 인라인 편집: Enter 확정, Esc 취소
- 칸반 보드
  - 칼럼 헤더: 제목 + 개수 + 합계 금액 배지
  - 카드: 제목(자동: [비목] 금액/날짜), 준비도 배지, 핵심 메타(승인번호/신청일 등)
  - 드래그 상태: 살짝 상승 + 그림자 최소화
- 패널/모달
  - 모달: 빠른 지출 등록, 확인, 경고 위주로 사용합니다.
  - 드로어: 후속 사업 설정처럼 짧은 보조 작업에 한정합니다. 기업 등록·수정은 `/settings/company` 페이지에서 처리합니다.
  - 지출 상세 편집은 드로어가 아니라 풀페이지 레이아웃을 사용합니다.
  - 지출 상세 풀페이지는 데스크톱 12컬럼 기준 본문 8컬럼, 우측 sticky 패널 4컬럼을 권장합니다.
- 네비게이션
  - UtilityBar: 프로젝트 스위처, 기간 필터, 검색, `+ 지출`, 설정 메뉴를 한 줄에 배치합니다.
  - LocalNavPills: 개요, 비목별 지출, 지출 칸반 섹션을 앵커로 이동하며 현재 섹션은 Primary 상태로 표시합니다.
  - 좌측 고정 사이드바는 MVP 이후 다중 제품/조직 단위 확장이 필요할 때만 재검토합니다.
- 토스트/배지
  - 일반 저장은 inline 또는 짧은 토스트, 오류는 수동 닫기
  - 배지는 기본 weak, 오류·차단·완료처럼 강한 의미에만 fill 사용
  - 배지 문구는 색 없이도 의미가 전달되도록 `검토 필요`, `증빙 누락`, `완료`, `초과`처럼 구체적으로 작성

## 10. 데이터·검증·접근성 메모
- 상태(status): 사업비 등록, 사전 승인, 집행 수행, 집행 요청, 집행 완료
- 준비도 계산: 단계별 필드 충족 여부로 자동 0–100%
- 입력 검증: 금액 음수 차단, 통화 포맷, 날짜 유효성
- 집계 기준: 소진액은 ‘집행 완료’만 합산(실제 집행 근거)
- 접근성: 키보드 내비 완전 지원, 포커스 인디케이터, 스크린 리더 레이블(비목/소진률/잔액 명시)

## 11. 페이지별 핵심 흐름 요약
- 설정(기업): 기업 목록 선택 또는 추가 → 기본 정보 입력 → 저장 → 현재 설정 페이지 유지
- 대시보드(사업 컨텍스트)
  - KPI 3개 확인 → 비목별 지출 목록에서 그룹별 지출 확인 → 지출 보드에서 단계별 관리
- 사업
  - 새 사업 등록(과제명/기관/총예산/기간) → 해당 대시보드 생성
- 지출
  - +지출 → 빠른 등록 페이지 → 카드 생성 → 카드 클릭 → 지출 상세 풀페이지 이동 → 일정/거래처/단계별 입력/증빙 보완 → forward-only 단계 이동 → 집행 완료 시 대시보드 자동 반영
## 12. 마이크로카피 가이드
- 톤: 친절·직관·지시형(불필요한 수식어 최소화)
- 예시
  - “사전 승인 준비도 66% — 승인번호가 비어 있어요”
  - “집행 요청에는 영수증이 필요해요 — 지금 추가할까요?”
  - “저장됨 2초 전 · 모든 변경 사항이 반영되었습니다”

---
## Current+Color implementation alignment (2026-06-26)

- The approved direction is `Current+Color`: preserve the current workflow structure and improve hierarchy with semantic color, accent bars, badges, and light surface depth.
- Canonical expense stage labels are `사업비 등록`, `사전 승인`, `집행 수행`, `집행 요청`, `집행 완료`.
- `budget_registration` displays as `사업비 등록`, not `예산 등록`.
- Dashboard order is KPI -> category spend -> kanban.
- Category spend is a vertical category-group list. Each group is collapsed by default and expands with an accessible `aria-expanded` control.
- Category stage summaries are computed from child expense counts in canonical stage order and omit zero-count stages.
- Expense detail uses a full-width long-card flow after the 5-step stepper. Do not introduce a fixed right Checklist panel.
## Operation Dashboard Slice 1 presentation (2026-06-23)

- KPI cards use 3/2/1 columns on desktop/tablet/mobile. Won values use right-aligned tabular numerals.
- Burn ratio has a semantic accessible label and is never visually clamped when the persisted value is invalid; invalid values render the integrity-error state instead.
- Category headers show name, count, and sum. Child rows prioritize title, amount, and stage, remain keyboard reachable, and use the existing focus treatment.
- Skeleton loading, valid empty categories with retained KPIs, distinct 404, integrity, and retryable error panels are required.

---

## Current+Color UI direction from Figma (2026-06-26)

Source: Figma `FuManager UI System Wireframes`
(`https://www.figma.com/design/PJN5kW4PRknfi0bM8maGtM`).

The approved direction is not the dense `Proposed` structural redesign. Keep the
current workflow shape and make it stronger with a clearer visual system:

- Use semantic color, accent bars, badges, and light surface depth to reduce the
  previous black/gray-heavy flat feeling.
- Keep the dashboard order as KPI -> category spend -> kanban.
- KPI cards may use colored numeric emphasis and small accent indicators.
- Category spend must be a vertical list of category groups. Do not render
  category cost groups as horizontal chips. Each row should expose category name,
  count, representative child expense text, stage, and amount.
- Kanban must use the five canonical stages in real design and implementation:
  `사업비 등록`, `사전 승인`, `집행 수행`, `집행 요청`, `집행 완료`.
  Any 3-stage Figma badge example is only a color-direction placeholder.
- Expense detail should not use a fixed right Checklist panel for the current
  direction. Use a long, full-width stage detail card after the stepper.
- Expense detail fields, evidence, history, and validation should be modeled as
  rows or sections inside the long card so later requirements can add, remove, or
  reorder them without redesigning a side panel.
