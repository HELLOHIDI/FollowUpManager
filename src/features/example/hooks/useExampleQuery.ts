'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import { ExampleResponseSchema } from '@/features/example/lib/dto';

const fetchExample = async (id: string) => {
  try {
    const { data } = await apiClient.get(`/api/example/${id}`);
    return ExampleResponseSchema.parse(data);
  } catch (error) {
    const message = extractApiErrorMessage(error, '예시 데이터를 불러오지 못했습니다.');
    throw new Error(message);
  }
};

export const useExampleQuery = (id: string) =>
  useQuery({
    queryKey: ['example', id],
    queryFn: () => fetchExample(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
