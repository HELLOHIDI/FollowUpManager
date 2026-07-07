# Expense Execution Policy

> 2026-07-07 update: 지출 상세는 좌측 vertical progress stepper와 우측 selected-stage workbench를 기준으로 한다. 단계 이동은 전/후/건너뛰기 모두 허용하며, `이 단계로 이동` 버튼으로만 저장한다. 기업양식은 현재 지출 비목에 필요한 모든 집행서류를 부모 행으로 보여주고, 연결된 양식은 각 서류의 접힌 하위항목으로 다운로드 제공한다. 필요 증빙서류는 별도 섹션으로 반복 표시하지 않는다.

## 1. 문서 역할

이 문서는 FuManager에서 지출이 어떤 단계로 관리되고, 각 단계에서 어떤 정보를 입력해야 하는지 정의하는 도메인 정책 문서다.

이 문서는 정부지원사업비 집행 가능 여부를 최종 판단하기 위한 규칙이 아니다.
MVP 단계에서는 사용자가 개별 지출의 진행 상태를 관리하고, 단계별로 필요한 정보를 순차적으로 입력하도록 돕는 제품 운영 정책으로 사용한다.

Codex는 이 문서를 아래 기능을 구현할 때 참조한다.

```text
- 지출 칸반 5단계 구성
- 지출 카드 생성/수정
- 지출 카드 단계 이동
- 지출 빠른 등록 페이지와 지출 상세 풀페이지의 단계별 입력 필드 표시
- 단계별 입력 누락 안내
- 집행 완료 단계 기준 소진액 집계
- 지출 변경 히스토리 표시 기준
```

Codex는 이 문서를 아래 기능의 기준으로 사용하지 않는다.

```text
- 비목별 기본 증빙 정책 정의
- 증빙 파일 document_key 표준화
- 정산 적합성 최종 판정
- 자동 환수 또는 제재 판단
- OCR 기반 증빙 자동 분류
- 복잡한 정책 검증 엔진
```

비목별 증빙서류와 유의사항은 `budget-category-policy.md`를 참조한다.
파일 업로드, document_key, 저장 경로 등 증빙 파일 정책은 `evidence-policy.md`를 참조한다.

---

## 2. 핵심 개념

FuManager의 실행 단위는 “비목”이 아니라 “지출”이다.

비목은 지출을 분류하기 위한 예산 항목이며, 단계, 상태, 증빙, 승인, 수행, 집행 신청 정보는 모두 개별 지출에 귀속된다.

```text
비목 = 지출의 분류 기준
지출 = 실제 실행·관리 단위
```

예시:

```text
앱 개발 외주 지출
- 비목: 외주용역비
- 단계: 사전 승인
- 금액: 25,000,000원
- 거래처: ABC소프트
- 증빙: 계약서, 비교견적서, 승인자료
```

비목 자체는 단계 상태를 가지지 않는다.
지출만 단계 상태를 가진다.

---

## 3. 정책 목적

지출 실행 정책은 FuManager의 지출을 아래 5단계로 관리하기 위해 정의한다.

```text
1. 사업비 등록
2. 사전 승인
3. 용역 수행
4. 집행 신청
5. 집행 완료
```

각 단계는 사용자가 실제 사업비를 집행하기 전후의 진행 상태를 관리하기 위한 운영 상태다.

이 정책의 핵심 목적은 다음과 같다.

```text
- 사용자가 지출 진행 상태를 한눈에 파악할 수 있게 한다.
- 지출 정보를 처음부터 모두 입력하지 않고 단계별로 점진 입력할 수 있게 한다.
- 단계별로 필요한 정보를 지출 상세 풀페이지에 누적 표시한다.
- 입력 누락이 있어도 단계 이동은 허용하되, 부족한 항목은 안내한다.
- 실제 소진액은 집행 완료 단계 기준으로 계산할 수 있게 한다.
```

---

