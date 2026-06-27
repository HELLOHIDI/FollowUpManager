# GrantFollow 사업 등록 운영 정책

상태: 2026-06-23 사업 등록 Slice 기준  
적용 범위: 기업 하위 사업 등록·수정, 기관 제공 서류 관리, 대시보드 경로 연결

## 1. 계정과 소유 범위

- MVP는 Supabase Auth 기반 단일 내부 계정/단일 공유 워크스페이스다.
- 한 계정은 여러 기업을 등록하고, 한 기업은 여러 사업을 가진다.
- 다중 사용자, 기업 멤버십, 역할별 권한, 사용자별 데이터 격리는 후속 범위다.
- 현재 인증은 외부 비인가 접근을 막는 최소 경계이며, 모든 등록 기업과 사업은 단일 내부 계정의 공유 데이터다.

## 2. 사업 필드 계약

| 필드 | 규칙 |
| --- | --- |
| 사업명 | 필수, trim, 기업 내 중복은 경고만 표시 |
| 주관기관 | 필수, trim |
| 협약 시작일/종료일 | 필수 실제 달력 날짜, 종료일은 시작일 이후 또는 동일 |
| 정부지원금 | 필수 원 단위 정수, 0 이상 |
| 자기부담 현금 | 필수 원 단위 정수, 0 이상 |
| 자기부담 현물 | 필수 원 단위 정수, 0 이상 |
| 과제번호 | 필수, 기업 내 유일 |
| 과제명 | 필수 |
| 담당자명 | 필수 |
| 담당자 이메일 | 선택, 입력 시 이메일 형식 |
| 담당자 연락처 | 선택, 입력 시 연락처 형식 |
| 이메일/연락처 | 둘 중 하나 이상 필수 |
| 유의사항 | 선택 |

금액은 비율을 사용하지 않고 협약서 기준으로 직접 입력한다. 서버와 DB가 아래 값을 계산한다.

```text
자기부담금 합계 = 자기부담 현금 + 자기부담 현물
총 사업비 = 정부지원금 + 자기부담 현금 + 자기부담 현물
```

- 총 사업비는 0보다 커야 한다.
- 직접 금액과 계산 합계는 모두 `9007199254740991` 이하여야 한다.
- 클라이언트가 합계나 상태를 제출하더라도 저장 계약에 포함하지 않는다.
- 임시저장은 없고 최종 등록만 제공한다.
- 사업 등록 상태는 `complete`만 사용한다.

## 3. 기업과 사업 UI

- `/settings/company`에서 기업 셀을 펼치면 해당 기업의 사업 셀과 마지막 `사업 등록` 버튼이 보인다.
- 사업이 없을 때도 같은 등록 버튼을 빈 상태의 주 행동으로 제공한다.
- `사업 등록`을 누르면 오른쪽 기업 정보 영역이 해당 기업에 귀속된 사업 등록 폼으로 바뀐다.
- 폼 안에서 기업을 다시 선택하지 않는다.
- 사업 셀 본문은 `/projects/:projectId`로 이동한다.
- 사업 셀의 `관리` 버튼은 `/settings/company/projects/:projectId`로 이동한다.
- 등록 성공 후 첨부 시도가 모두 끝나면 `/projects/:projectId`로 이동한다.
- 저장하지 않은 기업/사업 변경을 버리는 전환은 확인을 거친다.

`/projects` 실제 목록, UtilityBar의 실제 사업 선택 데이터, 대시보드 지표는 후속 대시보드 Slice다.

## 4. 사업 수정

- 관리 화면은 사업의 등록 필드와 기관 제공 서류를 조회한다.
- 사업 ID와 기업 ID는 수정할 수 없다.
- 사업 삭제 기능과 API는 제공하지 않는다.
- 과제번호 변경 시에도 기업 내 유일 규칙을 적용한다.
- 중복 과제번호는 과제번호 필드에 인라인 오류로 표시한다.

## 5. 기관 제공 서류

사업 서류는 지출 증빙과 분리해 private `project-documents` bucket과 `project_documents` 테이블에 저장한다.

### 허용 형식

`pdf`, `doc`, `docx`, `hwp`, `hwpx`, `xls`, `xlsx`, `csv`, `jpg`, `jpeg`, `png`, `webp`, `zip`

