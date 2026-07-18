# UI Preservation Policy

- Production UI is the baseline for existing routes.
- New features may change only their approved route or local entry point.
- `npm run check:ui-baseline` is required before every Preview deployment.
- The check protects the global FAQ/Discord header, team-filtered project list, and prevents the legacy header or embedded project FAQ from returning.
- If the check fails, restore the production structure before deploying.
