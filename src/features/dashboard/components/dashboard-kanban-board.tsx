"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { isDifferentExpenseStage, type ExpenseStageKey } from "@/features/domain/contracts";
import { useExpenseDetailPrefetch, useExpenseStageMutation } from "@/features/expenses/hooks/use-expenses-query";
import type { DashboardResponse } from "../backend/schema";
import {
  selectDashboardKanbanColumns,
  type DashboardKanbanColumn,
  type DashboardKanbanExpense,
} from "../lib/kanban";
import { formatWon } from "./dashboard-kpis";

type DragPayload = {
  expenseId: string;
  stageKey: ExpenseStageKey;
};

const stageAccentClass: Record<ExpenseStageKey, string> = {
  budget_registration: "border-t-primary",
  pre_approval: "border-t-info",
  execution_in_progress: "border-t-warning",
  execution_request: "border-t-orange-500",
  execution_completed: "border-t-success",
};

const moveExpenseBetweenColumns = (
  columns: DashboardKanbanColumn[],
  expenseId: string,
  targetStageKey: ExpenseStageKey,
) => {
  let movingExpense: DashboardKanbanExpense | null = null;

  const withoutMovingExpense = columns.map((column) => {
    const expenses = column.expenses.filter((expense) => {
      if (expense.id !== expenseId) return true;
      movingExpense = expense;
      return false;
    });

    return {
      ...column,
      expenses,
      expenseCount: expenses.length,
      totalAmount: expenses.reduce((total, expense) => total + expense.amount, 0),
    };
  });

  if (!movingExpense) return columns;

  return withoutMovingExpense.map((column) => {
    const expenses =
      column.stageKey === targetStageKey
        ? [...column.expenses, { ...movingExpense, stageKey: targetStageKey }]
        : column.expenses;

    return {
      ...column,
      expenses,
      expenseCount: expenses.length,
      totalAmount: expenses.reduce((total, expense) => total + expense.amount, 0),
    };
  });
};

export function DashboardKanbanBoard({
  dashboard,
  projectId,
}: {
  dashboard: DashboardResponse;
  projectId: string;
}) {
  const derivedColumns = useMemo(() => selectDashboardKanbanColumns(dashboard), [dashboard]);
  const [columns, setColumns] = useState(derivedColumns);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [activeDragPayload, setActiveDragPayload] = useState<DragPayload | null>(null);
  const prefetchExpenseDetail = useExpenseDetailPrefetch(projectId);
  const stageMutation = useExpenseStageMutation(projectId);

  useEffect(() => {
    setColumns(derivedColumns);
  }, [derivedColumns]);

  const requestMove = (expenseId: string, currentStageKey: ExpenseStageKey, targetStageKey: ExpenseStageKey) => {
    if (!isDifferentExpenseStage(currentStageKey, targetStageKey)) return;

    const previousColumns = columns;
    setBoardError(null);
    setColumns((currentColumns) => moveExpenseBetweenColumns(currentColumns, expenseId, targetStageKey));
    stageMutation.mutate(
      { expenseId, input: { targetStageKey } },
      {
        onError: () => {
          setColumns(previousColumns);
          setBoardError("지출 단계를 변경하지 못했습니다. 다시 시도해 주세요.");
        },
      },
    );
  };

  const readDragPayload = (event: DragEvent<HTMLElement>): DragPayload | null => {
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return null;

    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-3">
      {boardError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {boardError}
        </p>
      ) : null}

      <div className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3" aria-label="지출 칸반 보드">
        {columns.map((column) => (
          <section
            key={column.stageKey}
            data-testid={`kanban-column-${column.stageKey}`}
            className={`min-h-80 rounded-md border border-t-4 bg-muted/35 ${stageAccentClass[column.stageKey]}`}
            aria-labelledby={`kanban-column-${column.stageKey}`}
            onDragOver={(event) => {
              if (activeDragPayload && isDifferentExpenseStage(activeDragPayload.stageKey, column.stageKey)) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              const payload = readDragPayload(event) ?? activeDragPayload;
              setActiveDragPayload(null);
              if (!payload) return;
              event.preventDefault();
              requestMove(payload.expenseId, payload.stageKey, column.stageKey);
            }}
          >
            <header className="border-b bg-card px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <h3 id={`kanban-column-${column.stageKey}`} className="text-sm font-semibold">
                  {column.label}
                </h3>
                <Badge variant={column.stageKey === "execution_completed" ? "success" : "neutral"}>
                  {column.expenseCount}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatWon(column.totalAmount)}</p>
            </header>

            <ul className="space-y-2 p-2">
              {column.expenses.length === 0 ? (
                <li className="rounded-md border border-dashed bg-card/70 p-3 text-xs text-muted-foreground">
                  이 단계의 지출이 없습니다.
                </li>
              ) : null}

              {column.expenses.map((expense) => (
                <li
                  key={expense.id}
                  draggable={!stageMutation.isPending}
                  onDragStart={(event) => {
                    const payload = { expenseId: expense.id, stageKey: column.stageKey } satisfies DragPayload;
                    setActiveDragPayload(payload);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("application/json", JSON.stringify(payload));
                  }}
                  onDragEnd={() => setActiveDragPayload(null)}
                  className="rounded-md border bg-card p-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/projects/${projectId}/expenses/${expense.id}`}
                      className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onFocus={() => void prefetchExpenseDetail(expense.id)}
                      onMouseEnter={() => void prefetchExpenseDetail(expense.id)}
                    >
                      <span className="block truncate text-sm font-medium">{expense.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{expense.categoryName}</span>
                    </Link>
                    <span className="text-sm font-semibold tabular-nums">{formatWon(expense.amount)}</span>
                  </div>
                  {typeof expense.evidenceRequiredCount === "number" && expense.evidenceRequiredCount > 0 ? (
                    <Badge className="mt-3" variant={expense.evidenceUploadedCount === expense.evidenceRequiredCount ? "success" : "neutral"}>
                      증빙 {expense.evidenceUploadedCount ?? 0}/{expense.evidenceRequiredCount}
                    </Badge>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <select
                      aria-label={`${expense.title} 단계 이동`}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      disabled={stageMutation.isPending}
                      value={column.stageKey}
                      onChange={(event) => requestMove(expense.id, column.stageKey, event.currentTarget.value as ExpenseStageKey)}
                    >
                      {columns.map((targetColumn) => (
                        <option
                          key={targetColumn.stageKey}
                          disabled={targetColumn.stageKey === column.stageKey}
                          value={targetColumn.stageKey}
                        >
                          {targetColumn.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
              {column.stageKey === "budget_registration" ? (
                <li className="pt-1">
                  <Button asChild className="w-full justify-center" variant="outline">
                    <Link href={routes.projectExpenses(projectId)}>
                      <Plus className="mr-2 size-4" aria-hidden="true" />
                      지출 등록
                    </Link>
                  </Button>
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
