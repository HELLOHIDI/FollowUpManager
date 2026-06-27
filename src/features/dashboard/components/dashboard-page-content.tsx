"use client";

import { Button } from "@/components/ui/button";
import { EmptyPanel, PageHeading } from "@/components/product-shell";
import { extractApiErrorCode } from "@/lib/remote/api-client";
import { useDashboardQuery } from "../hooks/use-dashboard-query";
import { CategoryExpenseList } from "./category-expense-list";
import { DashboardKanbanBoard } from "./dashboard-kanban-board";
import { DashboardKpis } from "./dashboard-kpis";

function DashboardLoading() {
  return (
    <div aria-label="대시보드 로딩 중" className="space-y-6">
      <div className="h-24 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-36 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

function DashboardLocalNavPills() {
  const items = [
    ["#overview", "개요"],
    ["#categories", "비목별 지출"],
    ["#kanban", "지출 칸반"],
  ] as const;

  return (
    <nav data-testid="local-nav" aria-label="프로젝트 대시보드 섹션" className="sticky top-0 z-20 -mx-4 mb-6 overflow-x-auto border-y bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-3">
      <div className="flex min-w-max gap-2">
        {items.map(([href, label]) => (
          <a key={href} href={href} className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function DashboardPageContent({ projectId }: { projectId: string }) {
  const query = useDashboardQuery(projectId);

  if (query.isPending && !query.data) return <DashboardLoading />;

  if (query.error) {
    const code = extractApiErrorCode(query.error);

    if (code === "DASHBOARD_PROJECT_NOT_FOUND") {
      return <EmptyPanel title="프로젝트를 찾을 수 없습니다" description="프로젝트가 삭제되었거나 주소가 올바르지 않습니다." />;
    }

    if (code === "DASHBOARD_INTEGRITY_ERROR") {
      return (
        <EmptyPanel
          title="대시보드 데이터 확인이 필요합니다"
          description="예산, 지출, 비목 데이터가 서로 맞는지 확인한 뒤 다시 시도해 주세요."
          action={<Button onClick={() => query.refetch()}>다시 시도</Button>}
        />
      );
    }

    return (
      <EmptyPanel
        title="대시보드를 불러오지 못했습니다"
        description="잠시 후 다시 시도해 주세요."
        action={<Button onClick={() => query.refetch()}>다시 시도</Button>}
      />
    );
  }

  if (!query.data) return null;

  return (
    <>
      <PageHeading eyebrow="프로젝트 대시보드" title={query.data.project.name} description="예산 진행률과 비목별 지출, 단계별 집행 현황을 확인합니다." />
      <DashboardLocalNavPills />
      <section id="overview" className="scroll-mt-24 space-y-4" aria-labelledby="overview-title">
        <h2 id="overview-title" className="text-xl font-semibold">개요</h2>
        <DashboardKpis kpis={query.data.kpis} />
      </section>
      <section id="categories" className="mt-10 scroll-mt-24 space-y-4" aria-labelledby="categories-title">
        <div>
          <h2 id="categories-title" className="text-xl font-semibold">비목별 지출</h2>
          <p className="mt-1 text-sm text-muted-foreground">활성 지출이 있는 비목만 표시합니다.</p>
        </div>
        <CategoryExpenseList categories={query.data.categories} projectId={projectId} />
      </section>
      <section id="kanban" className="mt-10 scroll-mt-24 space-y-4" aria-labelledby="kanban-title">
        <div>
          <h2 id="kanban-title" className="text-xl font-semibold">지출 칸반</h2>
          <p className="mt-1 text-sm text-muted-foreground">카드를 드래그하거나 카드 액션을 사용해 한 단계씩 앞으로 이동합니다.</p>
        </div>
        <DashboardKanbanBoard dashboard={query.data} projectId={projectId} />
      </section>
    </>
  );
}
