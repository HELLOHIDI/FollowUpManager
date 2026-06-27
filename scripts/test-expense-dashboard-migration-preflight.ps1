$ErrorActionPreference = "Stop"

$container = "supabase_db_FollowUpManager"
$migrationPath = Join-Path $PSScriptRoot "..\supabase\migrations\0015_align_expense_dashboard_slice.sql"
$migration = Get-Content -Encoding UTF8 -Raw -LiteralPath $migrationPath

$baseFixture = @"
insert into public.companies (id, company_name, business_type, company_size, business_registration_number, founded_at, profile_status)
values ('20000000-0000-4000-8000-000000000001', 'Preflight Company', 'sole_proprietor', 'small_enterprise', '8888888888', current_date, 'complete');
insert into public.projects (
  id, company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, self_cash_amount, self_in_kind_amount, self_contribution_amount,
  total_project_budget, assignment_number, assignment_name, manager_name, manager_email, profile_status
) values (
  '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Preflight Project', 'Host', current_date, current_date,
  100, 0, 0, 0, 100, 'PREFLIGHT-001', 'Assignment', 'Manager', 'manager@example.com', 'complete'
);
insert into public.project_budget_categories (id, project_id, category_key, budget_amount, sort_order)
values ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'material_cost', 37, 1);
"@

function Reset-To-0014 {
  & npm.cmd exec supabase -- db reset --version 0014 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to reset local database to migration 0014." }
}

function Invoke-Psql([string]$Sql, [bool]$ExpectSuccess = $true) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = $Sql | & docker exec -i $container psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 2>&1
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($ExpectSuccess -and $exitCode -ne 0) { throw "psql failed: $output" }
  if (-not $ExpectSuccess -and $exitCode -eq 0) { throw "psql unexpectedly succeeded." }
  return @{ ExitCode = $exitCode; Output = ($output -join "`n") }
}

$invalidFixtures = @(
  @{ Name = "conflicting amounts"; Amounts = "10, 20, null, null" },
  @{ Name = "all-null amounts"; Amounts = "null, null, null, null" }
)

foreach ($fixture in $invalidFixtures) {
  Reset-To-0014
  Invoke-Psql "$baseFixture`ninsert into public.expenses (project_id, project_budget_category_id, category_key, title, expected_amount, approved_amount, contract_amount, final_amount) values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'material_cost', 'Legacy', $($fixture.Amounts));" | Out-Null
  $attempt = Invoke-Psql $migration $false
  if ($attempt.Output -notmatch "expenses incompatible with canonical amount") { throw "Missing stable preflight error for $($fixture.Name)." }
  $rollback = Invoke-Psql "select (select count(*) from information_schema.columns where table_schema='public' and table_name='expenses' and column_name='expected_amount'), (select budget_amount from public.project_budget_categories where id='20000000-0000-4000-8000-000000000003'), to_regclass('public.project_kpi_summary'), to_regclass('public.project_budget_category_budget_archive');"
  if ($rollback.Output -notmatch "1\|37\|project_kpi_summary\|") { throw "Rollback did not preserve legacy schema/value/view for $($fixture.Name): $($rollback.Output)" }
}

Reset-To-0014
Invoke-Psql "$baseFixture`ninsert into public.expenses (project_id, project_budget_category_id, category_key, title, stage_key, expected_amount, approved_amount) values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'material_cost', 'Legacy request', 'execution_request', 50, 50);" | Out-Null
Invoke-Psql $migration | Out-Null
$success = Invoke-Psql "select e.amount, e.stage_key, a.budget_amount, a.source_created_at = c.created_at, a.source_updated_at = c.updated_at, a.source_deleted_at is not distinct from c.deleted_at from public.expenses e cross join public.project_budget_categories c join public.project_budget_category_budget_archive a on a.original_category_id = c.id where e.title='Legacy request';"
if ($success.Output -notmatch "50\|execution_request\|37\|t\|t\|t") { throw "Successful archive/conversion verification failed: $($success.Output)" }

Reset-To-0014
Invoke-Psql $baseFixture | Out-Null
$slowMigration = $migration.Replace(
  "lock table public.project_budget_categories in access exclusive mode;",
  "lock table public.project_budget_categories in access exclusive mode; select pg_sleep(3);"
)
$migrationJob = Start-Job -ScriptBlock {
  param($Container, $Sql)
  $Sql | & docker exec -i $Container psql -U postgres -d postgres -At -v ON_ERROR_STOP=1
  exit $LASTEXITCODE
} -ArgumentList $container, $slowMigration
Start-Sleep -Milliseconds 750
$writer = Invoke-Psql "set lock_timeout='500ms'; update public.project_budget_categories set budget_amount=999 where id='20000000-0000-4000-8000-000000000003';" $false
if ($writer.Output -notmatch "lock timeout") { throw "Concurrent category writer was not blocked by the migration lock: $($writer.Output)" }
Wait-Job $migrationJob | Out-Null
$migrationOutput = Receive-Job $migrationJob
if ($migrationJob.State -ne "Completed") { throw "Slow migration job failed: $migrationOutput" }
Remove-Job $migrationJob
$lockedCopy = Invoke-Psql "select budget_amount from public.project_budget_category_budget_archive where original_category_id='20000000-0000-4000-8000-000000000003';"
if ($lockedCopy.Output.Trim() -ne "37") { throw "Locked archive copy changed unexpectedly: $($lockedCopy.Output)" }

& npm.cmd exec supabase -- db reset | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to restore clean local database." }
Write-Output "Expense dashboard migration preflight passed: $($invalidFixtures.Count) rollback fixtures, success archive, and lock serialization."
