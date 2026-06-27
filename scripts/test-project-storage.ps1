$ErrorActionPreference = "Stop"
$env:RUN_PROJECT_STORAGE_INTEGRATION = "1"
& npm.cmd exec dotenv -- -e .env.local -- vitest run src/features/projects/backend/storage.integration.test.ts
exit $LASTEXITCODE