## 4. 지출 단계 기본 구조

FuManager의 지출 단계는 아래 key를 사용한다.

```ts
type ExpenseStageKey =
  | "sales_completed"
  | "pre_approval"
  | "execution_in_progress"
  | "execution_request";
```

화면 표시명은 다음과 같다.

```text
sales_completed: 영업 완료
pre_approval: 사전 승인
execution_in_progress: 용역 수행
execution_request: 집행 신청
```

---

## 5. 단계별 의미

### 5-1. 영업 완료

```text
stage_key: sales_completed
stage_name: 영업 완료
```

#### 단계 의미

비목별 지출 예정 금액과 기본 정보를 확정하는 단계다.

이 단계는 실제 사업비를 집행한 상태가 아니라, 향후 집행 예정인 지출을 등록하고 관리하는 상태다.

#### 사용 예시

```text
- 외주용역비로 앱 개발 외주 1,500만원 사용 예정
- 재료비로 시제품 부품 300만원 구매 예정
- 광고선전비로 마케팅 캠페인 500만원 집행 예정
```

---

### 5-2. 사전 승인

```text
stage_key: pre_approval
stage_name: 사전 승인
```

#### 단계 의미

2천만원 기준 거래 또는 주관기관 확인이 필요한 지출에 대해 사전 승인, 사전 심의, 비교견적서 준비 상태를 관리하는 단계다.

정확한 기준이 “2천만원 이상”인지 “2천만원 초과”인지는 사업별 세부관리기준 또는 주관기관 안내를 따른다.
FuManager에서는 이를 “2천만원 기준 거래”로 표현한다.

#### 사용 예시

```text
- 외주용역비 지출이 2천만원 기준에 해당하여 사전심의 준비
- 주관기관 담당자에게 집행 가능 여부 확인 중
- 비교견적서 또는 승인 관련 파일 준비 중
```

---

### 5-3. 용역 수행

```text
stage_key: execution_in_progress
stage_name: 용역 수행
```

#### 단계 의미

기관 또는 주관기관 확인 이후 실제 용역, 구매, 제작, 교육, 광고, 출장 등이 진행 중인 상태를 관리하는 단계다.

단계명은 “용역 수행”이지만, 외주용역비에만 한정하지 않는다.
재료 구매, 장비 구매, 교육 수강, 광고 집행, 출장 등 실제 수행 또는 진행 중인 지출도 이 단계에서 관리할 수 있다.

#### 사용 예시

```text
- 외주 개발 용역 진행 중
- 광고 캠페인 집행 중
- 교육 수강 진행 중
- 장비 구매 후 납품 대기 중
```

---

### 5-4. 집행 신청

```text
stage_key: execution_request
stage_name: 집행 신청
```

#### 단계 의미

용역 수행, 구매, 교육, 광고, 출장 등이 완료된 후 실제 사업비 집행을 신청하는 단계다.

이 단계는 실제 사업비 집행 근거가 되는 최종 단계다.
FuManager의 대시보드에서 실제 소진액은 기본적으로 이 단계의 최종 집행 금액을 기준으로 집계한다.

#### 사용 예시

```text
- 세금계산서 수취 후 사업비 집행 신청
- 결과보고서와 검수조서 준비 후 집행 신청
- 최종 금액 확정 후 증빙자료 업로드
```

---

## 6. 단계별 추가 입력값 정책

FuManager의 지출은 단계가 이동할 때마다 필요한 입력값이 점진적으로 추가된다.

사용자가 처음부터 모든 정보를 입력하도록 강제하지 않고, 지출 진행 상황에 맞춰 필요한 정보를 순차적으로 입력하도록 돕는다.

중요한 기준은 다음과 같다.

