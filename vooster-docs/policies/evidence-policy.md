# Evidence Policy

## 1. 문서 역할

이 문서는 GrantFollow에서 지출에 연결되는 증빙 파일을 어떻게 분류, 업로드, 저장, 표시, 중복 감지할지 정의하는 도메인 정책 문서다.

이 문서는 정산 적합성을 최종 판단하거나 증빙 파일의 진위 여부를 검증하기 위한 규칙 엔진이 아니다.
MVP 단계에서는 사용자가 지출별로 필요한 증빙 파일을 누락 없이 관리하고, 파일 업로드 상태를 쉽게 확인하도록 돕는 파일 관리 정책으로 사용한다.

Codex는 이 문서를 아래 기능을 구현할 때 참조한다.

```text
- 지출별 증빙 파일 업로드
- 증빙 파일 document_key 표준화
- Supabase Storage 저장 경로 설계
- 업로드 파일 메타데이터 저장
- 지출 상세 풀페이지의 증빙 업로드 영역 표시
- 필수/조건부/선택 증빙 상태 표시
- 중복 파일 감지 및 안내
```

Codex는 이 문서를 아래 기능의 기준으로 사용하지 않는다.

```text
- OCR 기반 증빙 자동 판독
- 세금계산서 진위 여부 검증
- 카드 영수증 자동 인식
- 정산 적합성 최종 판정
- 증빙 누락 기반 risk score 계산
- 기관 시스템 자동 제출
- AI 기반 문서 자동 분류
```

비목별로 어떤 증빙이 필요한지는 `budget-category-policy.md`를 참조한다.
지출 단계별로 언제 증빙 입력 영역을 보여줄지는 `expense-execution-policy.md`를 참조한다.

---

## 2. 핵심 개념

GrantFollow에서 증빙 파일은 비목이 아니라 개별 지출에 귀속된다.

```text
비목 = 지출의 분류 기준
지출 = 실제 실행·관리 단위
증빙 파일 = 개별 지출에 연결되는 파일
```

예시:

```text
지출: 앱 개발 외주
비목: 외주용역비
단계: 집행 신청

증빙 파일:
- 계약서
- 세금계산서
- 결과보고서
- 검수조서
- 거래처 사업자등록증
- 거래처 통장사본
```

비목별 정책은 “이 비목으로 분류된 지출에 어떤 증빙이 필요한지”를 안내한다.
증빙 정책은 “그 증빙 파일을 어떤 document_key로 분류하고, 어디에 저장하고, 어떻게 표시할지”를 정의한다.

---

## 3. 정책 목적

증빙 정책의 목적은 다음과 같다.

```text
- 지출별 증빙 파일을 표준화된 document_key로 관리한다.
- 지출 상세 풀페이지에서 필요한 증빙 파일을 명확히 안내한다.
- 업로드된 파일을 Supabase Storage에 일관된 경로로 저장한다.
- 업로드 파일의 메타데이터를 DB에 저장한다.
- 같은 파일이 반복 업로드되는 경우 중복 가능성을 안내한다.
- 필수/조건부/선택 증빙의 업로드 상태를 사용자에게 표시한다.
```

MVP에서는 증빙 파일의 존재 여부와 분류 상태만 안내한다.
파일 내용이 실제로 적합한지, 정산 기준을 충족하는지는 자동 판단하지 않는다.

---

## 4. 증빙 파일 귀속 기준

모든 증빙 파일은 `expense_id`를 기준으로 개별 지출에 연결한다.

```text
사업
  ↓
지출
  ↓
증빙 파일
```

증빙 파일은 비목에 직접 연결하지 않는다.
비목은 지출이 선택한 `budget_category_key` 또는 `budget_category_id`를 통해 간접적으로 참조된다.

예시:

```text
expense_id: exp_001
budget_category_key: outsourcing_cost
document_key: contract
file_name: 앱개발_계약서.pdf
```

---

## 5. 증빙 파일 기본 구조

MVP에서는 증빙 파일을 아래 구조로 관리한다.

