# Contributing

## GitHub Workflow

이 저장소는 `main` 브랜치에 직접 push하지 않습니다. 모든 변경은 브랜치, 커밋, PR을 거쳐 반영합니다.

기본 흐름:

1. `main`을 최신 상태로 맞춥니다.
2. 작업 브랜치를 만듭니다.
3. 변경을 구현하고 필요한 검증을 실행합니다.
4. 논리 단위로 커밋합니다.
5. 원격 브랜치에 push하고 PR을 엽니다.
6. 리뷰와 검증을 마친 뒤 `main`에 merge합니다.

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

```md
## Summary
- 변경 요약

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

## Verification Expectations

변경 범위에 맞는 가장 작은 검증부터 실행합니다.

- 문서 변경: 맞춤법, 링크, 내용 일관성 확인
- UI 변경: 관련 컴포넌트 테스트와 화면 확인
- API/service 변경: 단위 테스트 또는 통합 테스트
- DB 변경: migration, schema, 관련 SQL 테스트
- 넓은 범위 변경: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`

검증을 실행하지 못한 경우 PR 본문에 이유와 남은 위험을 명시합니다.