```text
- 입력값은 비목이 아니라 개별 지출에 저장한다.
- 비목은 지출의 분류 기준으로만 사용한다.
- 단계가 이동되면 해당 단계에 필요한 입력 필드가 지출 상세 풀페이지에 추가로 표시된다.
- 이전 단계에서 입력한 값은 유지된다.
- 다음 단계로 이동한 뒤에도 이전 단계 입력값을 수정할 수 있다.
- 입력값이 부족해도 MVP에서는 단계 이동을 차단하지 않는다.
- 부족한 항목은 지출 카드, 지출 상세 풀페이지, 단계 이동 확인 UI에서 안내한다.
```

---

## 7. 단계별 입력값 정의

### 7-1. 영업 완료 단계 입력값

```text
stage_key: sales_completed
stage_name: 영업 완료
```

#### 단계 목적

비목과 예상 금액을 중심으로 기본 지출 예정 정보를 확정한다.

#### 기본 입력값

```text
- 지출 제목
- 비목
- 예상 금액
- 예상 지출일
- 거래처명
- 간단 메모
```

#### 권장 입력값

```text
- 거래처 담당자
- 거래처 연락처
- 내부 담당자
- 관련 사업계획서 항목 메모
```

#### 화면 안내 문구

```text
비목과 예상 금액을 먼저 확정해주세요.
이 단계에서는 실제 집행 전 지출 예정 정보를 관리합니다.
```

---

### 7-2. 사전 승인 단계 입력값

```text
stage_key: pre_approval
stage_name: 사전 승인
```

#### 단계 목적

2천만원 기준 거래 또는 주관기관 확인이 필요한 지출에 대해 사전 승인 준비 정보를 관리한다.

#### 추가 입력값

```text
- 사전 승인 필요 여부
- 승인 요청일
- 승인 상태
- 승인번호 또는 승인 링크
- 비교견적서 준비 여부
- 사전 승인 관련 파일
- 주관기관 확인 메모
```

#### 승인 상태 옵션

```ts
type PreApprovalStatus =
  | "not_required"
  | "required"
  | "requested"
  | "approved"
  | "rejected"
  | "needs_review";
```

#### 승인 상태 표시명

```text
not_required: 승인 불필요
required: 승인 필요
requested: 승인 요청 완료
approved: 승인 완료
rejected: 반려
needs_review: 확인 필요
```

#### 화면 안내 문구

```text
사전 승인 또는 사전심의가 필요한 지출인지 확인해주세요.
2천만원 기준 거래는 비교견적서와 승인 자료를 함께 준비하는 것이 좋습니다.
```

---

### 7-3. 용역 수행 단계 입력값

```text
stage_key: execution_in_progress
stage_name: 용역 수행
```

#### 단계 목적

기관 또는 주관기관 확인 이후 실제 용역, 구매, 제작, 교육, 광고, 출장 등이 진행 중인 상태를 관리한다.

#### 추가 입력값

```text
- 수행 시작일
- 수행 종료 예정일
- 계약서 또는 발주서
- 과업 내용
- 수행 상태 메모
- 중간 산출물
- 거래처 담당자 정보
```

#### 수행 상태 옵션

```ts
type ExecutionProgressStatus =
  | "not_started"
  | "in_progress"
  | "delayed"
  | "completed"
  | "needs_review";
```

#### 수행 상태 표시명

```text
not_started: 수행 전
in_progress: 수행 중
delayed: 지연
completed: 수행 완료
needs_review: 확인 필요
```

#### 화면 안내 문구

```text
기관 확인 이후 실제 수행 중인 지출입니다.
계약서, 과업 내용, 수행 기간, 중간 산출물을 함께 관리해주세요.
```

---

### 7-4. 집행 신청 단계 입력값

```text
stage_key: execution_request
stage_name: 집행 신청
```

#### 단계 목적

용역 수행, 구매, 교육, 광고, 출장 등이 완료된 후 실제 사업비 집행 신청에 필요한 최종 정보를 관리한다.

#### 추가 입력값

