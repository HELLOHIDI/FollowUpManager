"use client";

import { useMemo, useState } from "react";
import { Download, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyPanel, PageHeading } from "@/components/product-shell";
import { routes } from "@/constants/routes";
import { EXPENSE_STAGES } from "@/features/domain/contracts";
import { formatWon } from "@/features/dashboard/components/dashboard-kpis";
import { extractApiErrorCode } from "@/lib/remote/api-client";
import type { ProjectExportQuery, ProjectExportResponse } from "../backend/schema";
import { useProjectExportQuery } from "../hooks/use-project-export-query";
import { buildProjectExportCsv } from "../lib/csv";

const downloadCsv = (data: ProjectExportResponse) => {
  const blob = new Blob([buildProjectExportCsv(data)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `${data.project.name}-expenses-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const emptyFilters: ProjectExportQuery = {};
const stageLabelByKey = new Map(EXPENSE_STAGES.map((stage) => [stage.key, stage.label]));

export function ProjectExportPageContent({ projectId }: { projectId: string }) {
  const [filters, setFilters] = useState<ProjectExportQuery>(emptyFilters);
  const query = useProjectExportQuery(projectId, filters);
  const rowCount = query.data?.rows.length ?? 0;
  const totalAmount = useMemo(
    () => query.data?.rows.reduce((total, row) => total + row.amount, 0) ?? 0,
    [query.data],
  );

  const updateFilter = (key: keyof ProjectExportQuery, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }));
  };

  const resetFilters = () => setFilters(emptyFilters);

  if (query.error) {
    const code = extractApiErrorCode(query.error);
    return (
      <EmptyPanel
        title={code === "PROJECT_EXPORT_NOT_FOUND" ? "프로젝트를 찾을 수 없습니다" : "내보내기 데이터를 불러오지 못했습니다"}
        description="필터 값을 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => query.refetch()}>다시 시도</Button>}
      />
    );
  }

  const headingTitle = query.data?.project.name ?? "지출 데이터 내보내기";
  const selectedCategoryName =
    query.data?.categoryOptions.find((category) => category.categoryKey === filters.category)?.categoryName ?? "전체 비목";
  const selectedStageLabel = filters.stage ? stageLabelByKey.get(filters.stage) ?? filters.stage : "전체 단계";

  return (
    <>
      <PageHeading
        eyebrow="내보내기"
        title={headingTitle}
        description="기간, 비목, 단계 필터를 적용해 지출 데이터를 미리 확인하고 CSV로 다운로드합니다."
        backHref={routes.project(projectId)}
        actions={
          <Button disabled={!query.data || rowCount === 0} onClick={() => query.data && downloadCsv(query.data)}>
            <Download className="mr-2 size-4" aria-hidden="true" />
            CSV 다운로드
          </Button>
        }
      />

      <Card className="mb-6 shadow-xs">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">필터</CardTitle>
              <CardDescription>기본값은 전체 기간, 전체 비목, 전체 단계입니다.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="선택된 내보내기 필터">
              <Badge variant="neutral">{filters.from || filters.to ? `${filters.from ?? "시작일 없음"} ~ ${filters.to ?? "종료일 없음"}` : "전체 기간"}</Badge>
              <Badge variant="info">{selectedCategoryName}</Badge>
              <Badge variant="neutral">{selectedStageLabel}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-2 text-sm font-medium">
            시작일
            <Input type="date" value={filters.from ?? ""} onChange={(event) => updateFilter("from", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            종료일
            <Input type="date" value={filters.to ?? ""} onChange={(event) => updateFilter("to", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            비목
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={filters.category ?? ""}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="">전체 비목</option>
              {query.data?.categoryOptions.map((category) => (
                <option key={category.categoryKey} value={category.categoryKey}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            단계
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={filters.stage ?? ""}
              onChange={(event) => updateFilter("stage", event.target.value)}
            >
              <option value="">전체 단계</option>
              {query.data?.stageOptions.map((stage) => (
                <option key={stage.stageKey} value={stage.stageKey}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={resetFilters} className="w-full">
              <RotateCw className="mr-2 size-4" aria-hidden="true" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{query.isPending ? "내보내기 데이터를 불러오는 중입니다." : `${rowCount}건 · ${formatWon(totalAmount)}`}</span>
        {query.isFetching && !query.isPending ? <span>새로고침 중</span> : null}
      </div>

      {!query.data || query.isPending ? (
        <div aria-label="내보내기 미리보기 로딩 중" className="h-64 animate-pulse rounded-md bg-muted" />
      ) : rowCount === 0 ? (
        <EmptyPanel title="미리볼 지출이 없습니다" description="필터를 조정하거나 지출을 등록한 뒤 다시 확인해 주세요." />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">지출명</th>
                <th className="px-3 py-3 font-medium">비목</th>
                <th className="px-3 py-3 font-medium">단계</th>
                <th className="px-3 py-3 text-right font-medium">금액</th>
                <th className="px-3 py-3 font-medium">예상 지출일</th>
                <th className="px-3 py-3 font-medium">거래처</th>
              </tr>
            </thead>
            <tbody>
              {query.data.rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="max-w-64 truncate px-3 py-3 font-medium">{row.title}</td>
                  <td className="px-3 py-3">{row.categoryName}</td>
                  <td className="px-3 py-3">
                    <Badge variant="neutral">{row.stageLabel}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatWon(row.amount)}</td>
                  <td className="px-3 py-3">{row.expectedSpendDate ?? "-"}</td>
                  <td className="px-3 py-3">{row.vendorName ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
