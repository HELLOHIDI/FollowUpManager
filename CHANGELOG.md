# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2025-10-07

### Added
- **Environment Variable Validation**: Added `npm run env:check` command to validate `.env.local` configuration
  - Uses zod schemas from `src/constants/env.ts` for validation
  - Checks all required Supabase environment variables
  - Provides clear error messages for missing or invalid variables
- `dotenv-cli` and `tsx` dependencies for environment validation
- `scripts/check-env.ts` - Environment validation script
- `scripts/test-env-check.sh` - Automated acceptance test suite (4 test scenarios)
- Environment validation documentation in `.ruler/AGENTS.md`

### Changed
- Updated AGENTS.md "Must" section to include env:check requirement before development

### Testing
- ✅ All 4 acceptance test scenarios passing
- ✅ Validates missing variables
- ✅ Validates invalid URL formats
- ✅ Handles missing .env.local file

---

## [0.1.2] - 2025-10-07

### Added
- **Concurrent Test Execution**: Added `npm run test:all` command to run unit and E2E tests in parallel
- `npm-run-all` package for parallel test execution
- Test command documentation in `.ruler/AGENTS.md`

### Changed
- Updated AGENTS.md with detailed testing guidelines including TDD process and test commands

---

## [0.1.1] - 2025-10-07

### Added
- **Testing Infrastructure**: Complete Playwright E2E and Vitest unit testing setup
  - Playwright configuration with chromium browser support
  - Vitest configuration with React Testing Library integration
  - Happy-dom test environment for optimal performance
  - Test commands: `test`, `test:watch`, `test:ui`, `test:coverage`, `test:e2e`, `test:e2e:watch`, `test:e2e:headed`
  - TypeScript type checking command: `typecheck`

- **Test Examples**: Working test suite for example feature
  - 7 E2E tests covering user workflows and interactions
  - 11 unit tests for components and data validation
  - Example patterns for pure functions, React hooks, and component testing

- **Testing Guidelines**: Comprehensive documentation in `.ruler/test.md`
  - AI agent-friendly testing guidelines with clear patterns and anti-patterns
  - Focus on behavior-driven testing to prevent implementation overfitting
  - Testing Library best practices with accessibility-first approach
  - Quick reference templates for unit and E2E tests

- **Configuration Files**:
  - `playwright.config.ts` - E2E testing configuration
  - `vitest.config.ts` - Unit testing configuration
  - `vitest.setup.ts` - Testing Library matchers and cleanup
  - `vitest.d.ts` - TypeScript definitions for test matchers
  - `.env.example` - Environment variable template
  - `.env.test` - Test environment configuration

- **Test Dependencies**:
  - `@playwright/test` - E2E testing framework
  - `vitest`, `@vitest/ui`, `@vitest/coverage-v8` - Unit testing
  - `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` - React testing utilities
  - `happy-dom` - Lightweight DOM environment

### Changed
- Updated `.gitignore` to exclude test artifacts (`playwright-report`, `test-results`)
- Added `type: "module"` to `package.json` for ESM support

### Testing
- ✅ All unit tests passing (11/11)
- ✅ All E2E tests passing (7/7)
- ✅ TypeScript type checking passing
- ✅ ESLint validation passing
- ✅ Production build successful

---

## [0.1.0] - Initial Release

Initial supernext template with Next.js 15, TypeScript, Supabase, and Hono.