```ts
type ExpenseEvidenceFile = {
  id: string;

  company_id: string;
  project_id: string;
  expense_id: string;

  document_key: EvidenceDocumentKey;
  requirement_key?: string | null;

  original_file_name: string;
  stored_file_name: string;
  storage_bucket: string;
  storage_path: string;

  file_size: number;
  mime_type: string;
  file_extension: string;

  file_hash?: string | null;
  duplicate_group_key?: string | null;

  uploaded_by?: string | null;
  uploaded_at: string;

  deleted_at?: string | null;
};
```

### 필드 설명

```text
id
- 증빙 파일 고유 ID

company_id
- 파일이 속한 기업 ID

project_id
- 파일이 속한 사업 ID

expense_id
- 파일이 연결된 지출 ID

document_key
- 파일의 증빙 문서 유형

requirement_key
- budget-category-policy.md의 EvidenceRequirement와 연결할 수 있는 key

original_file_name
- 사용자가 업로드한 원본 파일명

stored_file_name
- Storage에 저장되는 파일명

storage_bucket
- Supabase Storage bucket 이름

storage_path
- Supabase Storage 내부 경로

file_size
- 파일 크기

mime_type
- 파일 MIME type

file_extension
- 파일 확장자

file_hash
- 중복 감지를 위한 파일 해시

duplicate_group_key
- 중복 가능성이 있는 파일을 묶기 위한 key

uploaded_by
- 업로드 사용자 ID

uploaded_at
- 업로드 시각

deleted_at
- 삭제 처리 시각
```

---

## 6. document_key 표준

증빙 파일은 `document_key`로 문서 유형을 구분한다.

`document_key`는 화면 표시명과 무관하게 개발에서 사용하는 고정 key다.
사용자 화면에는 `document_name`을 표시한다.

```ts
type EvidenceDocumentKey =
  | "tax_invoice"
  | "credit_card_receipt"
  | "transfer_receipt"
  | "quote"
  | "comparative_quote"
  | "contract"
  | "purchase_order"
  | "statement_of_work"
  | "result_report"
  | "inspection_report"
  | "evidence_photo"
  | "deliverable_file"
  | "vendor_business_registration"
  | "vendor_bankbook_copy"
  | "pre_approval_document"
  | "institution_confirmation"
  | "advance_payment_bond"
  | "pledge_letter"
  | "license_certificate"
  | "ip_application_request"
  | "ip_registration_certificate"
  | "official_fee_receipt"
  | "delegation_contract"
  | "four_insurance_certificate"
  | "employment_contract"
  | "resume"
  | "employee_id_card"
  | "employee_bankbook_copy"
  | "integrity_pledge"
  | "payroll_statement"
  | "salary_transfer_receipt"
  | "withholding_receipt"
  | "withholding_ledger"
  | "insurance_payment_confirmation"
  | "retirement_pension_statement"
  | "health_check_confirmation"
  | "travel_plan"
  | "transportation_receipt"
  | "boarding_pass"
  | "travel_result_report"
  | "toll_receipt"
  | "training_application"
  | "training_material"
  | "payment_receipt"
  | "completion_certificate"
  | "participation_certificate"
  | "promotional_material"
  | "advertising_result"
  | "etc";
```

---

## 7. 주요 document_key 표시명

```text
tax_invoice: 세금계산서
credit_card_receipt: 신용카드 영수증
transfer_receipt: 입금확인증 또는 송금증
quote: 견적서
comparative_quote: 비교견적서
contract: 계약서
purchase_order: 발주서
statement_of_work: 과업지시서
result_report: 결과보고서
inspection_report: 검수조서
evidence_photo: 증빙사진
deliverable_file: 산출물 파일
vendor_business_registration: 거래처 사업자등록증
vendor_bankbook_copy: 거래처 통장사본
pre_approval_document: 사전승인 자료
institution_confirmation: 주관기관 확인자료
advance_payment_bond: 선급금이행보증보험
pledge_letter: 각서
license_certificate: 라이선스 증빙
ip_application_request: 출원청구서 또는 등록청구서
ip_registration_certificate: 등록증
official_fee_receipt: 관납료 영수증
delegation_contract: 위임계약서
four_insurance_certificate: 4대보험가입확인서
employment_contract: 근로계약서
resume: 이력서
employee_id_card: 근로자 신분증
employee_bankbook_copy: 근로자 통장사본
integrity_pledge: 청렴서약서
payroll_statement: 급여대장
salary_transfer_receipt: 급여 입금확인증
withholding_receipt: 근로소득원천징수영수증
withholding_ledger: 근로소득원천징수부
insurance_payment_confirmation: 4대보험료 월별 납부확인서
retirement_pension_statement: 퇴직연금납입내역서
health_check_confirmation: 건강검진 실시확인서
travel_plan: 출장계획서
transportation_receipt: 교통비 증빙서류
boarding_pass: 탑승권
travel_result_report: 출장 결과보고서
toll_receipt: 통행료 영수증
training_application: 교육참가 신청서
training_material: 교육자료
payment_receipt: 결제 영수증 또는 입금증
completion_certificate: 교육 이수증
participation_certificate: 교육 참가 확인서
promotional_material: 홍보제작물
advertising_result: 광고 집행 결과자료
etc: 기타 증빙
```

