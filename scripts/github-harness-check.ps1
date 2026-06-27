param(
  [Parameter(Mandatory = $true)]
  [string]$Goal,

  [string]$GoalId,
  [string]$IssueTitle = "chore: add github harness for ultragoal workflow",
  [string]$BranchName,
  [int]$IssueNumber,
  [string]$IssueUrl,
  [int]$PrNumber,
  [string]$PrUrl,
  [string]$HeadSha,
  [string]$Phase = "drafted",
  [string]$VerificationSummary = "",
  [switch]$DryRun,
  [switch]$AllowMain,
  [switch]$ResetState
)

$ErrorActionPreference = "Stop"

$validPhases = @(
  "drafted",
  "issue_created",
  "branch_created",
  "work_in_progress",
  "pr_draft",
  "ci_pending",
  "ci_passed",
  "ready_for_review",
  "merged"
)

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $output = & git @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed: $output"
  }

  return ($output -join "`n").Trim()
}

function Get-GoalFingerprint {
  param([Parameter(Mandatory = $true)][string]$Value)

  $normalizedGoal = ($Value -replace "\s+", " ").Trim()
  $bytes = [Text.Encoding]::UTF8.GetBytes($normalizedGoal)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash($bytes)
  }
  finally {
    $sha.Dispose()
  }

  return (($hash | ForEach-Object { $_.ToString("x2") }) -join "")
}

function ConvertTo-NullableNumber {
  param([int]$Value)

  if ($Value -gt 0) {
    return $Value
  }

  return $null
}

function Get-SafeRemoteUrl {
  param([Parameter(Mandatory = $true)][string]$RemoteUrl)

  if ($RemoteUrl -match "^[a-zA-Z][a-zA-Z0-9+.-]*://") {
    try {
      $uriBuilder = [UriBuilder]::new($RemoteUrl)
      $uriBuilder.UserName = ""
      $uriBuilder.Password = ""
      $uriBuilder.Query = ""
      $uriBuilder.Fragment = ""
      return $uriBuilder.Uri.AbsoluteUri
    }
    catch {
      $withoutUserInfo = $RemoteUrl -replace "://[^/@]+@", "://"
      return ($withoutUserInfo -replace "[?#].*$", "")
    }
  }

  return $RemoteUrl
}

function Assert-StateMatch {
  param(
    [Parameter(Mandatory = $true)]$CurrentState,
    [Parameter(Mandatory = $true)][string]$ExpectedFingerprint,
    [string]$ExpectedGoalId,
    [string]$ExpectedBranchName,
    [int]$ExpectedIssueNumber,
    [int]$ExpectedPrNumber
  )

  if ($CurrentState.goalFingerprint -and $CurrentState.goalFingerprint -ne $ExpectedFingerprint) {
    throw "Existing harness state belongs to a different goal. Use -ResetState only after confirming stale state is safe to replace."
  }

  if ($ExpectedGoalId -and $CurrentState.goalId -and $CurrentState.goalId -ne $ExpectedGoalId) {
    throw "Existing harness state goal '$($CurrentState.goalId)' conflicts with requested goal '$ExpectedGoalId'."
  }

  if ($ExpectedBranchName -and $CurrentState.branchName -and $CurrentState.branchName -ne $ExpectedBranchName) {
    throw "Existing harness state branch '$($CurrentState.branchName)' conflicts with requested branch '$ExpectedBranchName'."
  }

  if ($ExpectedIssueNumber -gt 0 -and $CurrentState.issueNumber -and [int]$CurrentState.issueNumber -ne $ExpectedIssueNumber) {
    throw "Existing harness state issue #$($CurrentState.issueNumber) conflicts with requested issue #$ExpectedIssueNumber."
  }

  if ($ExpectedPrNumber -gt 0 -and $CurrentState.prNumber -and [int]$CurrentState.prNumber -ne $ExpectedPrNumber) {
    throw "Existing harness state PR #$($CurrentState.prNumber) conflicts with requested PR #$ExpectedPrNumber."
  }
}

