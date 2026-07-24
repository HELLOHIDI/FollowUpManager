"use client";

import { Button } from "@/components/ui/button";
import { EmptyPanel, PageHeading } from "@/components/product-shell";
import { routes } from "@/constants/routes";
import { extractApiErrorCode } from "@/lib/remote/api-client";
import { useDashboardQuery } from "../hooks/use-dashboard-query";
import { CategoryExpenseList } from "./category-expense-list";
import { DashboardKanbanBoard } from "./dashboard-kanban-board";
import { DashboardKpis } from "./dashboard-kpis";
import { ProjectSchedulePreview } from "@/features/project-schedules/components/project-schedule-preview";

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
      <PageHeading backHref={routes.projects} eyebrow="프로젝트 대시보드" title={query.data.project.name} description="예산 진행률과 비목별 지출, 단계별 집행 현황을 확인합니다." />
      <section id="overview" className="scroll-mt-24 space-y-4" aria-labelledby="overview-title">
        <h2 id="overview-title" className="text-xl font-semibold">개요</h2>
        <DashboardKpis kpis={query.data.kpis} />
      </section>
      <ProjectSchedulePreview projectId={projectId} />
      <section id="categories" className="mt-10 scroll-mt-24 space-y-4" aria-labelledby="categories-title">
        <div>
          <h2 id="categories-title" className="text-xl font-semibold">비목별 지출</h2>
        </div>
        <CategoryExpenseList categories={query.data.categories} projectId={projectId} />
      </section>
      <section id="kanban" className="mt-10 scroll-mt-24 space-y-4" aria-labelledby="kanban-title">
        <div>
          <h2 id="kanban-title" className="text-xl font-semibold">지출 칸반</h2>
        </div>
        <DashboardKanbanBoard dashboard={query.data} projectId={projectId} />
      </section>
    </>
  );
}