---

## 8. 증빙 요건과 document_key 연결

비목별 증빙 요건은 `budget-category-policy.md`의 `EvidenceRequirement`를 기준으로 표시한다.

예시:

```ts
const transactionProofRequirement: EvidenceRequirement = {
  requirement_key: "transaction_proof",
  requirement_name: "거래 증빙",
  requirement_type: "required",
  fulfillment_type: "any_of",
  accepted_documents: [
    {
      document_key: "tax_invoice",
      document_name: "세금계산서",
    },
    {
      document_key: "credit_card_receipt",
      document_name: "신용카드 영수증",
    },
  ],
};
```

이 경우 사용자가 `tax_invoice` 또는 `credit_card_receipt` 중 하나를 업로드하면 “거래 증빙 업로드됨”으로 표시할 수 있다.

단, 이는 파일 존재 여부에 대한 표시일 뿐이다.
해당 파일이 실제 정산 기준에 적합한지는 자동 판단하지 않는다.

---

## 9. 필수/조건부/선택 증빙 표시 기준

증빙 요건은 아래 3가지로 구분한다.

```text
required
- 해당 비목으로 분류된 지출에서 기본적으로 필요한 증빙

conditional
- 특정 조건에 따라 필요할 수 있는 증빙

optional
- 있으면 참고가 되는 증빙
```

### required 표시 기준

`required` 증빙은 지출 상세 풀페이지의 증빙 업로드 영역에 기본 표시한다.

```text
표시 예시:
필수 증빙 · 거래 증빙
세금계산서 또는 신용카드 영수증 중 하나를 첨부해주세요.
```

### conditional 표시 기준

`conditional` 증빙은 조건 문구와 함께 표시한다.

```text
표시 예시:
조건부 증빙 · 비교견적서
2천만원 기준 거래 시 필요할 수 있습니다.
```

MVP에서는 조건부 증빙을 자동 활성화하지 않아도 된다.
다만 금액이 2천만원 기준에 가까운 경우 안내 문구를 강조할 수 있다.

### optional 표시 기준

`optional` 증빙은 접힌 영역 또는 참고 증빙 영역에 표시할 수 있다.

```text
표시 예시:
참고 증빙 · 주관기관 확인자료
있으면 검토에 도움이 되는 자료입니다.
```

---

## 10. any_of / all_of 표시 기준

### any_of

`any_of`는 허용 문서 중 하나만 업로드되어도 충족된 것으로 표시한다.

예시:

```text
거래 증빙
- 세금계산서
- 신용카드 영수증

상태:
둘 중 하나 업로드 시 “업로드됨” 표시
```

### all_of

`all_of`는 허용 문서 전체가 업로드되어야 충족된 것으로 표시한다.

예시:

```text
검수 증빙
- 검수조서
- 증빙사진

상태:
둘 다 업로드 시 “업로드됨” 표시
하나만 업로드 시 “일부 업로드됨” 표시
```

이 상태 표시는 파일 업로드 현황을 보여주기 위한 것이다.
정산 적합성 최종 판단으로 사용하지 않는다.

---

## 11. 업로드 가능 파일 기준

MVP에서 허용하는 파일 형식은 아래와 같다.

```text
문서 파일:
- pdf
- doc
- docx
- hwp
- hwpx

스프레드시트:
- xls
- xlsx
- csv

이미지:
- jpg
- jpeg
- png
- webp

압축 파일:
- zip
```

기본 제한은 아래와 같다.

