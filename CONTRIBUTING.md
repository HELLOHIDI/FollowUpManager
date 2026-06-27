# Contributing

## GitHub Workflow

이 저장소는 `main` 브랜치에 직접 push하지 않습니다. 모든 변경은 이슈, 브랜치, 커밋, PR을 거쳐 반영합니다.

기본 흐름:

1. 기획 또는 요구사항을 정리합니다.
2. GitHub Issue를 생성합니다.
3. `main`을 최신 상태로 맞춥니다.
4. 작업 브랜치를 만듭니다.
5. 변경을 구현하고 필요한 검증을 실행합니다.
6. 논리 단위로 커밋합니다.
7. 원격 브랜치에 push하고 draft PR을 엽니다.
8. PR 본문과 체크리스트를 정리합니다.
9. 추가 테스트, 리뷰, 수정을 마친 뒤 ready for review로 전환합니다.
10. 필수 CI 체크가 통과한 뒤 `main`에 squash merge합니다.

Codex가 작업을 수행할 때도 같은 흐름을 따릅니다. 명시적인 예외 요청이 없으면 Codex는 이슈 본문 작성, 작업 브랜치 생성, 커밋, 원격 브랜치 push, PR 본문 작성을 자체적으로 진행합니다.

## Issues

Issue 제목은 영어를 사용합니다.

예시:

```text
feat: add evidence upload flow
fix: prevent export csv formula injection
docs: add github workflow convention
```

Issue 본문은 한국어로 작성합니다. 공통 Issue 템플릿은 `.github/ISSUE_TEMPLATE/task.md`에 둡니다.

Issue는 다음 내용을 기준으로 작업 범위를 고정합니다.

- Goal: 달성하려는 목표
- Scope: 포함 범위
- Out of Scope: 제외 범위
- Acceptance Criteria: 완료 판단 기준
- Verification: 예상 검증 방법
- Risks / Notes: 리스크, 제약, 후속 작업

작업 중 범위가 커지면 기존 Issue를 확장하기보다 후속 Issue로 분리합니다.

## Branch Naming

브랜치명은 영어를 사용합니다.

```text
feature/<short-description>
fix/<short-description>
chore/<short-description>
docs/<short-description>
test/<short-description>
refactor/<short-description>
```

예시:

```text
feature/evidence-upload
fix/export-csv-injection
docs/github-workflow
refactor/expense-detail-policy
```

## Commit Messages

커밋 제목은 영어를 사용하고, imperative mood의 짧은 문장으로 작성합니다.

권장 형식:

```text
feat: add evidence upload api
fix: prevent export csv formula injection
docs: document github workflow
test: cover dashboard category expansion
refactor: extract expense detail policy
```

커밋은 하나의 논리 변경 단위로 유지합니다. 서로 다른 목적의 변경은 가능한 한 커밋을 분리합니다.

## Pull Requests

PR 제목은 영어를 사용합니다.

예시:

```text
feat: add evidence upload flow
fix: harden export csv serialization
docs: add github workflow convention
```

PR 본문은 한국어로 작성합니다. 다음 내용을 포함합니다.

PR은 기본적으로 draft로 엽니다. 최종 검증이 끝나고 리뷰 가능한 상태가 되면 ready for review로 전환합니다.

```md
## Summary
- 변경 요약

## Scope
- 포함 범위와 제외 범위

## Verification
- 실행한 테스트 또는 확인한 근거

## Notes
- 리뷰어가 알아야 할 제약, 후속 작업, 미검증 사항
```

PR 크기는 균형형을 기준으로 합니다.

- 하나의 완료 가능한 slice 단위로 묶습니다.
- DB/API/UI/test가 강하게 연결된 작업은 한 PR에 포함할 수 있습니다.
- 서로 독립적인 기능은 PR을 분리합니다.
- 리뷰가 어려울 정도로 커지는 경우 먼저 계획 또는 중간 PR로 나눕니다.

공통 PR 템플릿은 `.github/pull_request_template.md`에 둡니다. 해당 없는 항목은 `N/A`로 명시합니다.

최소 체크리스트:

```md
- [ ] Scope is limited to one slice or purpose
- [ ] Tests or verification evidence are listed
- [ ] Docs updated or N/A
- [ ] Risks / follow-ups are documented or N/A
- [ ] No secrets or local runtime files included
```

## Verification Expectations

변경 범위에 맞는 가장 작은 검증부터 실행합니다.

- 문서 변경: 맞춤법, 링크, 내용 일관성 확인
- UI 변경: 관련 컴포넌트 테스트와 화면 확인
- API/service 변경: 단위 테스트 또는 통합 테스트
- DB 변경: migration, schema, 관련 SQL 테스트
- 넓은 범위 변경: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`

검증을 실행하지 못한 경우 PR 본문에 이유와 남은 위험을 명시합니다.

## Merge Policy

`main` merge는 자동화 가능한 squash merge를 기본 정책으로 합니다.

자동 squash merge 조건:

- PR 상태가 open이고 draft가 아닙니다.
- PR이 `main`을 대상으로 합니다.
- PR head commit이 `main`에 mergeable 상태입니다.
- GitHub Actions 필수 체크 `ci`가 성공했습니다.
- PR 본문에 검증 근거와 남은 위험이 한국어로 정리되어 있습니다.
- merge 방식은 `squash`만 사용합니다.

다음 경우에는 자동 merge하지 않습니다.

- `ci` 체크가 실패, 취소, 누락, 또는 진행 중입니다.
- PR이 draft 상태입니다.
- 충돌이 있거나 mergeable 상태가 아닙니다.
- PR 범위가 이슈와 다르거나 검증 근거가 부족합니다.
- 보안, 비밀값, 배포, 데이터 삭제처럼 운영 위험이 있는 변경입니다.

GitHub 저장소 설정은 이 정책을 강제하도록 맞춥니다.

- `main` 직접 push를 금지합니다.
- `main` branch protection에서 required status check로 `ci`를 지정합니다.
- branch가 최신 상태일 때만 merge하도록 설정합니다.
- required review는 자동화 검증 단계에서는 필수로 두지 않습니다.
- merge 방식은 squash merge만 허용합니다.
- GitHub auto-merge는 필수 체크가 성공한 뒤에만 사용합니다.

초기 설정 순서:

1. CI workflow가 `main`에 존재하지 않는 경우, CI workflow를 추가하는 PR은 bootstrap PR로 취급합니다.
2. bootstrap PR은 로컬에서 `npm run typecheck`, `npm run test`, `npm run build`가 통과했을 때만 squash merge합니다.
3. bootstrap PR merge 후 새 PR을 열어 `ci` 체크가 GitHub Actions에 나타나는지 확인합니다.
4. `ci` 체크가 확인되면 `main` branch protection의 required status check에 `ci`를 지정합니다.
5. 이후 모든 PR은 bootstrap 예외 없이 `ci` 성공이 확인되어야만 squash merge합니다.

Codex가 PR merge를 수행할 때도 위 조건을 먼저 확인합니다. 조건 중 하나라도 확인되지 않으면 merge하지 않고 PR에 남은 조치를 기록합니다.
