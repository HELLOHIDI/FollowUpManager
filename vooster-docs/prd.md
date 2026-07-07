## FuManager PRD

### 1. 개요
FuManager는 정부지원사업을 수행하는 10인 이하 스타트업 PM/팀장이 사업비 집행 현황을 한눈에 파악하고, 비목(예산 항목)별 지출을 정확히 기록·증빙할 수 있는 정부지원사업비 집행 후속관리 대시보드(MVP)이다.

### 2. 문제 정의
- 현재 Notion·Airtable·스프레드시트 등 여러 툴을 병행하며 잔액·지출 정보를 수작업으로 집계한다.
- 예산 초과와 증빙 누락을 실시간으로 알 수 없어 뒤늦게 오류를 발견한다.
- 기관별 보고서 작성을 위해 데이터를 다시 정리해야 해 시간이 많이 든다.

### 3. 목표
1. PM/팀장이 사업비 잔액·소진률과 비목별 지출 현황을 한 화면에서 확인할 수 있다.
2. 지출 발생 시 비목·금액·단계·증빙을 누락 없이 기록하고 보완할 수 있다.
3. 사업별 정책 문서를 기준으로 필요한 비목과 증빙 요건을 관리할 수 있다.

### 4. 주요 사용자
- 정부지원사업을 운영하는 스타트업(10인 이하)의 PM/팀장(내부 사용자만 사용).

### 5. 핵심 사용 시나리오
1. 프로젝트 Kick-off 시 회사·사업·비목 정보를 등록한다.
2. 지출 발생 즉시 항목·금액을 빠르게 등록하고, 지출 상세 화면에서 단계별 정보와 증빙파일을 보완한다.
3. 대시보드에서 잔액·소진률과 비목별 지출 현황을 실시간으로 확인한다.
4. 필요 시 대시보드와 상세 데이터를 참고해 외부 보고 자료를 작성한다.

### 6. 기능 요구사항 (MVP)
| 분류 | 기능 | 우선도 |
|---|---|---|
| 기업 관리 | 기업(사업자) 등록/수정/삭제 | High |
| 사업 관리 | 사업 등록/수정/삭제 (기관·사업 기간·총예산) | High |
| 비목 관리 | 비목(예산 항목) 등록/수정/삭제, 예산액 입력 | High |
| 지출 관리 | 지출 내역 CRUD, 비목 연결, 단계별 누적 입력, 증빙 파일 업로드, 변경 히스토리 확인 | High |
| 대시보드 | 총 예산 대비 잔액·소진률, 비목별 지출 목록, 지출 칸반 | High |
| 계정·권한 | Supabase Auth 기반 단일 내부 계정 로그인, 다중 권한 관리 제외 | Low / 제외 |
| 알림·보고서 | 예산 초과 알림, PDF 보고서 자동 생성 | 제외 (차후) |

### 7. 비기능 요구사항
- 웹(반응형) 기반, 크로스 브라우저 지원(Chrome, Edge, Safari 최신).
- 데이터 저장소는 Supabase PostgreSQL, 파일 저장소는 Supabase Storage.
- 초기 50명 이하 사용자, 1만 건 미만 트랜잭션을 가정.
- 배포는 Vercel, GitHub Actions CI/CD.

### 8. 판단 기준
- 등록한 사업의 예산·잔액·집행 단계가 현재 데이터 기준으로 일관되게 표시된다.
- 지출 상세에서 단계별 입력값, 증빙 파일, 변경 이력을 확인하고 보완할 수 있다.
- 정책 PDF가 확정된 사업은 정책 기준 비목·하위비목·증빙 요건이 신규 지출에 반영된다.

### 9. 일정(4주 MVP)
1주차: 요구사항 확정, 데이터 모델 설계, 프로젝트 세팅
2주차: 기업/사업/비목 CRUD 완성, 인증 설정
3주차: 지출 입력 + 파일 업로드, 기본 대시보드 시각화
4주차: QA, UX 다듬기, 배포 및 내부 테스트

### 10. 리스크 및 대응
- 사용자 입력 오류 → 필수 필드 검증, 금액 범위 체크
- 규정 변경 → 데이터 모델 유연성 확보, 비목 코드 테이블화
- 파일 용량 증가 → Supabase Storage 사용량 모니터링, 압축 권장

### 11. 향후 로드맵(후순위)
- 예산 초과 실시간 알림(이메일/슬랙)
- OCR 기반 증빙 자동 입력
- 역할/권한 다중 계정 관리
## Operation Dashboard Slice 1 contract (2026-06-23)

- `/projects/:projectId` is a protected, read-only dashboard slice.
- KPI values are total project budget, completed spend, remaining budget, and budget burn ratio. Completed spend includes only active `execution_completed` expenses.
- The five ordered expense stages are `budget_registration` (사업비 등록), `pre_approval` (사전 승인), `execution_in_progress` (집행 수행), `execution_request` (집행 요청), and `execution_completed` (집행 완료).
- `expenses.amount` is the only current amount. Category groups are created only by active expenses and show category name, expense count, total amount, and child title/amount/stage.
- Search, filters, quick registration, kanban behavior, mutations, evidence, and detail editing are outside this slice.

## Expense Detail Workbench contract (2026-07-07)

- `/projects/:projectId/expenses/:expenseId`는 좌측 5단계 vertical progress stepper와 우측 selected-stage workbench를 사용한다.
- 저장된 현재 단계는 강한 accent/gradient로 표시한다. 다른 단계를 클릭하면 workbench 미리보기만 바뀐다.
- 실제 단계 변경은 `이 단계로 이동` 버튼으로만 수행하며, 전/후/건너뛰기 이동을 모두 허용한다.
- 각 단계의 V1 업무절차는 `사전 준비`, `담당자 확인`, `PMS 등록`, `최종 승인`으로 고정하고 사용자가 직접 완료 체크, 완료일, 메모를 입력한다.
- 기업양식은 workbench 상단의 닫힌 토글에 표시하며, 현재 지출 비목에 필요한 모든 집행서류를 먼저 보여주고 연결된 기업양식은 각 서류의 접힌 하위항목으로 다운로드 제공한다.
- 필요 증빙서류는 별도 섹션으로 반복 표시하지 않는다.
