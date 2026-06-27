"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyPanel, PageHeading } from "@/components/product-shell";
import { routes } from "@/constants/routes";
import { EXPENSE_FUNDING_SOURCE_OPTIONS } from "@/features/domain/contracts";
import { extractApiErrorMessage } from "@/lib/remote/api-client";
import { useToast } from "@/hooks/use-toast";
import { CategoryGroup } from "@/features/dashboard/components/category-group";
import { useExpenseMutations, useProjectExpensesQuery } from "../hooks/use-expenses-query";
import { ExpenseQuickCreateSheet } from "./expense-quick-create-sheet";

export function ExpenseListPageContent({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const query = useProjectExpensesQuery(projectId);
  const { createMutation } = useExpenseMutations(projectId);
  const [open, setOpen] = useState(false);
  const categoryOptions = (query.data?.categoryOptions ?? []) as Array<{
    categoryKey: string;
    categoryName: string;
    sortOrder: number;
  }>;

  const categoryCountText = useMemo(() => {
    if (!query.data) return "";
    return `${query.data.categories.length}개 비목`;
  }, [query.data]);

  return (
    <>
      <PageHeading
        eyebrow="지출 빠른 등록"
        title={query.data?.project.name ?? "지출 빠른 등록"}
        description="비목별 목록을 보면서 지출을 빠르게 등록합니다."
        backHref={routes.project(projectId)}
        actions={
          <Button onClick={() => setOpen(true)} disabled={query.isPending || !query.data}>
            <Plus className="mr-2 size-4" aria-hidden="true" /> 지출 추가
          </Button>
        }
      />
      {query.isPending ? (
        <div className="grid gap-4">
          <div className="h-16 animate-pulse rounded-md bg-muted" />
          <div className="h-40 animate-pulse rounded-md bg-muted" />
        </div>
      ) : query.isError ? (
        <EmptyPanel
          title="지출 목록을 불러오지 못했습니다"
          description={extractApiErrorMessage(query.error, "잠시 후 다시 시도해 주세요.")}
          action={<Button onClick={() => void query.refetch()} variant="outline">다시 시도</Button>}
        />
      ) : (
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">등록 가능한 비목</p>
                <p className="text-lg font-semibold">{query.data.categoryOptions.length}개</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">현재 등록된 비목별 지출</p>
                <p className="text-lg font-semibold">{categoryCountText || "0개 비목"}</p>
              </div>
            </CardContent>
          </Card>

          {query.data.categories.length ? (
            <div className="space-y-4">
              {query.data.categories.map((category) => (
                <CategoryGroup key={category.categoryKey} category={category} projectId={projectId} />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="등록된 지출이 없습니다"
              description="지출을 등록하면 비목별 목록과 금액 합계가 여기에 나타납니다."
            />
          )}
        </div>
      )}

      <ExpenseQuickCreateSheet
        categoryOptions={categoryOptions}
        fundingSourceOptions={EXPENSE_FUNDING_SOURCE_OPTIONS}
        isSubmitting={createMutation.isPending}
        open={open}
        onOpenChange={setOpen}
        onSubmit={async (input) => {
          try {
            await createMutation.mutateAsync(input);
            setOpen(false);
            toast({
              title: "지출이 등록되었습니다.",
              description: "비목별 목록과 대시보드를 다시 불러옵니다.",
            });
          } catch (error) {
            toast({
              title: "지출을 등록하지 못했습니다.",
              description: extractApiErrorMessage(error, "입력값을 확인해 주세요."),
              variant: "destructive",
            });
          }
        }}
      />
    </>
  );
}
