$ErrorActionPreference = "Stop"

$container = "supabase_db_FollowUpManager"
$setup = @"
insert into public.companies (id, company_name, business_type, company_size, business_registration_number, founded_at, profile_status)
values ('30000000-0000-4000-8000-000000000001', 'Concurrency Company', 'sole_proprietor', 'small_enterprise', '9999999999', current_date, 'complete');
insert into public.projects (
  id, company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, self_cash_amount, self_in_kind_amount, self_contribution_amount,
  total_project_budget, assignment_number, assignment_name, manager_name, manager_email, profile_status
) values (
  '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Concurrency Project', 'Host', current_date, current_date,
  100, 0, 0, 0, 100, 'CONCURRENT-001', 'Assignment', 'Manager', 'manager@example.com', 'complete'
);
insert into public.project_budget_categories (id, project_id, category_key, sort_order)
values ('30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'material_cost', 1);
"@
$setup | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to seed concurrency fixture." }

$firstSql = @"
begin;
set local lock_timeout='5s';
insert into public.expenses (project_id, project_budget_category_id, category_key, title, stage_key, amount)
values ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'material_cost', 'First completion', 'execution_completed', 60);
select pg_sleep(2);
commit;
"@
$first = Start-Job -ScriptBlock {
  param($Container, $Sql)
  $Sql | & docker exec -i $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1
  exit $LASTEXITCODE
} -ArgumentList $container, $firstSql
Start-Sleep -Milliseconds 500

$secondSql = @"
begin;
set local lock_timeout='5s';
insert into public.expenses (project_id, project_budget_category_id, category_key, title, stage_key, amount)
values ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'material_cost', 'Second completion', 'execution_completed', 50);
commit;
"@
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$secondOutput = $secondSql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
$secondExit = $LASTEXITCODE
$ErrorActionPreference = $previousPreference
Wait-Job $first | Out-Null
$firstOutput = Receive-Job $first
if ($first.State -ne "Completed") { throw "First completion failed: $firstOutput" }
Remove-Job $first
if ($secondExit -eq 0 -or ($secondOutput -join "`n") -notmatch "PROJECT_COMPLETED_SPEND_EXCEEDS_BUDGET") {
  throw "Second completion did not fail with the stable cap error: $secondOutput"
}
$count = & docker exec $container psql -U postgres -d postgres -Atc "select count(*) from public.expenses where project_id='30000000-0000-4000-8000-000000000002' and stage_key='execution_completed';"
if ($count.Trim() -ne "1") { throw "Expected exactly one committed completion, found $count." }

& npm.cmd exec supabase -- db reset | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to restore clean local database." }
Write-Output "Expense budget concurrency passed: exactly one completion committed and one stable cap rejection occurred."
