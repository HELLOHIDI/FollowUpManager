-- Migration: create budget category policy templates

create table if not exists public.budget_category_policy_templates (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique
    check (category_key in (
      'material_cost',
      'outsourcing_cost',
      'equipment_software',
      'intangible_asset_ip',
      'labor_cost',
      'service_fee',
      'travel_expense',
      'training_cost',
      'advertising_cost'
    )),
  category_name text not null check (btrim(category_name) <> ''),
  category_description text not null default '',
  usage_scope text not null default '',

  evidence_requirements jsonb not null default '[]'::jsonb,
  caution_notes jsonb not null default '[]'::jsonb,
  restricted_notes jsonb not null default '[]'::jsonb,

  ui_guide_message text not null default '',
  evidence_guide_message text not null default '',
  caution_guide_message text not null default '',

  source_type text not null default 'fumanager_default'
    check (source_type in (
      'integrated_guideline',
      'program_specific_guideline',
      'fumanager_default'
    )),
  source_title text not null default 'FuManager MVP default policy',
  source_version text,

  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budget_category_policy_templates_json_arrays_check
    check (
      jsonb_typeof(evidence_requirements) = 'array'
      and jsonb_typeof(caution_notes) = 'array'
      and jsonb_typeof(restricted_notes) = 'array'
    )
);

create index if not exists budget_category_policy_templates_is_active_idx
  on public.budget_category_policy_templates(is_active);

create trigger budget_category_policy_templates_set_updated_at
before update on public.budget_category_policy_templates
for each row
execute function public.set_updated_at();

alter table public.budget_category_policy_templates enable row level security;

create policy "Authenticated users can read budget category policy templates"
on public.budget_category_policy_templates
for select
to authenticated
using (true);

create policy "Authenticated users can insert budget category policy templates"
on public.budget_category_policy_templates
for insert
to authenticated
with check (true);

create policy "Authenticated users can update budget category policy templates"
on public.budget_category_policy_templates
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete budget category policy templates"
on public.budget_category_policy_templates
for delete
to authenticated
using (true);

insert into public.budget_category_policy_templates (
  category_key,
  category_name,
  category_description,
  usage_scope,
  ui_guide_message,
  evidence_guide_message,
  caution_guide_message
)
values
  ('material_cost', 'Material cost', 'Materials used for the project.', 'Project material purchases.', 'Check whether the material is directly related to the project.', 'Prepare transaction and inspection evidence when applicable.', 'Review project-specific grant rules before execution.'),
  ('outsourcing_cost', 'Outsourcing cost', 'External service or development work.', 'Project execution outsourced to vendors.', 'Check contract scope and deliverables.', 'Prepare contract, transaction proof, and deliverable evidence.', 'Advance payment and related-party transactions may need extra review.'),
  ('equipment_software', 'Equipment and software', 'Equipment, tools, supplies, and software.', 'Equipment or software needed for project execution.', 'Check project relevance and usage purpose.', 'Prepare quote, transaction proof, and inspection evidence.', 'Used goods or high-value purchases may need extra review.'),
  ('intangible_asset_ip', 'Intangible asset and IP', 'Patent, trademark, design, and other IP costs.', 'IP filing, registration, and related services.', 'Check direct relevance to the project.', 'Prepare application, registration, contract, and payment evidence.', 'General legal consulting may need extra review.'),
  ('labor_cost', 'Labor cost', 'Payroll and labor-related expenses.', 'Personnel directly participating in the project.', 'Check project participation and employment basis.', 'Prepare payroll, contract, insurance, and transfer evidence.', 'Eligibility and participation period must be reviewed.'),
  ('service_fee', 'Service fee', 'General service fees and commissions.', 'Professional services, fees, and other service transactions.', 'Check service type and vendor information.', 'Prepare transaction proof and vendor evidence.', 'Ambiguous service types need extra review.'),
  ('travel_expense', 'Travel expense', 'Transportation and travel costs.', 'Business travel for project purposes.', 'Check trip purpose, period, and destination.', 'Prepare receipts, itinerary, and result evidence.', 'Personal travel must be separated.'),
  ('training_cost', 'Training cost', 'Training and education costs.', 'Training needed for project execution.', 'Check training purpose and participant eligibility.', 'Prepare registration, payment, material, and completion evidence.', 'Refunded or unrelated training needs review.'),
  ('advertising_cost', 'Advertising cost', 'Marketing, promotion, and advertising costs.', 'Promotion of project product, service, or company.', 'Check campaign purpose and result evidence.', 'Prepare contract, transaction proof, and campaign result evidence.', 'Giveaways and prepaid campaigns may need extra review.')
on conflict (category_key) do update
set
  category_name = excluded.category_name,
  category_description = excluded.category_description,
  usage_scope = excluded.usage_scope,
  ui_guide_message = excluded.ui_guide_message,
  evidence_guide_message = excluded.evidence_guide_message,
  caution_guide_message = excluded.caution_guide_message,
  updated_at = now();

comment on table public.budget_category_policy_templates is
  'Global default policy guidance for FuManager budget category keys.';
