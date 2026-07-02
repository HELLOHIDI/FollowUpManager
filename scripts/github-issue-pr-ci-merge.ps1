param(
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][string]$Branch,
  [string]$CommitMessage = $Title,
  [string]$Base = "main",
  [string]$Body = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI(gh)가 필요합니다. 설치 후 다시 실행하세요."
}

$issueUrl = gh issue create --title $Title --body $Body
git switch -c $Branch
git add -A
git commit -m $CommitMessage
git push -u origin $Branch

$prUrl = gh pr create --base $Base --head $Branch --title "[codex] $Title" --body "Closes $issueUrl`n`n$Body"
gh pr checks --watch
gh pr merge --squash --delete-branch

Write-Host "Issue: $issueUrl"
Write-Host "PR: $prUrl"
