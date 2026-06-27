"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EXPENSE_STAGES } from "@/features/domain/contracts";
import { cn } from "@/lib/utils";
import type { DashboardResponse } from "../backend/schema";
import { formatWon } from "./dashboard-kpis";
import { ExpenseChildRow } from "./expense-child-row";

export function CategoryGroup({
  category,
  projectId,
}: {
  category: DashboardResponse["categories"][number];
  projectId: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  const stageSummary = useMemo(
    () =>
      EXPENSE_STAGES.map((stage) => {
        const count = category.expenses.filter((expense) => expense.stageKey === stage.key).length;
        return count > 0 ? { ...stage, count } : null;
      }).filter((stage): stage is (typeof EXPENSE_STAGES)[number] & { count: number } => Boolean(stage)),
    [category.expenses],
  );

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-xs" aria-labelledby={`category-${category.categoryKey}`}>
      <header className="border-l-4 border-l-primary bg-card px-4 py-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`category-${category.categoryKey}`} className="font-semibold">
                {category.categoryName}
              </h3>
              <Badge variant="info">{category.expenseCount}건</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${category.categoryName} 단계 요약`}>
              {stageSummary.length > 0 ? (
                stageSummary.map((stage) => (
                  <Badge key={stage.key} variant="neutral">
                    {stage.label} {stage.count}건
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">단계 요약 없음</span>
              )}
            </div>
          </div>

          <p className="text-right text-lg font-semibold tabular-nums" aria-label={`${category.categoryName} 합계 ${formatWon(category.totalAmount)}`}>
            {formatWon(category.totalAmount)}
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            onClick={() => setIsExpanded((current) => !current)}
          >
            <ChevronDown className={cn("mr-2 size-4 transition-transform", isExpanded && "rotate-180")} aria-hidden="true" />
            {isExpanded ? "지출 접기" : "지출 펼치기"}
          </Button>
        </div>
      </header>

      {isExpanded ? (
        <ul id={contentId}>
          {category.expenses.map((expense) => (
            <ExpenseChildRow key={expense.id} expense={expense} projectId={projectId} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
