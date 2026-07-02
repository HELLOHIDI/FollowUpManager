# FuManager DB Phase 0 Decisions

## Purpose

This document records the Phase 0 decisions for the FuManager MVP database setup.
It is a pre-implementation baseline, not a migration plan file.

The goal is to make the first database migrations predictable, secure, and aligned
with the product documents before writing SQL.

## Source Documents

These decisions are based on:

- `vooster-docs/prd.md`
- `vooster-docs/architecture.md`
- `vooster-docs/ia.md`
- `vooster-docs/guideline.md`
- `vooster-docs/clean-code.md`
- `vooster-docs/policies/company-policy.md`
- `vooster-docs/policies/project-policy.md`
- `vooster-docs/policies/budget-category-policy.md`
- `vooster-docs/policies/expense-execution-policy.md`
- `vooster-docs/policies/evidence-policy.md`

When documents conflict, product and IA decisions follow this priority:

```text
PRD > IA > Architecture > Design Guide > Guideline > Step-by-step > Clean-code
```

## Current Baseline

- Supabase PostgreSQL is the MVP application database.
- Supabase Storage is the evidence file store.
- Supabase Auth is used for a single internal account login.
- Multi-user role and permission management is out of MVP scope.
- The starter `public.example` table has been removed from the active schema.
- FuManager domain migrations are the active database baseline.
- `src/lib/supabase/types.ts` reflects the FuManager schema.

## Decision 1. Security Model

Decision:

- Enable RLS on every FuManager domain table.
- Allow access only to authenticated users for MVP.
- Do not introduce company roles, project members, or permission tables in MVP.
- Use the service-role Supabase client only inside server-side Hono/API code.
- Use signed URLs for evidence file preview/download.

Reasoning:

- The product has sensitive grant, expense, and evidence data.
- Even with a single internal account, default public access is too risky.
- RLS keeps client-side Supabase usage safer if it is introduced later.
- This keeps authorization simple while still applying least privilege.

Implementation implication:

- Do not copy the starter migration pattern that disables RLS.
- RLS policies can be simple `authenticated` policies at first.
- More granular ownership policies can be added after MVP if team features are introduced.

## Decision 2. Route Baseline

Decision:

The canonical MVP routes are:

```text
/login
/projects
/projects/:projectId
/projects/:projectId/expenses/:expenseId
/projects/:projectId/export
/settings/company
/_health
```

Root route behavior:

```text
Unauthenticated / -> /login
Authenticated / -> first available project dashboard
```

Reasoning:

- The IA and architecture center the product around `/projects/:projectId`.
- The current `/dashboard` route is starter scaffolding, not the FuManager domain route.
- The DB should be shaped around company/project/expense resources, not the starter page.

Implementation implication:

- DB and API naming should use `projects`, not generic `dashboard`.
- Do not add a user profile table only for `last_used_project_id` in MVP.
- A `last_used_project_id` persistence mechanism can be added after the core domain is stable.

## Decision 3. Naming And Structural Conventions

Decision:

- Table names use plural snake_case.
- Column names use snake_case.
- Primary keys use `id uuid primary key default gen_random_uuid()`.
- Foreign keys use `{entity}_id`.
- Domain timestamps use:
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Soft deletion uses `deleted_at timestamptz`.
- Monetary values use `bigint` in Korean won integer units.
- Business dates use `date`.
- Event timestamps use `timestamptz`.

Reasoning:

- This matches Supabase/PostgreSQL conventions and keeps generated TypeScript predictable.
- `bigint` avoids decimal currency drift and preserves won-level precision.
- `date` is enough for agreement periods and spend dates.

Implementation implication:

- Add a shared `updated_at` trigger function before domain tables.
- Avoid storing formatted currency or formatted dates in DB.
- Format money and dates only at the UI/API boundary.

## Decision 4. Check Constraints Over PostgreSQL Enums

Decision:

- Use `text` columns with `check` constraints for MVP status/key fields.
- Do not use PostgreSQL enum types for the first MVP migrations.

Reasoning:

- PostgreSQL enum changes are more cumbersome during early product iteration.
- The domain keys are stable enough for checks, but still easier to adjust as text.
- TypeScript unions and zod schemas can provide application-level type safety.

