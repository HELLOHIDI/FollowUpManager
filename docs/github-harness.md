# GitHub Harness

GitHub harness는 ultragoal 기반 작업을 GitHub Issue, 작업 브랜치, draft PR, CI 확인, ready-for-review 전환까지 일관되게 이어 주는 로컬 보조 흐름이다. 실제 GitHub 쓰기 작업은 Codex GitHub connector가 담당하고, repo-local script는 no-token/no-network preflight와 draft generation만 담당한다.

## Workflow

1. 요구사항 또는 ralplan 산출물을 기준으로 GitHub Issue를 생성한다.
2. `main` 최신 상태에서 작업 브랜치를 만든다.
3. Codex가 구현, 검증, 커밋을 진행한다.
4. 작업 브랜치를 원격에 push한다.
5. Codex GitHub connector로 draft PR을 생성한다.
6. CI 상태와 PR 체크리스트를 확인한다.
7. CI와 검증이 통과하면 PR을 ready for review로 전환한다.
8. 사용자가 `merge 해줘`라고 명시적으로 요청한 경우에만 merge policy를 다시 확인하고 squash merge를 진행한다.

## Local Helper

`scripts/github-harness-check.ps1`는 로컬 상태를 확인하고 Issue/PR draft와 correlation state를 만든다.

예시:

```powershell
.\scripts\github-harness-check.ps1 `
  -Goal "Add expense export validation" `
  -GoalId "G001-expense-export-validation" `
  -IssueTitle "fix: harden expense export validation" `
  -BranchName "codex/expense-export-validation" `
  -DryRun
```

helper가 수행하는 일:

- 현재 git repository, origin, branch, head SHA 확인
- `main` 또는 `master`에서 실행되는 unsafe path 차단
- `.github/ISSUE_TEMPLATE/task.md`와 `.github/pull_request_template.md` 존재 확인
- `.omx/ultragoal/goals.json`을 optional read-only context로 읽기
- `.omx/github-harness/<fingerprint>/issue.md` 생성
- `.omx/github-harness/<fingerprint>/pull_request.md` 생성
- `.omx/github-harness/state.json` 생성 또는 갱신

helper가 하지 않는 일:

- GitHub token 저장
- GitHub remote write API 호출
- Issue, PR, branch protection, merge 직접 변경
- `.omx/ultragoal` 파일 수정

## Correlation State

반복 실행 시 같은 goal이 여러 Issue/PR로 갈라지지 않도록 `.omx/github-harness/state.json`을 사용한다. 이 파일은 `.omx` 아래에 있으므로 git에 커밋하지 않는다.

현재 계약은 한 repository clone에서 한 active harness workflow를 추적하는 단일 state 파일이다. 여러 ultragoal workflow를 동시에 진행해야 하면 브랜치나 worktree를 분리하거나, 이전 state가 stale인지 확인한 뒤 `-ResetState`로 명시적으로 교체한다.

state schema:

```json
{
  "schemaVersion": 1,
  "goalFingerprint": "sha256",
  "goalId": "G001-expense-export-validation",
  "issueNumber": 6,
  "issueUrl": "https://github.com/HELLOHIDI/FollowUpManager/issues/6",
  "branchName": "codex/github-harness",
  "prNumber": null,
  "prUrl": null,
  "headSha": "git-sha",
  "phase": "drafted",
  "lastCheckedAt": "2026-06-27T00:00:00.0000000Z",
  "verificationSummary": ""
}
```

Valid phases:

- `drafted`
- `issue_created`
- `branch_created`
- `work_in_progress`
- `pr_draft`
- `ci_pending`
- `ci_passed`
- `ready_for_review`
- `merged`

If an existing state file belongs to a different goal id, goal fingerprint, branch, issue, or PR, the helper halts instead of guessing. Use `-ResetState` only after confirming the old state is stale and safe to replace.

## Codex Responsibilities

Codex owns external side effects:

- Create GitHub Issue from the generated or planned body.
- Create and push the work branch.
- Create draft PR from the generated or planned body.
- Inspect GitHub Actions CI.
- Mark PR ready for review after verification passes.
- Merge only after the user explicitly requests merge and the merge policy passes.

The helper is intentionally not a standalone GitHub bot. This keeps secrets and write permissions outside the repository script.

## Merge Guardrails

Do not merge when:

- PR is draft.
- `ci` is failed, cancelled, missing, or still running.
- PR is not mergeable into `main`.
- PR body lacks verification evidence or risk notes.
- The user has not explicitly requested merge.

When merge is allowed, use squash merge only.