- 파일당 최대 20MB다.
- 여러 파일을 받을 수 있다.
- 원본 파일명은 메타데이터에만 보존하고 Storage 경로에는 UUID 기반 저장명을 사용한다.
- 경로 구분자, 상위 경로 표현, 제어문자가 포함된 파일명은 거부한다.
- 확장자와 브라우저 MIME을 메타데이터 수준에서 검증한다. 파일 내용이나 magic byte 검증은 이번 Slice 범위가 아니다.

### 정규 MIME

| 확장자 | Storage MIME |
| --- | --- |
| pdf | `application/pdf` |
| doc | `application/msword` |
| docx | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| hwp, hwpx | `application/octet-stream` |
| xls | `application/vnd.ms-excel` |
| xlsx | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| csv | `text/csv` |
| jpg, jpeg | `image/jpeg` |
| png | `image/png` |
| webp | `image/webp` |
| zip | `application/zip` |

빈 MIME과 `application/octet-stream`은 허용 확장자에서 받을 수 있다. HWP는 `application/x-hwp`, `application/haansofthwp`, HWPX/DOCX/XLSX는 `application/zip`, CSV는 `text/plain`, `application/vnd.ms-excel`, ZIP은 `application/x-zip-compressed` 별칭을 허용한다.

### 업로드 상태

1. 서버가 `uploading` 메타데이터와 제한된 signed upload capability를 만든다.
2. 브라우저가 service-role key 없이 Storage에 직접 업로드한다.
3. 서버가 저장 크기와 정규 MIME을 확인하고 `ready`로 완료한다.

- `ready_at`은 `ready`일 때만 필수다.
- `ready` 목록만 사용자에게 표시한다.
- 완료 API는 이미 `ready`인 문서에 멱등 200을 반환한다.
- 삭제된 문서는 terminal 상태이며 완료할 수 없다.
- 삭제는 메타데이터를 먼저 숨기고 물리 객체 삭제를 시도한다.
- 물리 삭제 실패는 안정적인 문서/사업 ID만 기록하며 사용자에게 경로나 signed URL을 노출하지 않는다.

### 등록 중 여러 파일

- 동시 업로드는 최대 3개다.
- 파일별 intent→upload→complete 체인은 최대 120초다.
- 일부 파일 실패는 유효한 사업을 롤백하지 않는다.
- 성공/실패가 모두 정리된 뒤 실패 개수를 안내하고 대시보드로 이동한다.
- 실패한 파일은 관리 화면에서 다시 추가할 수 있다.

### 파일 열기

- 클릭 이벤트에서 동기적으로 빈 새 탭을 연다.
- 서버의 짧은 signed URL 응답을 받은 뒤 새 탭 위치를 할당한다.
- signed URL 발급 실패 시 빈 탭을 닫는다.

## 6. 보안 경계

- 사업 쓰기와 모든 문서 메타데이터 작업은 인증 이후 server-only service-role client로 수행한다.
- 브라우저는 service-role key를 받지 않는다.
- `project_documents`는 RLS를 켜고 `anon`/`authenticated` policy와 직접 table privilege를 두지 않는다.
- `storage.objects`에 `project-documents`용 광범위 사용자 policy를 만들지 않는다.
- 브라우저 Storage 권한은 단기 signed upload/read capability로만 제공한다.
- 로그에는 원본 파일명, 연락처, Storage 경로, token, signed URL, service-role key를 기록하지 않는다.

## 7. 제외 범위

- 사업 삭제
- 임시저장/초안
- 다중 사용자·기업 멤버십·역할별 권한
- `/projects` 실제 목록과 UtilityBar 데이터 연결
- 대시보드 실제 지표
- 비목 CRUD
- OCR, 자동 분류, 파일 미리보기, magic-byte 검사

## 8. 완료 검증

- 0013 데이터에 대한 0014 파괴적 preflight 실패/rollback fixture
- clean `0001`→`0014` reset과 생성 타입 확인
- pgTAP 제약/RLS/privilege/bucket 검증
- private signed upload→unsigned read 거부→signed read→delete integration
- API 인증/validation/충돌 테스트
- 단일 내부 계정으로 두 기업의 사업 격리·중복·문서 관리 E2E
- `test`, `typecheck`, `lint`, `build`, Chromium E2E 전체 통과
