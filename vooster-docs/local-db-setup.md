# GrantFollow Local DB Setup

## Purpose

This guide explains how to run the GrantFollow Supabase database locally for
development. It follows the approved local setup plan and keeps remote Supabase
projects untouched.

GrantFollow uses:

- Supabase PostgreSQL for application data
- Supabase Auth for the single internal login
- Supabase Storage for evidence files
- SQL migrations in `supabase/migrations/`

## What Docker changes on your PC

Docker Desktop runs the local Supabase services in isolated containers. Think of
containers as small app boxes:

- PostgreSQL runs in one box.
- Auth runs in another box.
- Storage runs in another box.
- Supabase Studio runs as a local web UI.

This means you can test migrations locally without changing the real Supabase
cloud project.

## Prerequisites

Use Windows PowerShell commands with `npm.cmd` in this project because bare
`npm` may be blocked by the PowerShell execution policy.

```powershell
node --version
npm.cmd --version
docker --version
```

Node must be v20 or newer. Docker Desktop must be installed and running.

If the current PowerShell session cannot find `docker` after Docker Desktop was
installed, either open a new terminal or temporarily prepend Docker's CLI path:

```powershell
$env:Path = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:Path
```

## Start local Supabase

Install the pinned Supabase CLI dependency:

```powershell
npm.cmd install --save-dev supabase@2.107.0
```

Initialize local Supabase config only when `supabase/config.toml` does not exist:

```powershell
npm.cmd exec supabase -- init
```

Start the local stack:

```powershell
npm.cmd exec supabase -- start
```

The local Studio URL is usually:

```text
http://127.0.0.1:54323
```

## Apply migrations

Reset the local database and apply all migrations:

```powershell
npm.cmd exec supabase -- db reset
```

Expected migration order:

```text
0002_create_common_database_utilities.sql
0003_create_companies.sql
0004_create_projects.sql
0005_create_budget_category_policy_templates.sql
0006_create_project_budget_categories.sql
0007_create_expenses.sql
0008_create_expense_evidence_files.sql
0009_create_expense_history_events.sql
0010_create_dashboard_views.sql
0011_enforce_expense_evidence_boundaries.sql
0012_align_company_registration_fields.sql
0013_grant_company_api_roles.sql
0014_align_project_registration_and_documents.sql
0015_align_expense_dashboard_slice.sql
0016_seed_project_budget_categories.sql
0017_add_expense_funding_source.sql
0018_add_expense_detail_history_rpcs.sql
0019_add_expense_evidence_history_rpcs.sql
```

After migrations, `supabase/seed.sql` restores the fixed local development
administrator. Automated tests must use their own generated users and must not
delete this account:

```text
ID: admin@example.com
PW: admin1234
```

This credential is local-development-only and must not be reused for a remote
or production Supabase project.

## Environment variables

Copy local values from:

```powershell
npm.cmd exec supabase -- status
```

Create `.env.local` with:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from status>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from status>
```

Do not commit `.env.local`. This repository ignores `.env*` except documented
examples.

Validate the env file:

```powershell
npm.cmd run env:check
```

## Generate database types

After migrations are applied:

```powershell
npm.cmd exec supabase -- gen types typescript --local | Set-Content -Encoding UTF8 src\lib\supabase\types.ts
```

Then verify TypeScript:

```powershell
npm.cmd run typecheck
```

## Verify important DB objects

After `db reset`, verify:

- Tables: `companies`, `projects`, `project_budget_categories`, `expenses`,
  `expense_evidence_files`, `expense_history_events`
- Views: `project_kpi_summary`, `project_category_amount_summary`,
  `project_kanban_stage_summary`, `project_expenses_by_category`,
  `project_expenses_by_stage`
- RLS enabled on GrantFollow domain tables
- Authenticated users have read-only table policies; Hono/service-role APIs own writes
- Private Storage bucket: `expense-evidence`, with `public=false`
- Evidence metadata cannot reference an expense from a different project

If SQL bucket creation fails locally, creating `expense-evidence` manually in
local Studio is only a local verification fallback. It does not replace fixing a
reproducible migration failure before remote deployment.

## Stop local Supabase

```powershell
npm.cmd exec supabase -- stop
```

## Safety rules

- Do not run these commands against a remote Supabase project.
- Before any future remote link or migration, confirm the remote PostgreSQL major version matches the local `supabase/config.toml` value.
- Do not commit `.env.local`.
- Keep Supabase Auth single-account MVP scope.
- Route domain writes, evidence uploads, history creation, and signed URL creation through Hono server APIs.
- Do not add company members, project members, roles, or permission tables for
  the MVP.
- The generated local `supabase/config.toml` may allow email signup so a
  developer can bootstrap one local test account. Treat that as a local-only
  convenience, not as a product permission model.
