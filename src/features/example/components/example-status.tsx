'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useExampleQuery } from '@/features/example/hooks/useExampleQuery';

const statusBadge = (
  label: string,
  tone: 'success' | 'error' | 'idle',
) => {
  const toneVariants: Record<typeof tone, 'success' | 'destructive' | 'neutral'> = {
    success: 'success',
    error: 'destructive',
    idle: 'neutral',
  };

  return <Badge variant={toneVariants[tone]}>{label}</Badge>;
};

export const ExampleStatus = () => {
  const [inputValue, setInputValue] = useState('');
  const [exampleId, setExampleId] = useState('');
  const query = useExampleQuery(exampleId);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();

    if (!trimmed) {
      setExampleId('');
      return;
    }

    if (trimmed === exampleId) {
      void query.refetch();
      return;
    }

    setExampleId(trimmed);
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">개발 점검</p>
        <h1 className="text-2xl font-semibold tracking-normal">백엔드 상태 확인</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          예시 API(`/api/example/:id`)가 정상 동작하는지 확인합니다. Supabase 예시
          레코드의 UUID를 입력하면 React Query를 통해 백엔드 응답을 확인할 수
          있습니다.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-md border bg-card p-4 shadow-xs md:flex-row md:items-center"
      >
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium">
            예시 UUID
          </label>
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </div>
        <Button
          type="submit"
          className="mt-2 md:mt-6"
        >
          조회하기
        </Button>
      </form>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>현재 상태</CardTitle>
            <CardDescription>입력한 UUID의 백엔드 응답을 확인합니다.</CardDescription>
          </div>
          <div className="shrink-0">
            {exampleId
              ? query.status === 'pending'
                ? statusBadge('조회 중', 'idle')
                : query.status === 'error'
                  ? statusBadge('오류', 'error')
                  : statusBadge('성공', 'success')
              : statusBadge('대기', 'idle')}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">

        {!exampleId && (
          <p className="text-sm text-muted-foreground">
            UUID를 입력하고 조회하기 버튼을 누르면 결과가 이곳에 표시됩니다.
          </p>
        )}

        {exampleId && query.status === 'pending' && (
          <p className="text-sm text-muted-foreground">Supabase에서 데이터를 가져오는 중...</p>
        )}

        {query.status === 'error' && (
          <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">요청 실패</p>
            <p className="text-xs text-muted-foreground">
              {query.error instanceof Error
                ? query.error.message
                : '알 수 없는 에러가 발생했습니다.'}
            </p>
          </div>
        )}

        {query.data && (
          <div className="space-y-3 rounded-md border border-success/30 bg-success/5 p-4 text-sm">
            <div>
              <p className="text-xs font-medium text-success">ID</p>
              <p className="font-mono text-xs md:text-sm">{query.data.id}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-success">
                이름
              </p>
              <p>{query.data.fullName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-success">
                소개
              </p>
              <p>{query.data.bio ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-success">
                아바타
              </p>
              <a
                href={query.data.avatarUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {query.data.avatarUrl}
              </a>
            </div>
            <div>
              <p className="text-xs font-medium text-success">
                업데이트 시각
              </p>
              <p>{query.data.updatedAt}</p>
            </div>
          </div>
        )}
        </CardContent>
      </Card>
    </section>
  );
};