```text
- 파일 1개당 최대 20MB
- 하나의 지출에 여러 증빙 파일 업로드 가능
- 하나의 document_key에 여러 파일 업로드 가능
- 실행 파일 업로드 금지
- 암호화되었거나 열람이 불가능한 파일은 업로드 후 사용자 확인 필요
```

파일 크기 제한은 환경변수 또는 설정값으로 변경할 수 있다.

```text
MAX_EVIDENCE_FILE_SIZE_MB=20
```

---

## 12. 업로드 제한 파일

아래 파일은 업로드를 차단하거나 경고한다.

```text
- exe
- bat
- cmd
- sh
- js
- msi
- dmg
- apk
- app
- scr
- vbs
- jar
```

MVP에서는 확장자와 MIME type을 기준으로 1차 차단한다.
고도화 단계에서는 바이러스 검사 또는 파일 스캔을 추가할 수 있다.

---

## 13. Supabase Storage 정책

증빙 파일은 Supabase Storage의 private bucket에 저장한다.

### bucket 이름

```text
expense-evidence
```

### 저장 경로 규칙

```text
companies/{companyId}/projects/{projectId}/expenses/{expenseId}/{documentKey}/{fileId}-{sanitizedFileName}
```

예시:

```text
companies/com_001/projects/proj_001/expenses/exp_001/contract/file_001-app-development-contract.pdf
```

### 저장 기준

```text
- 원본 파일명은 DB metadata에 original_file_name으로 저장한다.
- Storage 경로에는 sanitizedFileName을 사용한다.
- 파일명 충돌을 방지하기 위해 fileId 또는 UUID를 prefix로 붙인다.
- bucket은 public으로 열지 않는다.
- 파일 접근은 인증된 사용자에게만 허용한다.
- 파일 다운로드 또는 미리보기는 signed URL을 통해 제공할 수 있다.
```

---

## 14. 파일명 정리 기준

업로드 시 파일명은 저장용 파일명으로 정리한다.

```text
- 공백은 하이픈 또는 언더스코어로 변환
- 특수문자는 제거 또는 안전한 문자로 변환
- 한글 파일명은 original_file_name에는 유지 가능
- storage_path에는 sanitizedFileName 사용
- 동일 파일명 충돌 방지를 위해 fileId 또는 UUID prefix 사용
```

예시:

```text
원본 파일명:
앱 개발 계약서 최종본.pdf

저장 파일명:
file_001-app-development-contract-final.pdf
```

---

## 15. DB 저장 기준

파일 업로드가 완료되면 DB에 파일 메타데이터를 저장한다.

권장 테이블명은 아래와 같다.

```text
expense_evidence_files
```

권장 컬럼은 아래와 같다.

```text
id
company_id
project_id
expense_id
document_key
requirement_key
original_file_name
stored_file_name
storage_bucket
storage_path
file_size
mime_type
file_extension
file_hash
duplicate_group_key
uploaded_by
uploaded_at
deleted_at
```

### 저장 순서

```text
1. 파일 유효성 검사
2. document_key 확인
3. Supabase Storage 업로드
4. 업로드 성공 시 파일 metadata DB 저장
5. DB 저장 실패 시 Storage 파일 정리 시도
6. 업로드 결과를 지출 상세 풀페이지에 반영
```

---

## 16. 중복 감지 정책

MVP에서는 같은 파일이 반복 업로드되는 것을 방지하기 위해 중복 가능성을 안내한다.

중복 감지는 정산 부정 또는 허위 증빙 판단이 아니다.
사용자가 실수로 같은 파일을 여러 번 업로드하는 것을 줄이기 위한 UX 기능이다.

### 중복 감지 우선순위

```text
1. file_hash가 같은 경우
2. file_name + file_size + mime_type이 같은 경우
3. 같은 expense_id 안에서 같은 document_key에 동일한 파일명이 반복되는 경우
```

### 중복 상태

```ts
type EvidenceDuplicateStatus =
  | "none"
  | "possible_duplicate"
  | "exact_duplicate";
```

### 표시 기준

```text
none
- 중복 가능성이 낮음

possible_duplicate
- 파일명, 크기, MIME type 등이 유사함
- 사용자에게 확인 안내 표시

exact_duplicate
- file_hash가 동일함
- 같은 지출에 이미 업로드된 파일이면 업로드 차단 가능
```

