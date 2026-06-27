$ErrorActionPreference = "Stop"

$container = "supabase_db_FollowUpManager"
$migrationPath = Join-Path $PSScriptRoot "..\supabase\migrations\0014_align_project_registration_and_documents.sql"
$migration = Get-Content -Encoding UTF8 -Raw -LiteralPath $migrationPath

$baseInsert = @"
insert into public.companies (
  id, company_name, business_type, company_size, business_registration_number,
  founded_at, profile_status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Preflight Company', 'sole_proprietor',
  'small_enterprise', '6666666666', current_date, 'complete'
);
"@

$fixtures = @(
  @{
    Name = "blank assignment"
    Sql = $baseInsert + @"
insert into public.projects (
  company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, self_contribution_amount, total_project_budget,
  assignment_number, assignment_name, manager_name, manager_email, manager_phone, profile_status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'P', 'H', current_date, current_date,
  1, 0, 1, null, 'A', 'M', 'm@example.com', '010-0000-0000', 'complete'
);
"@
  },
  @{
    Name = "zero total"
    Sql = $baseInsert + @"
insert into public.projects (
  company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  assignment_number, assignment_name, manager_name, manager_email, manager_phone, profile_status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'P', 'H', current_date, current_date,
  'P-1', 'A', 'M', 'm@example.com', '010-0000-0000', 'complete'
);
"@
  },
  @{
    Name = "non-complete status"
    Sql = $baseInsert + @"
insert into public.projects (
  company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, self_contribution_amount, total_project_budget,
  assignment_number, assignment_name, manager_name, manager_email, manager_phone, profile_status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'P', 'H', current_date, current_date,
  1, 0, 1, 'P-1', 'A', 'M', 'm@example.com', '010-0000-0000', 'incomplete'
);
"@
  },
  @{
    Name = "unsafe amount"
    Sql = $baseInsert + @"
insert into public.projects (
  company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, self_contribution_amount, total_project_budget,
  assignment_number, assignment_name, manager_name, manager_email, manager_phone, profile_status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'P', 'H', current_date, current_date,
  9007199254740992, 0, 9007199254740992, 'P-1', 'A', 'M', 'm@example.com', '010-0000-0000', 'complete'
);
"@
  },
  @{
    Name = "contactless row"
    Sql = $baseInsert + @"
alter table public.projects drop constraint projects_manager_email_check;
alter table public.projects drop constraint projects_manager_phone_check;
alter table public.projects alter column manager_email drop not null;
alter table public.projects alter column manager_phone drop not null;
insert into public.projects (
  company_id, project_name, host_institution, agreement_start_date, agreement_end_date,
  government_subsidy_amount, self_contribution_amount, total_project_budget,
  assignment_number, assignment_name, manager_name, profile_status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'P', 'H', current_date, current_date,
  1, 0, 1, 'P-1', 'A', 'M', 'complete'
);
"@
  },
  @{
    Name = "downstream dependency"
    Sql = "create view public.project_ratio_dependency as select self_cash_ratio from public.projects;"
  }
)

foreach ($fixture in $fixtures) {
  & npm.cmd exec supabase -- db reset --version 0013 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to reset local DB for $($fixture.Name)." }

  $fixture.Sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to seed preflight fixture: $($fixture.Name)." }

  $migrationAttempt = "begin;`n$migration"
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $migrationAttempt | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1 | Out-Null
  $migrationExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($migrationExitCode -eq 0) { throw "Migration unexpectedly accepted fixture: $($fixture.Name)." }

  $columnExists = & docker exec $container psql -U postgres -d postgres -Atc "select count(*) from information_schema.columns where table_schema='public' and table_name='projects' and column_name='self_cash_ratio';"
  if ($columnExists.Trim() -ne "1") { throw "Migration did not roll back cleanly for fixture: $($fixture.Name)." }
}

& npm.cmd exec supabase -- db reset | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to restore clean local DB after preflight tests." }

Write-Output "Project migration preflight fixtures passed: $($fixtures.Count)"
