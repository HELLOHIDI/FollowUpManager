# Testing Guidelines

> **Purpose**: This document provides testing guidelines for the supernext project template, designed to help AI coding agents and developers write effective, maintainable tests.

---

## Core Testing Philosophy

### Focus on Behavior, Not Implementation

**Golden Rule**: Tests should verify **user-observable behavior**, not **implementation details**.

This approach ensures:
- ✅ Tests survive refactoring without breaking
- ✅ Tests provide real value by catching actual bugs
- ✅ Tests serve as reliable documentation of expected behavior

**❌ Anti-Pattern: Testing Implementation Details**
```typescript
// DON'T: Testing internal state or implementation
expect(component.state.isLoading).toBe(true);
expect(mockFunction).toHaveBeenCalledWith(specificInternalArg);
```

**✅ Best Practice: Testing User-Observable Behavior**
```typescript
// DO: Test what users see and experience
expect(screen.getByText(/loading/i)).toBeInTheDocument();
expect(await screen.findByRole('button', { name: /submit/i })).toBeEnabled();
```

### Testing Library Principles

Follow these accessibility-first querying strategies:

1. **Query by what users see**: Use `getByRole`, `getByLabelText`, `getByPlaceholderText` first
2. **Avoid test IDs**: Only use `data-testid` as a last resort when no semantic alternative exists
3. **Enforce accessibility**: Let your tests naturally validate that your UI is accessible

**Query Priority (from best to worst)**:
```typescript
// 1. Accessible to everyone (best)
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email address/i)

// 2. Semantic queries
screen.getByPlaceholderText(/enter email/i)
screen.getByText(/welcome/i)

// 3. Test IDs (last resort)
screen.getByTestId('submit-button')
```

---

## Unit Testing with Vitest

### Purpose
Validate the logic of individual functions, hooks, and utilities in isolation.

### File Organization
Place test files next to the code they test using the `*.test.ts` or `*.test.tsx` pattern:

```
src/
  features/
    example/
      hooks/
        useExampleQuery.ts
        useExampleQuery.test.ts  # ✅ Collocated with source
      lib/
        dto.ts
        dto.test.ts              # ✅ Easy to find and maintain
```

### Testing Patterns

#### Pattern 1: Pure Function Testing
```typescript
import { describe, it, expect } from 'vitest';
import { formatUserName } from './user-utils';

describe('formatUserName', () => {
  it('should format name correctly', () => {
    expect(formatUserName('John', 'Doe')).toBe('John Doe');
  });

  it('should handle empty last name', () => {
    expect(formatUserName('John', '')).toBe('John');
  });

  it('should handle null values gracefully', () => {
    expect(formatUserName(null, null)).toBe('');
  });
});
```

#### Pattern 2: React Hook Testing
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useExampleQuery } from './useExampleQuery';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return Wrapper;
};