Implementation implication:

Use check constraints for fields such as:

```text
company profile status
project profile status
budget composition status
expense stage key
pre-approval status
execution progress status
execution request status
document key
```

## Decision 5. Core Domain Ownership

Decision:

FuManager's ownership chain is:

```text
companies
  -> projects
    -> project_budget_categories
    -> expenses
      -> expense_evidence_files
      -> expense_history_events
```

Reasoning:

- Company is the top-level management subject.
- Project belongs to a company.
- Budget category is a project-specific budget plan and classification.
- Expense is the actual execution and management unit.
- Evidence and history belong to individual expenses.

Implementation implication:

- `projects.company_id` is required.
- `project_budget_categories.project_id` is required.
- `expenses.project_id` is required.
- `expense_evidence_files.expense_id` is required.
- `expense_history_events.expense_id` is required.

## Decision 6. Company Data Baseline

Decision:

The `companies` table is the first domain entity.

Minimum fields:

```text
company_name
business_type
company_size
business_region_sido
business_region_sigungu
business_address_detail
business_condition
business_type_detail
business_registration_number
corporate_registration_number
founded_at
profile_status
created_at
updated_at
```

Decision details:

- `business_registration_number` is unique.
- `corporate_registration_number` is nullable.
- Conditional requirement for corporate registration number is handled primarily in app validation.
- `profile_status` uses:

```text
complete
incomplete
review_required
invalid
```

Reasoning:

- Company identity is required before project, budget, expense, and evidence data.
- Business registration number is the strongest duplicate-prevention key.

## Decision 7. Project Data Baseline

Decision:

The `projects` table belongs to `companies`.

Minimum fields:

```text
company_id
project_name
host_institution
agreement_start_date
agreement_end_date
government_subsidy_amount
self_cash_amount
self_in_kind_amount
self_contribution_amount
total_project_budget
self_cash_ratio
self_in_kind_ratio
budget_composition_status
assignment_number
assignment_name
manager_name
manager_email
manager_phone
project_notes
profile_status
created_at
updated_at
```

Decision details:

- `agreement_end_date >= agreement_start_date` is a DB constraint.
- All amount columns are `bigint` and non-negative.
- `self_contribution_amount = self_cash_amount + self_in_kind_amount`.
- `total_project_budget = government_subsidy_amount + self_cash_amount + self_in_kind_amount`.
- `assignment_number` is nullable.
- If present, `assignment_number` should be unique within the company.

Reasoning:

- Project defines the dashboard context and budget basis.
- Budget calculations should be protected by DB constraints where possible.

## Decision 8. Budget Category Policy Baseline

Decision:

Use a global `budget_category_policy_templates` table for default category policy data.

The 9 default category keys are:

```text
material_cost
outsourcing_cost
equipment_software
intangible_asset_ip
labor_cost
service_fee
travel_expense
training_cost
advertising_cost
```

Decision details:

- Policy templates are global defaults, not project-specific budgets.
- Store evidence requirements, caution notes, and restricted notes as JSONB for MVP.
- Do not implement user-custom policy overrides in MVP.

Reasoning:

- The policy document defines guidance templates, not execution state.
- JSONB keeps the first implementation compact and adaptable.
- Full normalization can come later if policy management becomes a feature.

## Decision 9. Project Budget Category Baseline

Decision:

Use `project_budget_categories` for project-specific category budgets.

Minimum fields:

```text
project_id
category_key
budget_amount
sort_order
is_active
created_at
updated_at
```

Decision details:

- `project_id + category_key` is unique.
- `budget_amount` is `bigint` and non-negative.
- Budget categories do not own stage, evidence, approval, or execution status.

Reasoning:

- Category is the expense classification basis.
- Execution state belongs to expenses, not categories.

## Decision 10. Expense Baseline

Decision:

`expenses` is the execution and management unit.

Minimum fields:

```text
project_id
project_budget_category_id
category_key
title
stage_key
expected_amount
approved_amount
contract_amount
final_amount
expected_spend_date
execution_request_date
vendor_name
memo
pre_approval_status
execution_progress_status
execution_request_status
stage_fields
created_at
updated_at
```

