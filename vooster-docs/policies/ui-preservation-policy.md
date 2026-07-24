# UI Preservation and Deployment Policy

## UI 기준선

- Production UI를 기존 화면의 기준선으로 사용한다.
- 새 작업 브랜치는 항상 최신 `origin/main`에서 생성한다.
- 새 기능은 승인된 화면 또는 진입점만 변경한다.
- 모든 Preview 배포 전에 `npm run check:ui-baseline`을 실행한다.
- 기준선 검사가 실패하면 Production 구조를 복원한 뒤 다시 배포한다.

## 작업 브랜치

1. 최신 `origin/main`에서 새 작업 브랜치를 생성한다.
2. 수정사항이 생길 때마다 관련 테스트, 타입 검사, UI 기준선 검사를 실행한다.
3. 검증이 끝난 변경을 커밋하고 작업 브랜치에 Push한다.
4. 작업 브랜치 Push는 GitHub Actions를 통해 Vercel Preview를 자동 배포한다.
5. Preview 확인 전에는 다음 배포 단계로 진행하지 않는다.

오래된 브랜치나 로컬 작업 디렉터리를 Vercel CLI로 직접 배포하지 않는다.
GitHub Actions는 작업 브랜치가 최신 `origin/main`을 포함하지 않으면 Preview 배포를 차단한다.

## PR과 병합 승인

- 사용자가 `PR 생성`을 명시한 경우에만 `main` 대상 PR을 생성한다.
- PR 생성 전 최신 `origin/main` 반영 여부와 Preview 검증 결과를 확인한다.
- 사용자가 `main 머지`를 명시한 경우에만 PR을 `main`에 병합한다.
- 병합 방식은 저장소 PR 정책에 따라 Squash Merge를 기본으로 한다.

## 자동 배포

- 작업 브랜치 Push: Preview 배포
- PR 생성 이후 추가 커밋 Push: 새 Preview 배포
- `main` Push: 같은 커밋으로 Preview를 먼저 배포하고, 성공한 경우 Production을 배포
- 타입 검사, UI 기준선 검사 또는 단위 테스트가 실패하면 Preview와 Production을 배포하지 않는다.

Preview와 Production은 각각 Vercel의 해당 환경변수를 사용한다. 테스트 키나 로컬 Supabase 주소는 배포에 사용할 수 없다.
UI 기준선 검사는 빠른 지출 등록의 금액 포맷 입력과 정부지원금·현금·현물 복수 선택 UI도 보호한다.
