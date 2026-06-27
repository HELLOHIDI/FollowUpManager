import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EXPENSE_STAGES } from "@/features/domain/contracts";
import type { DashboardResponse } from "../backend/schema";
import { formatWon } from "./dashboard-kpis";

const stageLabels = new Map(EXPENSE_STAGES.map((stage) => [stage.key, stage.label]));

export function ExpenseChildRow({
  expense,
  projectId,
}: {
  expense: DashboardResponse["categories"][number]["expenses"][number];
  projectId: string;
}) {
  const stageLabel = stageLabels.get(expense.stageKey) ?? expense.stageKey;

  return (
    <li>
      <Link
        href={`/projects/${projectId}/expenses/${expense.id}`}
        className="grid gap-2 border-t px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
        aria-label={`${expense.title}, ${formatWon(expense.amount)}, ${stageLabel}`}
      >
        <span className="truncate font-medium">{expense.title}</span>
        <span className="text-right font-semibold tabular-nums">{formatWon(expense.amount)}</span>
        <Badge variant="neutral" className="w-fit">
          {stageLabel}
        </Badge>
      </Link>
    </li>
  );
}