Decision details:

- `project_budget_category_id` is required from day one.
- `category_key` is also stored for filtering, policy lookup, and dashboard grouping.
- `project_budget_category_id` is the authoritative relationship.
- `category_key` must match the connected `project_budget_categories.category_key`.
- `stage_key` uses:

```text
sales_completed
pre_approval
execution_in_progress
execution_request
```

- Stage movement is a soft gate.
- Missing recommended fields or evidence does not block stage movement.
- Data integrity errors still block save.
- Stage-specific fields start as `stage_fields jsonb`.
- Core dashboard/search fields stay as columns.

Reasoning:

- The expense execution policy defines expense as the real work unit.
- MVP should avoid over-normalizing every stage field too early.
- Keeping the category FK and category key together makes integrity strict while keeping queries simple.

## Decision 11. Actual Spent Amount

Decision:

Actual spent amount is calculated only from:

```text
expenses.stage_key = 'execution_request'
and expenses.final_amount is not null
```

Formula:

```text
actual_spent_amount = sum(final_amount)
```

Reasoning:

- Earlier stages represent planned, approval, or in-progress values.
- The policy states actual spend is based on final amount at execution request stage.

Implementation implication:

- Dashboard views must not include `expected_amount`, `approved_amount`, or `contract_amount`
  in actual spent totals.
- Earlier stage amounts can be shown as pipeline/forecast data only.

## Decision 12. Evidence File Baseline

Decision:

Use Supabase Storage private bucket:

```text
expense-evidence
```

Storage path:

```text
companies/{companyId}/projects/{projectId}/expenses/{expenseId}/{documentKey}/{fileId}-{sanitizedFileName}
```

Metadata table:

```text
expense_evidence_files
```

Minimum fields:

```text
company_id
project_id
expense_id
document_key
requirement_key
original_file_name
stored_file_name
storage_bucket
storage_path
file_size
mime_type
file_extension
file_hash
duplicate_group_key
uploaded_by
uploaded_at
deleted_at
```

Decision details:

- Store metadata in DB, not file contents.
- Use signed URLs for read access.
- Use `deleted_at` for MVP deletion behavior.
- Physical Storage deletion can be handled later by a cleanup process.
- `file_hash` is nullable in MVP.
- `duplicate_group_key` is nullable in MVP.
- Duplicate detection is advisory in MVP and must not block upload when hash data is unavailable.

Reasoning:

- Evidence files are sensitive and should never be public.
- Metadata must be queryable from the expense detail page.
- Hash calculation should improve duplicate detection without making the first upload flow fragile.

## Decision 13. Expense History Baseline

Decision:

Use `expense_history_events` for operational history.

Minimum fields:

```text
expense_id
event_type
changed_by
changed_at
summary
before_value
after_value
```

Decision details:

- This is an operational timeline, not a full legal audit system.
- `before_value` and `after_value` use JSONB.
- `changed_by` is nullable for MVP because there is only one internal account.
- Store meaningful product events, not every low-level row mutation.

Initial event types:

```text
expense_created
stage_changed
category_changed
amount_changed
approval_status_changed
execution_status_changed
execution_request_status_changed
evidence_uploaded
evidence_deleted
memo_updated
stage_field_updated
```

Reasoning:

- Expense detail requires visible history.
- JSONB avoids creating many narrow history tables during MVP.

## Decision 14. Dashboard Aggregation Baseline

Decision:

Start dashboard aggregation with views or RPC, not stored aggregate tables.

Required aggregation surfaces:

```text
project KPI summary
category amount summary
kanban stage summary
expense list by category
expense list by stage
```

Reasoning:

- Stored aggregate tables introduce synchronization risk.
- MVP data size is expected to be small enough for direct view/RPC aggregation.

Implementation implication:

- If performance becomes a problem, add materialized views later.
- Do not denormalize dashboard totals into `projects` in the first MVP.

## Decision 15. API And Type Boundary

Decision:

