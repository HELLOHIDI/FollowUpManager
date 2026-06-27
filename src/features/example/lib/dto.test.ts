import { describe, it, expect } from 'vitest';
import { ExampleResponseSchema } from './dto';

describe('ExampleResponseSchema', () => {
  it('should validate a correct example response', () => {
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      fullName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'This is a test bio',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = ExampleResponseSchema.safeParse(validData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should allow null bio', () => {
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      fullName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: null,
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = ExampleResponseSchema.safeParse(validData);

    expect(result.success).toBe(true);
  });

  it('should reject invalid data structure', () => {
    const invalidData = {
      id: 123, // should be string
      fullName: 'Test User',
    };

    const result = ExampleResponseSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const invalidData = {
      id: 'test-id',
      // missing fullName, avatarUrl, updatedAt
    };

    const result = ExampleResponseSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
  });
});
