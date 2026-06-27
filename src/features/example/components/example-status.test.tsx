import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExampleStatus } from './example-status';

// Mock the API client
vi.mock('@/lib/remote/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
  extractApiErrorMessage: vi.fn((error, defaultMsg) => defaultMsg),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return Wrapper;
};

describe('ExampleStatus', () => {
  it('should render the component correctly', () => {
    render(<ExampleStatus />, { wrapper: createWrapper() });

    expect(screen.getByText(/백엔드 상태 확인/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/00000000-0000-0000-0000-000000000000/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /조회하기/i })).toBeInTheDocument();
  });

  it('should display idle status initially', () => {
    render(<ExampleStatus />, { wrapper: createWrapper() });

    expect(screen.getByText(/대기/i)).toBeInTheDocument();
    expect(screen.getByText(/UUID를 입력하고 조회하기 버튼을 누르면/i)).toBeInTheDocument();
  });

  it('should update input value when user types', async () => {
    const user = userEvent.setup();
    render(<ExampleStatus />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/00000000-0000-0000-0000-000000000000/i);

    await user.type(input, 'test-id');

    expect(input).toHaveValue('test-id');
  });

  it('should clear results when empty input is submitted', async () => {
    const user = userEvent.setup();
    render(<ExampleStatus />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/00000000-0000-0000-0000-000000000000/i);
    const button = screen.getByRole('button', { name: /조회하기/i });

    // Submit empty input
    await user.type(input, '   ');
    await user.click(button);

    expect(screen.getByText(/대기/i)).toBeInTheDocument();
  });

  it('should show current status header', () => {
    render(<ExampleStatus />, { wrapper: createWrapper() });

    expect(screen.getByText(/현재 상태/i)).toBeInTheDocument();
  });

  it('should have accessible form elements', () => {
    render(<ExampleStatus />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/00000000-0000-0000-0000-000000000000/i);
    const button = screen.getByRole('button', { name: /조회하기/i });

    expect(input).toBeInTheDocument();
    expect(button).toBeInTheDocument();
  });

  it('should display description text', () => {
    render(<ExampleStatus />, { wrapper: createWrapper() });

    expect(screen.getByText(/예시 API/i)).toBeInTheDocument();
    expect(screen.getByText(/Supabase 예시 레코드의 UUID를 입력하면/i)).toBeInTheDocument();
  });
});