```text
- 최종 집행 금액
- 집행 신청일
- 세금계산서 또는 신용카드 영수증
- 결과보고서
- 검수조서
- 증빙사진
- 거래처 사업자등록증
- 거래처 통장사본
- 최종 신청 메모
```

#### 집행 신청 상태 옵션

```ts
type ExecutionRequestStatus =
  | "draft"
  | "ready_to_submit"
  | "submitted"
  | "needs_supplement"
  | "completed";
```

#### 집행 신청 상태 표시명

```text
draft: 작성 중
ready_to_submit: 신청 준비 완료
submitted: 신청 완료
needs_supplement: 보완 필요
completed: 집행 완료
```

#### 화면 안내 문구

```text
실제 사업비 집행을 신청하는 단계입니다.
최종 금액과 필수 증빙자료가 준비되었는지 확인해주세요.
```

---

## 8. 단계 이동 정책

MVP에서는 단계 이동을 강제로 차단하지 않는다.

단계별 입력값이 부족하더라도 사용자는 다음 단계로 이동할 수 있다.
다만 부족한 정보가 있는 경우 카드, 지출 상세 풀페이지, 단계 이동 확인 UI에서 안내 문구를 표시한다.

```text
- 미입력 항목이 있어도 단계 이동 가능
- 부족한 정보는 안내 배지 또는 도움말로 표시
- 이전 단계 정보는 다음 단계에서도 수정 가능
- 저장 차단은 데이터 무결성 오류에만 적용
```

### 저장 차단 대상

아래 항목은 데이터 무결성 오류이므로 저장을 차단할 수 있다.

```text
- 지출 제목이 없음
- 비목이 선택되지 않음
- 금액이 음수
- 날짜 형식이 잘못됨
- 파일 업로드 실패
```

### 단계 이동 시 안내 대상

아래 항목은 단계 이동을 차단하지 않고 안내한다.

```text
- 예상 금액 미입력
- 예상 지출일 미입력
- 승인 상태 미입력
- 비교견적서 준비 여부 미입력
- 계약서 또는 발주서 미첨부
- 수행 시작일 또는 종료 예정일 미입력
- 최종 집행 금액 미입력
- 집행 신청일 미입력
- 증빙자료 미첨부
```

---

## 9. 단계별 필드 표시 정책

지출 상세 풀페이지는 현재 `stage_key`에 따라 필드 그룹을 다르게 표시한다.
지출 빠른 등록 페이지는 영업 완료 카드 생성을 위한 최소 입력만 받는다.

```text
빠른 등록 페이지:
- 지출 제목
- 비목
- 예상 금액
- 간단 메모
```

상세 풀페이지는 현재 단계까지의 정보를 누적해서 표시한다.
현재 단계의 입력 영역은 다른 단계보다 시각적으로 강조하고, 이전 단계 입력 영역은 접힘/펼침과 수정이 가능해야 한다.

### 공통 필드 그룹

모든 단계에서 표시한다.

```text
- 지출 제목
- 비목
- 금액
- 지출 예정일 또는 집행일
- 거래처명
- 메모
- 현재 단계
```

### 영업 완료 필드 그룹

```text
- 예상 금액
- 예상 지출일
- 거래처명
- 간단 메모
```

### 사전 승인 필드 그룹

```text
- 사전 승인 필요 여부
- 승인 요청일
- 승인 상태
- 승인번호 또는 승인 링크
- 비교견적서 준비 여부
- 사전 승인 관련 파일
- 주관기관 확인 메모
```

### 용역 수행 필드 그룹

```text
- 수행 시작일
- 수행 종료 예정일
- 계약서 또는 발주서
- 과업 내용
- 수행 상태 메모
- 중간 산출물
- 거래처 담당자 정보
```

### 집행 신청 필드 그룹

```text
- 최종 집행 금액
- 집행 신청일
- 세금계산서 또는 신용카드 영수증
- 결과보고서
- 검수조서
- 증빙사진
- 거래처 사업자등록증
- 거래처 통장사본
- 최종 신청 메모
```

