# FuManager Technical Requirements Document (TRD)
  
## Tech Stack

Next.js 15, Hono.js, Supabase Auth, Supabase PostgreSQL, Supabase Storage, TypeScript, TailwindCSS, shadcn/ui, lucide-react, @tanstack/react-query

## Architecture Policies

- Product scope: FuManager MVP is a government grant expense follow-up dashboard centered on `/projects/:projectId`, with expense detail management at `/projects/:projectId/expenses/:expenseId`.
- Database: Supabase PostgreSQL is the single MVP application database.
- File storage: Supabase Storage is used for receipt, tax invoice, approval document, and other evidence uploads. File URLs exposed to the client should use signed URLs when direct access is needed.
- Authentication: Supabase Auth is used for a single internal account login. Authentication is minimum access control for protecting internal data and is separate from role/permission management.
- Authorization: multi-user role and permission management is excluded from MVP scope.
## Route Protection

- Public route: `/login`.
- Operational route: `/_health` is for health checks and should be access-controlled at the deployment or infrastructure layer when exposed.
- Protected routes: `/projects`, `/projects/:projectId`, `/projects/:projectId/expenses/:expenseId`, `/settings/company`.
- Root route `/` redirects to the last used project dashboard when authenticated. If unauthenticated, it should redirect to `/login`.
- Protected routes should be enforced by `middleware.ts` with Supabase Auth session checks.

## Expense Detail Workbench Contract (2026-07-07)

- Expense procedures are stored in existing `expenses.stage_fields.procedures` for V1. Do not add a procedure table until cross-expense querying, audit evidence, editable definitions, per-procedure permissions, or SQL analytics require it.
- Stage mutation accepts any different canonical expense stage and keeps the current-stage RPC parameter for stale-state protection.
- Same-stage movement is a UI no-op and should not create history.
- Evidence upload/storage APIs remain available, but the expense detail workbench does not render a separate evidence-requirement section; the enterprise forms panel renders all required execution documents for the current expense category and nests matching company templates under each document.
- Project template downloads remain the source for enterprise form child rows; the workbench exposes view/download only.

## Directory Structure


/
├── src/
│   ├── app/                        # Next.js app router
│   │   ├── (protected)/            # protected routes group
│   │   │   ├── projects/           # /projects and /projects/:projectId dashboard pages
│   │   │   │   └── [projectId]/expenses/[expenseId]/ # expense detail full page
│   │   │   └── settings/           # /settings/company pages
│   │   ├── api/                    # API routes (Hono integration)
│   │   ├── login/                  # Supabase Auth login page
│   ├── backend/                    # server-side logic
│   │   ├── config/                 # backend configuration
│   │   ├── hono/                   # Hono app setup
│   │   ├── http/                   # HTTP utilities
│   │   ├── middleware/             # server middleware
│   │   └── supabase/               # supabase server client
│   ├── components/                 # common components
│   │   └── ui/                     # shadcn/ui components
│   ├── features/                   # feature-based modules
│   │   ├── auth/                   # authentication feature
│   │   │   ├── context/            # auth contexts
│   │   │   ├── hooks/              # auth hooks
│   │   │   ├── server/             # auth server logic
│   │   │   └── types.ts            # auth types
│   │   └── [featureName]/          # company implemented; future modules: projects, budget-categories, expenses, policies, dashboard
│   │       ├── backend/            # backend logic
│   │       ├── components/         # feature components
│   │       ├── pages/              # feature pages
│   │       ├── constants.ts        # feature constants
│   │       ├── types.ts            # feature types
│   │       ├── utils.ts            # feature utils
│   │       ├── hooks/              # feature hooks
│   │       └── lib/                # feature utilities
│   ├── constants/                  # global constants
│   ├── hooks/                      # common hooks
│   └── lib/                        # utilities
│       ├── remote/                 # API client
│       ├── supabase/               # supabase client setup
│       └── utils.ts                # shadcn cn utility
├── public/                         # static assets
└── supabase/migrations/            # supabase migrations

  