describe('useExampleQuery', () => {
  it('should fetch data successfully', async () => {
    const { result } = renderHook(() => useExampleQuery('test-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useExampleQuery('invalid-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
```

#### Pattern 3: React Component Testing
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExampleComponent } from './example-component';

describe('ExampleComponent', () => {
  it('should display user name', () => {
    render(<ExampleComponent name="John Doe" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should handle button click interaction', async () => {
    const user = userEvent.setup();
    render(<ExampleComponent />);

    const button = screen.getByRole('button', { name: /submit/i });
    await user.click(button);

    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it('should validate form input', async () => {
    const user = userEvent.setup();
    render(<ExampleComponent />);

    const input = screen.getByLabelText(/email/i);
    await user.type(input, 'invalid-email');

    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
  });
});
```

### Commands
```bash
npm run test              # Run all unit tests
npm run test:watch        # Watch mode for development
npm run test:ui           # Visual UI mode
npm run test:coverage     # Generate coverage report
```

---

## E2E Testing with Playwright

### Purpose
Validate complete user workflows in a real browser environment. Test API communication, routing, and full user journeys.

### File Organization
Place E2E tests in the `e2e/` directory at project root:

```
e2e/
  example.spec.ts      # Example feature tests
  auth.spec.ts         # Authentication flow tests
  checkout.spec.ts     # Checkout process tests
```

### Testing Patterns

```typescript
import { test, expect } from '@playwright/test';

test.describe('Example Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/example');
  });

  test('should complete successful data retrieval flow', async ({ page }) => {
    // Arrange: Set up the test scenario
    const input = page.getByPlaceholder(/00000000-0000-0000-0000-000000000000/i);
    const submitButton = page.getByRole('button', { name: /submit/i });

    // Act: Perform user actions
    await input.fill('123e4567-e89b-12d3-a456-426614174000');
    await submitButton.click();

    // Assert: Verify expected outcomes
    await expect(page.getByText('Success')).toBeVisible();
    await expect(page.getByText(/ID/i)).toBeVisible();
    await expect(page.getByText(/Name/i)).toBeVisible();
  });

  test('should display error for invalid input', async ({ page }) => {
    // Test error handling
    await page.getByPlaceholder(/00000000-0000-0000-0000-000000000000/i)
      .fill('invalid-id');
    await page.getByRole('button', { name: /submit/i }).click();

    await expect(page.getByText(/request failed/i)).toBeVisible();
  });

  test('should handle loading states correctly', async ({ page }) => {
    // Test async behavior
    const input = page.getByPlaceholder(/00000000-0000-0000-0000-000000000000/i);
    await input.fill('123e4567-e89b-12d3-a456-426614174000');

    const submitButton = page.getByRole('button', { name: /submit/i });
    await submitButton.click();

    // Verify loading state appears
    await expect(page.getByText(/loading/i).or(page.getByText(/fetching/i)))
      .toBeVisible({ timeout: 1000 });
  });
});
```

### Commands
```bash
npm run test:e2e           # Run E2E tests (headless)
npm run test:e2e:watch     # Interactive UI mode
npm run test:e2e:headed    # Run with visible browser
```

---

## Testing Checklist for AI Agents

### Unit Test Checklist
When writing or reviewing unit tests, verify:

- [ ] **Core logic coverage**: Does the test validate the function's primary purpose?
- [ ] **Edge cases**: Are boundary conditions tested (empty values, null, undefined, extreme inputs)?
- [ ] **Dependencies**: Are external dependencies properly mocked or isolated?
- [ ] **Behavior focus**: Does the test verify behavior, not implementation details?
- [ ] **Naming clarity**: Is the test name descriptive and intention-revealing?

### E2E Test Checklist
When writing or reviewing E2E tests, verify:

- [ ] **User scenarios**: Does the test reflect realistic user workflows?
- [ ] **Success & failure paths**: Are both happy paths and error cases covered?
- [ ] **Async handling**: Are page loads and async operations properly awaited?
- [ ] **Accessible selectors**: Do queries use semantic selectors (role, label) over test IDs?
- [ ] **Test isolation**: Can this test run independently without relying on other tests?

---

## Best Practices

### 1. Test Independence
**Rule**: Each test must be completely isolated from others.

```typescript
// ❌ DON'T: Tests depending on execution order
describe('User flow', () => {
  let userId;

  it('creates user', () => {
    userId = createUser(); // Side effect affects next test
  });

  it('updates user', () => {
    updateUser(userId); // Depends on previous test
  });
});

// ✅ DO: Self-contained tests
describe('User flow', () => {
  it('creates user successfully', () => {
    const userId = createUser();
    expect(userId).toBeDefined();
  });

  it('updates existing user', () => {
    const userId = createUser(); // Own setup
    const result = updateUser(userId);
    expect(result.success).toBe(true);
  });
});
```

### 2. AAA Pattern (Arrange-Act-Assert)
Structure tests with clear phases:

```typescript
it('should calculate total price with discount', () => {
  // Arrange: Set up test data and conditions
  const items = [
    { price: 100, quantity: 2 },
    { price: 50, quantity: 1 }
  ];
  const discountRate = 0.1;

  // Act: Execute the function being tested
  const total = calculateTotal(items, discountRate);

  // Assert: Verify the expected outcome
  expect(total).toBe(225); // (200 + 50) * 0.9
});
```

### 3. Descriptive Test Names
**Pattern**: `should [expected behavior] when [condition]`

```typescript
// ❌ Bad: Vague, unhelpful names
it('test 1', () => { ... });
it('works', () => { ... });
it('returns value', () => { ... });

// ✅ Good: Clear, intention-revealing names
it('should return 404 when user is not found', () => { ... });
it('should disable submit button when form is invalid', () => { ... });
it('should display error message when API call fails', () => { ... });
```

### 4. Test Isolation & Cleanup
Ensure tests clean up after themselves (automatically handled in `vitest.setup.ts`):

```typescript
// vitest.setup.ts
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup(); // Automatically unmount React components
});
```

### 5. Prevent Flaky Tests

**E2E Flakiness Prevention**:
```typescript
// ❌ DON'T: Hard-coded waits
await page.waitForTimeout(3000); // Brittle, slow

// ✅ DO: Conditional waiting
await expect(page.getByText('Loaded')).toBeVisible(); // Wait for condition

// ❌ DON'T: Timing-dependent assertions
expect(isLoading).toBe(true); // May already be false

// ✅ DO: State-based assertions
await expect(page.getByRole('progressbar')).toBeVisible();
```

**Unit Test Flakiness Prevention**:
```typescript
// ❌ DON'T: Depend on execution order
describe('API', () => {
  let cache = {};

  it('test 1', () => { cache.data = 'value'; }); // Modifies shared state
  it('test 2', () => { expect(cache.data).toBe('value'); }); // Depends on test 1
});

// ✅ DO: Use fresh state for each test
describe('API', () => {
  it('caches data correctly', () => {
    const cache = {};
    cache.data = 'value';
    expect(cache.data).toBe('value');
  });
});
```

### 6. Coverage vs. Quality
**Principle**: Prioritize test quality over coverage percentage.

- ❌ Don't aim for 100% coverage by testing trivial code
- ✅ Focus on critical business logic and user workflows
- ✅ Test edge cases and error paths for important features
- ✅ Ensure high-value features have comprehensive test coverage

---

## Anti-Patterns to Avoid

### ❌ Testing Implementation Details
```typescript
// DON'T: Coupling tests to internal structure
expect(component.state.count).toBe(5);
expect(mockFunction).toHaveBeenCalledTimes(3);

// DO: Test observable behavior
expect(screen.getByText('Count: 5')).toBeInTheDocument();
```

### ❌ Over-Mocking
```typescript
// DON'T: Mock everything unnecessarily
vi.mock('./utils'); // Mocking internal utilities
vi.mock('react'); // Mocking framework code

// DO: Only mock external dependencies
vi.mock('@/lib/api-client'); // External API calls
```

### ❌ Testing Multiple Concerns in One Test
```typescript
// DON'T: Test too many things at once
it('should handle everything', () => {
  // Tests rendering, clicking, validation, API calls, navigation...
});

// DO: One test, one concern
it('should display validation error when email is invalid', () => {
  // Only tests validation
});
```

---

## Resources for AI Agents

When implementing tests, refer to these authoritative sources:

- **[Vitest Documentation](https://vitest.dev/)** - Official Vitest testing framework guide
- **[Playwright Documentation](https://playwright.dev/)** - Official Playwright E2E testing guide
- **[Testing Library Principles](https://testing-library.com/docs/guiding-principles/)** - Core philosophy and best practices
- **[Testing Library Query Priority](https://testing-library.com/docs/queries/about/#priority)** - Recommended query methods hierarchy

---

## Quick Reference for AI Agents

### When to Write Unit Tests
- ✅ Pure functions with complex logic
- ✅ Custom React hooks
- ✅ Utility functions and helpers
- ✅ Data transformation and validation logic
- ✅ Complex component behavior

### When to Write E2E Tests
- ✅ Critical user flows (authentication, checkout, etc.)
- ✅ Multi-step processes
- ✅ Features involving API integration
- ✅ Navigation and routing scenarios
- ✅ Error handling and recovery flows

### Test Writing Template

```typescript
// Unit Test Template
describe('[ComponentName/FunctionName]', () => {
  it('should [expected behavior] when [condition]', () => {
    // Arrange
    const input = setupTestData();

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});

// E2E Test Template
test.describe('[Feature Name]', () => {
  test('should [complete user action] successfully', async ({ page }) => {
    // Arrange
    await page.goto('/feature-path');

    // Act
    await page.getByRole('button', { name: /action/i }).click();

    // Assert
    await expect(page.getByText(/success/i)).toBeVisible();
  });
});
```

---

**Remember**: Good tests are an investment in maintainability. Write tests that provide confidence, not just coverage.