### 중복 안내 문구

```text
이미 유사한 파일이 업로드되어 있습니다.
같은 증빙을 중복으로 올린 것이 아닌지 확인해주세요.
```

### 업로드 처리 기준

```text
- 같은 expense_id 안에서 file_hash가 동일한 파일은 업로드를 차단할 수 있다.
- 다른 expense_id에 동일 파일이 있는 경우 업로드를 차단하지 않고 안내만 표시한다.
- file_hash를 구현하지 않은 MVP 초기 단계에서는 파일명, 크기, MIME type 기준으로 중복 가능성을 안내한다.
```

---

## 17. 삭제 정책

MVP에서는 증빙 파일 삭제 시 metadata에 `deleted_at`을 기록한다.

```text
- deleted_at이 있는 파일은 화면에서 기본적으로 숨긴다.
- 삭제된 파일은 증빙 충족 상태 계산에서 제외한다.
- Storage 물리 삭제는 즉시 수행하거나, 별도 정리 작업으로 처리할 수 있다.
```

삭제는 정산 자료 보관 이슈가 있을 수 있으므로, 고도화 단계에서는 삭제 대신 보관 상태를 추가할 수 있다.

```ts
type EvidenceFileStatus =
  | "active"
  | "deleted"
  | "archived";
```

MVP에서는 `active`, `deleted`만 사용해도 된다.

---

## 18. 증빙 업로드 상태 표시

증빙 요건별 상태는 아래처럼 표시할 수 있다.

```ts
type EvidenceRequirementUploadStatus =
  | "not_uploaded"
  | "partially_uploaded"
  | "uploaded"
  | "needs_review";
```

### 상태 기준

```text
not_uploaded
- 해당 요건에 연결된 파일이 없음

partially_uploaded
- all_of 요건에서 일부 문서만 업로드됨

uploaded
- any_of 요건에서 하나 이상 업로드됨
- all_of 요건에서 모든 문서가 업로드됨

needs_review
- 조건부 증빙이거나, 파일 형식/중복/열람 가능성 확인이 필요한 경우
```

이 상태는 사용자 안내용이다.
정산 적합성 최종 판단으로 사용하지 않는다.

---

## 19. 지출 상세 풀페이지 표시 기준

지출 상세 풀페이지의 증빙 영역은 선택된 비목의 `evidence_requirements`를 기준으로 표시한다.
증빙 파일은 비목이 아니라 개별 지출에 연결되므로, 동일한 비목의 다른 지출과 증빙 업로드 상태를 공유하지 않는다.

### 표시 항목

```text
- 증빙 요건명
- 필수/조건부/선택 구분
- 허용 document_key 목록
- 업로드된 파일 목록
- 업로드 상태
- 업로드 안내 문구
- 중복 가능성 안내
- 업로드 사용자
- 업로드 시각
- 파일 삭제 상태
```

### 상세 풀페이지 내 권장 위치

```text
우측 고정 패널:
- 필수/조건부/선택 증빙 요약
- 미업로드 또는 일부 업로드 상태 강조
- 집행 신청 단계에서 필수 증빙 누락 안내 강화

본문 증빙 섹션:
- 증빙 요건별 파일 업로드
- 파일별 document_key, 상태, 업로드 사용자, 업로드 시각 표시
- 중복 가능성 안내 및 재시도 액션
```

MVP에서는 필수 증빙이 누락되어도 지출 저장 또는 단계 이동을 차단하지 않는다.
단, 집행 신청 단계에서는 누락된 필수 증빙과 조건부 증빙을 더 눈에 띄게 안내한다.

### 표시 예시

```text
필수 증빙 · 거래 증빙
세금계산서 또는 신용카드 영수증 중 하나를 첨부해주세요.

업로드 상태:
- 세금계산서.pdf 업로드됨
```

```text
필수 증빙 · 검수 증빙
검수조서와 증빙사진을 함께 첨부해주세요.

업로드 상태:
- 검수조서.pdf 업로드됨
- 증빙사진 미업로드
```

---

## 20. 필수 증빙 기준

필수 증빙 여부는 `budget-category-policy.md`의 `EvidenceRequirement.requirement_type`을 따른다.

