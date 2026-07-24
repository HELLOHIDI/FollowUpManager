# GitHub Workflow and Deployment Policy

## 적용 범위

이 정책은 UI뿐 아니라 기능, API, 데이터베이스, 문서, 테스트, 리팩터링, CI/CD를 포함한 저장소의 모든 작업에 적용한다.

## 작업 브랜치

1. 최신 `origin/main`에서 새 작업 브랜치를 생성한다.
2. 검증 가능한 변경 단위마다 영향 범위에 맞는 테스트와 저장소 품질 검사를 실행한다.
3. 검증이 끝난 변경을 하나의 논리적인 커밋으로 만들고 작업 브랜치에 Push한다.
4. 작업 브랜치 Push로 실행된 GitHub Actions와 Vercel Preview를 확인한다.
5. 검증이나 Preview가 실패하면 같은 작업 브랜치에서 수정하고 2~4단계를 반복한다.

`main`에서 직접 작업하거나 승인 없이 Push하지 않는다. 오래된 브랜치나 로컬 작업 디렉터리를 Vercel CLI로 직접 배포하지 않는다.
GitHub Actions는 작업 브랜치가 최신 `origin/main`을 포함하지 않으면 Preview 배포를 차단한다.

## GitHub 컨벤션

- 커밋은 하나의 논리적 변경만 포함하고 명령형 제목을 사용한다.
- 사용자가 `PR 생성`을 명시한 경우에만 `main` 대상 PR을 생성한다.
- PR 생성 전 최신 `origin/main` 반영 여부와 Preview 검증 결과를 확인한다.
- 사용자가 `main 머지`를 명시한 경우에만 승인된 PR을 `main`에 병합한다.
- 병합 방식은 저장소 PR 정책에 따라 Squash Merge를 기본으로 한다.

## 검증과 자동 배포

- 작업 브랜치 Push: 타입 검사, 단위 테스트, 저장소 기준선 검사 후 Preview 배포
- PR 생성 이후 추가 커밋 Push: 동일한 검증 후 새 Preview 배포
- `main` Push: 동일 커밋의 Preview를 먼저 배포하고, 성공한 경우 Production 배포
- 하나의 필수 검증이라도 실패하면 Preview와 Production을 배포하지 않는다.

UI 기준선 검사는 전체 작업 정책을 UI로 제한하는 조건이 아니라 UI 회귀를 막는 저장소 품질 검사 중 하나다.
Preview와 Production은 각각 Vercel의 해당 환경변수를 사용하며 테스트 키나 로컬 Supabase 주소는 사용할 수 없다.