---

## 9-1. 지출 상세 풀페이지 표시 정책

지출 카드를 클릭하면 우측 드로어가 아니라 해당 지출의 상세 풀페이지로 이동한다.

권장 경로는 다음과 같다.

```text
/projects/:projectId/expenses/:expenseId
```

상세 풀페이지는 데스크톱 화면을 우선으로 설계하며, 아래 정보를 한 화면에서 관리한다.

```text
- 지출 기본정보
- 현재 단계 및 전체 진행단계
- 단계별 누적 입력정보
- 선택된 비목 정책 안내
- 지출별 증빙 파일
- 변경 히스토리
```

### 권장 레이아웃

```text
상단:
- 대시보드로 돌아가기
- 지출 제목
- 비목
- 현재 단계
- 대표 금액
- 저장 상태
- 단계 이동 액션

본문 좌측:
- 단계 진행상태
- 영업 완료 입력정보
- 사전 승인 입력정보
- 용역 수행 입력정보
- 집행 신청 입력정보

우측 고정 패널:
- 비목 정책 안내
- 증빙 현황
- 변경 히스토리 요약
```

### 단계별 누적 표시 기준

```text
영업 완료:
- 영업 완료 입력정보만 강조 표시
- 이후 단계는 미입력 예정 영역으로 표시 가능

사전 승인:
- 영업 완료 정보 유지 및 수정 가능
- 사전 승인 입력정보 강조 표시

용역 수행:
- 영업 완료, 사전 승인 정보 유지 및 수정 가능
- 용역 수행 입력정보 강조 표시

집행 신청:
- 이전 단계 정보 전체 유지 및 수정 가능
- 집행 신청 입력정보와 증빙 현황을 강조 표시
```

이 화면은 장시간 입력, 검토, 증빙 업로드, 이력 확인을 위한 화면이다.
지출 칸반은 현황 파악과 단계 이동의 출발점이며, 상세 풀페이지는 개별 지출의 단일 관리 화면이다.

---

## 9-2. 단계 이동 소프트 게이트 UI 정책

단계 이동 시 입력값이나 증빙이 부족해도 이동을 차단하지 않는다.
다만 이동 전에 아래 정보를 확인할 수 있어야 한다.

```text
- 누락된 정보
- 추가로 준비하면 좋은 항목
- 현재 상태로 계속 이동할지 여부
```

### 표시 예시

```text
사전 승인 단계로 이동할 수 있습니다.
다만 승인 상태와 비교견적서 준비 여부가 아직 비어 있습니다.
현재 상태로 이동하고, 나중에 상세 화면에서 보완할 수 있습니다.
```

저장은 데이터 무결성 오류가 있을 때만 차단한다.
증빙 누락, 권장 필드 미입력, 조건부 증빙 미첨부는 저장 또는 단계 이동 차단 사유가 아니다.

---

## 9-3. 변경 히스토리 정책

지출 상세 풀페이지에서는 지출의 주요 변경 이력을 시간순으로 표시한다.
히스토리는 감사 로그나 법적 증빙이 아니라, 사용자가 지출 진행 맥락을 추적하기 위한 운영 기록이다.

### 히스토리 대상 이벤트

```text
- 지출 생성
- 단계 이동
- 비목 변경
- 금액 변경
- 승인 상태 변경
- 수행 상태 변경
- 집행 신청 상태 변경
- 증빙 파일 업로드
- 증빙 파일 삭제
- 메모 수정
- 주요 단계별 입력정보 수정
```

### 히스토리 표시 항목

```text
- 변경 시각
- 변경 사용자
- 변경 유형
- 변경 내용 요약
- 이전 값과 변경 값(필요 시)
```

### 권장 데이터 구조