function Merge-Value {
  param($ExistingValue, $NewValue)

  if ($null -ne $NewValue -and "$NewValue" -ne "") {
    return $NewValue
  }

  return $ExistingValue
}

if ($validPhases -notcontains $Phase) {
  throw "Invalid phase '$Phase'. Valid phases: $($validPhases -join ', ')"
}

$repoRoot = Invoke-Git -Arguments @("rev-parse", "--show-toplevel")
Set-Location -LiteralPath $repoRoot

$currentBranch = Invoke-Git -Arguments @("branch", "--show-current")
if (-not $BranchName) {
  $BranchName = $currentBranch
}

if ((-not $AllowMain) -and ($currentBranch -eq "main" -or $currentBranch -eq "master")) {
  throw "Refusing to run GitHub harness on '$currentBranch'. Create a work branch first or pass -AllowMain for inspection-only use."
}

$originUrl = Invoke-Git -Arguments @("remote", "get-url", "origin")
$safeOriginUrl = Get-SafeRemoteUrl -RemoteUrl $originUrl
$headCommit = Invoke-Git -Arguments @("rev-parse", "HEAD")
if (-not $HeadSha) {
  $HeadSha = $headCommit
}

$issueTemplatePath = Join-Path $repoRoot ".github\ISSUE_TEMPLATE\task.md"
$prTemplatePath = Join-Path $repoRoot ".github\pull_request_template.md"
if (-not (Test-Path -LiteralPath $issueTemplatePath)) {
  throw "Missing issue template: $issueTemplatePath"
}
if (-not (Test-Path -LiteralPath $prTemplatePath)) {
  throw "Missing PR template: $prTemplatePath"
}

$dirtyStatus = Invoke-Git -Arguments @("status", "--short")
$ghAvailable = $false
try {
  $null = Get-Command gh -ErrorAction Stop
  $ghAvailable = $true
}
catch {
  $ghAvailable = $false
}

$harnessRoot = Join-Path $repoRoot ".omx\github-harness"
$goalFingerprint = Get-GoalFingerprint -Value $Goal
$goalSlug = $goalFingerprint.Substring(0, 12)
$draftRoot = Join-Path $harnessRoot $goalSlug
$statePath = Join-Path $harnessRoot "state.json"
$issueDraftPath = Join-Path $draftRoot "issue.md"
$prDraftPath = Join-Path $draftRoot "pull_request.md"

if (-not (Test-Path -LiteralPath $draftRoot)) {
  New-Item -ItemType Directory -Path $draftRoot | Out-Null
}

$existingState = $null
if ((Test-Path -LiteralPath $statePath) -and (-not $ResetState)) {
  $existingState = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
  Assert-StateMatch `
    -CurrentState $existingState `
    -ExpectedFingerprint $goalFingerprint `
    -ExpectedGoalId $GoalId `
    -ExpectedBranchName $BranchName `
    -ExpectedIssueNumber $IssueNumber `
    -ExpectedPrNumber $PrNumber
}

$ultragoalSummary = "N/A"
$ultragoalGoalsPath = Join-Path $repoRoot ".omx\ultragoal\goals.json"
if (Test-Path -LiteralPath $ultragoalGoalsPath) {
  try {
    $ultragoalGoals = Get-Content -LiteralPath $ultragoalGoalsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($ultragoalGoals.goals -and $ultragoalGoals.goals.Count -gt 0) {
      $ultragoalSummary = ($ultragoalGoals.goals | ForEach-Object { "- $($_.id): $($_.title)" }) -join "`n"
    }
  }
  catch {
    $ultragoalSummary = "Unable to parse .omx/ultragoal/goals.json: $($_.Exception.Message)"
  }
}

$issueNumberValue = ConvertTo-NullableNumber -Value $IssueNumber
$prNumberValue = ConvertTo-NullableNumber -Value $PrNumber