- Generate Supabase `Database` types after migrations are applied.
- Keep DB row types internal to data access layers.
- Expose feature DTOs validated by zod.
- Use Supabase client reads with RLS for simple read flows.
- Use Hono server APIs for writes, file upload coordination, history creation, service-role access,
  and signed URL creation.
- Use React Query for client server-state.

Reasoning:

- Generated DB types protect query correctness.
- DTOs prevent raw DB shape from leaking into UI.
- Writes should be coordinated through the API so related side effects stay consistent.
- Signed URL and evidence upload workflows need server-side control.

## Decision 16. Initial Migration Order

The next phase should create migrations in this order:

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
```

Notes:

- Do not combine all domain tables into one large migration.
- Keep each migration reviewable and reversible in intent.
- Storage bucket setup should be represented as SQL/setup migration where possible.
- If the target Supabase environment cannot create the bucket through SQL, create the private
  `expense-evidence` bucket manually and document the fallback.

## Out Of Scope For MVP

Do not implement these in the first DB setup:

- Multi-user role and permission management.
- Company membership tables.
- Project member tables.
- OCR-based document classification.
- Tax invoice authenticity verification.
- Automatic policy compliance scoring.
- Risk scoring.
- Automatic report generation.
- Custom policy override per project.
- Complex event-sourced audit architecture.
- Stored dashboard aggregate tables.

## Resolved Decisions Before Phase 1

The following decisions are locked for the first MVP database implementation:

1. Simple reads may use the Supabase client with RLS.
2. Writes, upload coordination, history creation, and signed URL creation go through Hono APIs.
3. Every FuManager domain table enables RLS.
4. MVP RLS policies allow authenticated users to access MVP records.
5. Role, member, and permission tables are out of scope.
6. Authenticated root redirect uses the first available project.
7. Expenses require `project_budget_category_id` and also store `category_key`.
8. The private Storage bucket name is `expense-evidence`.
9. Storage bucket creation is attempted through SQL/setup migration and has a documented manual fallback.
10. `file_hash` and `duplicate_group_key` are nullable in MVP.
11. Dashboard aggregation starts with views or RPC, not stored aggregate tables.
12. Expense history stores meaningful operational events, not full audit diffs.
13. Existing starter migration `0001_create_example_table.sql` has been removed from the active migration set.
14. FuManager migrations start at `0002`.

## Phase 1 Readiness Checklist

Before writing the Phase 1 SQL files, verify:

- No migration disables RLS for FuManager domain tables.
- No role, member, project member, or permission table is introduced.
- Money columns use integer won amounts with `bigint`.
- Status and key fields use `text` with check constraints, not PostgreSQL enum types.
- Expenses cannot be saved without a project, project budget category, category key, title,
  valid stage key, and valid non-negative amount values when amounts are present.
- Actual spent dashboard totals use only `execution_request` expenses with `final_amount`.
- Evidence metadata references company, project, and expense for path validation.
- Hono APIs own write workflows that need history events or signed URLs.

## Final Phase 0 Position

The MVP database should optimize for a clean domain spine:

```text
company -> project -> project budget category -> expense -> evidence/history -> dashboard view
```

The first implementation should be secure by default, simple to evolve, and strict only where
data integrity matters. Soft gates, policy guidance, and evidence completeness should guide users
without blocking legitimate operational progress.
## Decision override: Operation Dashboard Slice 1 (2026-06-23)

Migration `0015` supersedes the earlier four-stage/four-amount dashboard decision without modifying migrations `0001`–`0014`.

- Canonical persisted amount: required safe-integer `expenses.amount`.
- Stages: `budget_registration`, `pre_approval`, `execution_in_progress`, `execution_request`, `execution_completed`.
- Spend: active `execution_completed` amounts only. Remaining and ratio are raw, unclamped calculations against `projects.total_project_budget`.
- Category totals are expense-derived; `project_budget_categories.budget_amount` is archived then removed.
- Direct authenticated writes to expenses, project categories, and policy templates are revoked. Database triggers serialize and enforce the project completed-spend cap and budget-reduction invariant.
- The five relational views remain authoritative projections; `get_project_dashboard_snapshot(uuid)` composes one statement-level read-only snapshot.