```ts
type ExpenseHistoryEvent = {
  id: string;
  expense_id: string;
  event_type:
    | "expense_created"
    | "stage_changed"
    | "category_changed"
    | "amount_changed"
    | "approval_status_changed"
    | "execution_status_changed"
    | "execution_request_status_changed"
    | "evidence_uploaded"
    | "evidence_deleted"
    | "memo_updated"
    | "stage_field_updated";
  changed_by?: string | null;
  changed_at: string;
  summary: string;
  before_value?: Record<string, unknown> | null;
  after_value?: Record<string, unknown> | null;
};
```

---

## 10. 비목과 지출의 관계

비목은 지출의 분류 기준이다.
지출은 실제 실행 상태와 증빙을 가지는 관리 단위다.

```text
사업
  ↓
지출
  ↓
비목은 지출의 분류 속성으로 연결
```

예시:

```text
지출: 앱 개발 외주
- 비목: 외주용역비
- 단계: 사전 승인
- 예상 금액: 25,000,000원
- 승인 상태: 승인 요청 완료
```

```text
지출: 시제품 부품 구매
- 비목: 재료비
- 단계: 집행 신청
- 최종 집행 금액: 3,000,000원
- 증빙: 세금계산서, 검수조서, 증빙사진
```

Codex는 비목을 카드형 실행 단위로 해석하지 않는다.

비목은 아래 용도로만 사용한다.

```text
- 지출 분류
- 지출 필터
- 지출 목록의 배지
- 비목별 금액 요약
- 선택된 비목 기준 정책 안내
```

지출은 아래 정보를 가진다.

```text
- 지출 제목
- 연결된 사업
- 선택된 비목
- 금액
- 거래처
- 현재 단계
- 단계별 입력값
- 증빙 파일
- 메모
- 변경 히스토리
```

---

## 11. 집계 기준

대시보드의 실제 소진액은 기본적으로 `집행 완료` 단계의 지출만 합산한다.

```text
영업 완료: 예상 지출
사전 승인: 승인 준비 지출
용역 수행: 진행 중 지출
집행 신청: 실제 집행 신청 지출
```

따라서 집행 완료 전 단계의 금액은 운영 현황에는 표시할 수 있지만, 실제 소진액에는 포함하지 않는다.

### 금액 필드 기준

```text
영업 완료: 예상 금액
사전 승인: 예상 금액 또는 승인 요청 금액
용역 수행: 계약 금액 또는 예상 금액
집행 신청: 최종 집행 금액
```

### 실제 소진액 기준

```text
actual_spent_amount = 집행 완료 단계의 지출 금액 합계
```

### 비목별 금액 요약 기준

비목별 금액 요약은 지출 데이터를 기준으로 계산한다.

```text
비목별 예상 금액 = 해당 비목으로 분류된 지출의 예상 금액 합계
비목별 진행 중 금액 = 해당 비목으로 분류된 용역 수행 단계 지출 금액 합계
비목별 집행 신청 금액 = 해당 비목으로 분류된 집행 신청 단계 지출의 최종 집행 금액 합계
```

비목 자체에 금액 상태를 저장하지 않는다.
금액 요약은 항상 지출 데이터를 기반으로 계산한다.

---

## 12. 2천만원 기준 거래 안내 정책

사전 승인 단계에서는 2천만원 기준 거래에 대한 안내를 표시할 수 있다.

```text
2천만원 기준 거래는 사업별 세부관리기준에 따라 사전 승인, 사전 심의, 비교견적서 제출이 필요할 수 있습니다.
정확한 기준은 협약서, 사업별 세부관리기준, 주관기관 안내를 우선 확인해주세요.
```

MVP에서는 2천만원 기준 거래를 자동으로 강제 판정하지 않는다.
단, 사용자가 지출 금액을 입력했을 때 안내 문구를 보여줄 수 있다.

