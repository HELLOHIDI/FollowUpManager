import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('server-only', () => ({}));

// Extend Vitest matchers with Testing Library
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});