$state = [pscustomobject]@{
  schemaVersion = 1
  goalFingerprint = $goalFingerprint
  goalId = Merge-Value -ExistingValue $existingState.goalId -NewValue $GoalId
  issueNumber = Merge-Value -ExistingValue $existingState.issueNumber -NewValue $issueNumberValue
  issueUrl = Merge-Value -ExistingValue $existingState.issueUrl -NewValue $IssueUrl
  branchName = Merge-Value -ExistingValue $existingState.branchName -NewValue $BranchName
  prNumber = Merge-Value -ExistingValue $existingState.prNumber -NewValue $prNumberValue
  prUrl = Merge-Value -ExistingValue $existingState.prUrl -NewValue $PrUrl
  headSha = Merge-Value -ExistingValue $existingState.headSha -NewValue $HeadSha
  phase = $Phase
  lastCheckedAt = [DateTime]::UtcNow.ToString("o")
  verificationSummary = $VerificationSummary
}

$issueReference = "TBD"
if ($state.issueNumber) {
  $issueReference = "#$($state.issueNumber)"
}

$prReference = "TBD"
if ($state.prNumber) {
  $prReference = "#$($state.prNumber)"
}

$issueBody = @"
## Goal

- $Goal

## Scope

- Generate local GitHub workflow drafts for the requested goal.
- Preserve local correlation state for idempotent reruns.
- Keep GitHub remote mutations in Codex connector orchestration.

## Out of Scope

- Storing GitHub tokens.
- Calling remote write APIs from this script.
- Merging a pull request without an explicit user request.

## Acceptance Criteria

- Harness runs without gh CLI.
- Harness writes only local .omx/github-harness artifacts.
- Harness refuses unsafe main-branch execution by default.
- Repeated runs reuse the same goal fingerprint and state record.

## Verification

- Branch: $BranchName
- Head SHA: $HeadSha
- Dirty status:

~~~text
$dirtyStatus
~~~

## Risks / Notes

- gh available: $ghAvailable
- Origin: $safeOriginUrl
- Ultragoal context:

$ultragoalSummary
"@

$prBody = @"
## Summary

- GitHub harness draft for: $IssueTitle
- Goal fingerprint: $goalFingerprint

## Scope

- Branch: $BranchName
- Issue: $issueReference
- PR: $prReference
- Phase: $Phase

## Verification

- Script dry-run: pending
- Template alignment: pending
- Idempotent state check: pending
- Workspace mutation check: pending

## Notes

- This helper does not store tokens or call GitHub write APIs.
- Codex connector remains responsible for Issue/PR creation, CI inspection, ready transition, and explicit user-gated merge.

## Merge Policy

- [ ] PR is ready for review and not draft
- [ ] Required GitHub Actions check ci passed
- [ ] PR is mergeable into main
- [ ] Squash merge is the intended merge method

## Checklist

- [ ] Scope is limited to one slice or purpose
- [ ] Tests or verification evidence are listed
- [ ] Docs updated or N/A
- [ ] Risks / follow-ups are documented or N/A
- [ ] No secrets or local runtime files included
"@

Set-Content -LiteralPath $issueDraftPath -Value $issueBody -Encoding UTF8
Set-Content -LiteralPath $prDraftPath -Value $prBody -Encoding UTF8
($state | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath $statePath -Encoding UTF8

$result = [pscustomobject]@{
  dryRun = [bool]$DryRun
  repoRoot = $repoRoot
  currentBranch = $currentBranch
  branchName = $BranchName
  origin = $safeOriginUrl
  headSha = $HeadSha
  phase = $Phase
  ghAvailable = $ghAvailable
  goalFingerprint = $goalFingerprint
  goalId = $state.goalId
  statePath = $statePath
  issueDraftPath = $issueDraftPath
  prDraftPath = $prDraftPath
}

$result | ConvertTo-Json -Depth 5