```text
이 지출은 2천만원 기준 거래에 해당할 수 있습니다.
사전 승인 또는 비교견적서 필요 여부를 확인해주세요.
```

---

## 13. 단계별 마이크로카피

### 영업 완료

```text
비목과 예상 금액을 먼저 확정해주세요.
```

### 사전 승인

```text
사전 승인 또는 비교견적서가 필요한 지출인지 확인해주세요.
```

### 용역 수행

```text
수행 기간, 계약서, 과업 내용을 함께 관리해주세요.
```

### 집행 신청

```text
최종 금액과 증빙자료를 확인한 뒤 집행 신청 상태로 관리해주세요.
```

---

## 14. 권장 데이터 구조

MVP에서는 아래 구조를 기준으로 지출 데이터를 관리한다.

```ts
type Expense = {
  id: string;
  project_id: string;

  title: string;
  budget_category_key: BudgetCategoryKey;

  stage_key: ExpenseStageKey;

  expected_amount?: number | null;
  approved_amount?: number | null;
  contract_amount?: number | null;
  final_amount?: number | null;

  expected_spend_date?: string | null;
  execution_request_date?: string | null;

  vendor_name?: string | null;
  memo?: string | null;

  pre_approval_status?: PreApprovalStatus | null;
  execution_progress_status?: ExecutionProgressStatus | null;
  execution_request_status?: ExecutionRequestStatus | null;

  stage_fields?: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
};
```

증빙 파일은 별도 테이블 또는 스토리지 메타데이터로 관리할 수 있다.

```ts
type ExpenseEvidenceFile = {
  id: string;
  expense_id: string;

  document_key: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;

  uploaded_at: string;
};
```

지출 변경 히스토리는 별도 이벤트 테이블 또는 감사 로그 형태로 관리할 수 있다.

```ts
type ExpenseHistoryEvent = {
  id: string;
  expense_id: string;
  event_type: string;
  changed_by?: string | null;
  changed_at: string;
  summary: string;
  before_value?: Record<string, unknown> | null;
  after_value?: Record<string, unknown> | null;
};
```

---

## 15. Codex 개발 기준

Codex는 이 정책을 구현할 때 아래 기준을 따른다.

```text
- FuManager의 실행 단위는 지출이다.
- 비목은 지출의 분류 기준이며 실행 상태를 가지지 않는다.
- 지출 칸반은 5단계로 고정한다.
- 지출 카드 클릭은 상세 풀페이지 이동을 기본 흐름으로 한다.
- 단계 key는 budget_registration, pre_approval, execution_in_progress, execution_request, execution_completed를 사용한다.
- 단계 이동은 소프트 게이트로 구현한다.
- 미완료 항목이 있어도 단계 이동은 허용한다.
- 데이터 무결성 오류만 저장을 차단한다.
- 빠른 등록 페이지는 영업 완료 카드 생성을 위한 최소 입력만 받는다.
- 단계별 입력값은 지출 상세 풀페이지에서 점진적으로 누적 표시한다.
- 이전 단계에서 입력한 정보는 다음 단계에서도 유지된다.
- 다음 단계로 이동한 뒤에도 이전 단계 입력값을 수정할 수 있다.
- 입력 누락은 저장 차단이 아니라 안내 배지 또는 도움말로 표시한다.
- 단계별 입력값은 개별 지출에 저장한다.
- 지출 상세 풀페이지는 비목 정책, 증빙 현황, 변경 히스토리를 함께 표시한다.
- 비목별 금액 요약은 지출 데이터를 기반으로 계산한다.
- 대시보드 실제 소진액은 기본적으로 execution_completed 단계의 amount를 기준으로 계산한다.
- 비목별 증빙 세부 기준은 budget-category-policy.md를 참조한다.
- 파일 업로드 및 document_key 정책은 evidence-policy.md를 참조한다.
```

---

## 16. MVP 구현 제외 범위

MVP에서는 아래 기능을 구현하지 않는다.