```text
required
- 기본적으로 필요한 증빙

conditional
- 특정 조건에서 필요할 수 있는 증빙

optional
- 참고용 증빙
```

MVP에서 필수 증빙 미업로드는 지출 저장 또는 단계 이동을 차단하지 않는다.
단, 집행 신청 단계에서는 필수 증빙 누락 안내를 더 강조할 수 있다.

```text
필수 증빙이 아직 모두 업로드되지 않았습니다.
집행 신청 전 필요한 서류를 확인해주세요.
```

---

## 21. 권한 및 접근 정책

증빙 파일은 민감한 사업비 자료이므로 public 접근을 허용하지 않는다.

```text
- Supabase Storage bucket은 private으로 설정한다.
- 사용자는 자신이 접근 가능한 company_id, project_id의 파일만 조회할 수 있다.
- 파일 조회, 다운로드, 삭제는 인증된 사용자에게만 허용한다.
- signed URL은 제한된 시간 동안만 유효하게 발급한다.
```

MVP에서는 프로젝트 참여자 또는 기업 소속 사용자 단위의 접근 제어를 적용한다.
세부 권한 정책은 향후 `auth-policy.md` 또는 `team-policy.md`에서 확장할 수 있다.

---

## 22. Codex 개발 기준

Codex는 이 정책을 구현할 때 아래 기준을 따른다.

```text
- 증빙 파일은 비목이 아니라 개별 지출에 연결한다.
- 증빙 파일 테이블은 expense_id를 반드시 가진다.
- document_key는 EvidenceDocumentKey를 기준으로 표준화한다.
- 비목별로 필요한 증빙 요건은 budget-category-policy.md를 참조한다.
- 지출 단계별 증빙 입력 시점은 expense-execution-policy.md를 참조한다.
- Supabase Storage bucket은 expense-evidence를 사용한다.
- Storage 경로는 companyId, projectId, expenseId, documentKey를 포함한다.
- 원본 파일명은 metadata에 저장하고 Storage 파일명은 안전한 파일명으로 변환한다.
- 업로드 성공 후 DB metadata를 저장한다.
- DB 저장 실패 시 Storage 파일 정리를 시도한다.
- 필수 증빙 누락은 MVP에서 저장 차단 조건으로 사용하지 않는다.
- 중복 감지는 사용자 안내 목적으로만 사용한다.
- OCR, AI 문서 분류, 진위 검증은 MVP에서 구현하지 않는다.
```

---

## 23. MVP 구현 제외 범위

MVP에서는 아래 기능을 구현하지 않는다.

```text
- OCR 기반 문서 내용 인식
- 세금계산서 진위 검증
- 카드 영수증 자동 파싱
- 파일 내용 기반 자동 document_key 분류
- 증빙 파일 기반 정산 적합성 자동 판정
- 증빙 누락 기반 risk score 계산
- 기관 시스템 자동 제출
- 바이러스 검사 고도화
- 장기 보관 정책 자동화
```

---

## 24. Acceptance Criteria

```text
- 증빙 파일은 개별 지출에 연결된다.
- 증빙 파일은 expense_id를 가진다.
- 비목은 증빙 파일을 직접 가지지 않는다.
- 증빙 파일은 document_key로 유형을 구분한다.
- document_key는 EvidenceDocumentKey 기준을 따른다.
- 지출 상세 풀페이지는 선택된 비목의 evidence_requirements를 기준으로 증빙 업로드 영역을 표시한다.
- required, conditional, optional 증빙을 구분해서 표시한다.
- any_of 요건은 허용 문서 중 하나 이상 업로드 시 uploaded로 표시할 수 있다.
- all_of 요건은 모든 허용 문서 업로드 시 uploaded로 표시할 수 있다.
- 필수 증빙 누락은 MVP에서 저장 또는 단계 이동을 차단하지 않는다.
- Supabase Storage bucket은 private으로 관리한다.
- Storage 경로는 companyId, projectId, expenseId, documentKey를 포함한다.
- 업로드된 파일의 metadata는 DB에 저장된다.
- 같은 지출에 동일 파일이 반복 업로드되면 중복 가능성을 안내한다.
- OCR, 진위 검증, 정산 적합성 자동 판정은 구현하지 않는다.
```