```text
- 지출 단계별 자동 승인 판정
- 2천만원 기준 거래의 자동 사전승인 강제
- 준비도 점수 계산
- risk flag 계산
- 정산 적합성 최종 판정
- 기관 시스템과의 승인 상태 연동
- OCR 기반 증빙 자동 분류
- 자동 보고서 생성
- 비목 자체의 단계 상태 관리
```

---

## 17. Acceptance Criteria

```text
- FuManager의 실행 단위는 지출로 정의된다.
- 비목은 지출의 분류 기준으로만 사용된다.
- 비목 자체는 단계, 승인 상태, 수행 상태, 집행 신청 상태, 증빙 파일을 직접 가지지 않는다.
- 지출 칸반은 5단계로 표시된다.
- 각 단계는 고유 stage_key를 가진다.
- 사용자는 지출 카드를 단계 간 이동할 수 있다.
- 단계 이동은 소프트 게이트로 동작한다.
- 입력 누락이 있어도 단계 이동은 가능하다.
- 데이터 무결성 오류는 저장을 차단한다.
- 지출 카드 클릭 시 해당 지출의 상세 풀페이지로 이동한다.
- 단계가 이동되면 해당 단계의 추가 입력값이 지출 상세 풀페이지에 표시된다.
- 이전 단계에서 입력한 정보는 다음 단계에서도 유지된다.
- 다음 단계 이동 후에도 이전 단계 입력값을 수정할 수 있다.
- 부족한 입력값은 카드, 상세 풀페이지, 단계 이동 확인 UI에서 안내된다.
- 단계별 입력값은 개별 지출에 저장된다.
- 집행 신청 단계에서는 최종 금액과 증빙자료 입력 영역이 표시된다.
- 지출 상세 풀페이지에서는 변경 히스토리를 시간순으로 확인할 수 있다.
- 대시보드 실제 소진액은 기본적으로 집행 완료 단계의 지출 금액을 기준으로 계산한다.
- 사전 승인 단계에서는 2천만원 기준 거래에 대한 확인 안내를 표시할 수 있다.
- 비목별 금액 요약은 지출 데이터를 기반으로 계산한다.
```
## Authoritative five-stage expense contract (2026-06-23)

This section supersedes earlier four-stage and multi-amount descriptions.

1. `budget_registration` — 예산 등록
2. `pre_approval` — 사전 승인
3. `execution_in_progress` — 집행 중
4. `execution_request` — 집행 요청
5. `execution_completed` — 집행 완료

Stage movement is no longer sequential-only as of 2026-07-07. Users may move to any different canonical stage while retaining entered fields and recording history through the stage mutation. `expenses.amount` is the only current expense amount. Actual spend is `sum(amount)` for active `execution_completed` rows only; `execution_request` is not spend. Remaining is `total_project_budget - spent`, and burn ratio is `spent / total_project_budget`. Negative remaining or a ratio above one is an integrity error, never a value to clamp.

## Operation Dashboard Slice 3 movement boundary (2026-06-24)

This 2026-06-24 Slice 3 boundary is superseded by the 2026-07-07 free-movement workbench contract. Kanban stage movement keeps drag-and-drop as the primary interaction and provides an accessible stage selector as the fallback.

- The stage mutation receives `targetStageKey`.
- The service accepts any different stage from the current `stage_key`; same-stage movement is a UI no-op.
- Reverse movement and multi-stage jumps are allowed.
- Institution- or project-specific custom stage rules may be enabled in a later slice through the same `targetStageKey` contract.
- Missing recommended fields or evidence do not block movement, but Slice 3 does not implement soft-gate UI, missing-info toast, or card badge guidance.
- Automatic `stage_changed` history is deferred; Slice 3 updates only `expenses.stage_key`.
- Moving to `execution_completed` can be rejected by the server/database completed-spend cap. The UI should roll back the optimistic card movement and show a generic error.
