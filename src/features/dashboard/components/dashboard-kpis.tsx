import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardResponse } from "../backend/schema";

export const formatWon = (amount: number) =>
  `${new Intl.NumberFormat("ko-KR").format(amount)}원`;

export const formatRatio = (ratio: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio);

export function DashboardKpis({ kpis }: { kpis: DashboardResponse["kpis"] }) {
  const cards = [
    {
      accent: "bg-primary",
      badge: "총 예산",
      label: "총 사업비",
      value: formatWon(kpis.totalBudget),
      description: "정부지원금과 자기부담금 합계",
    },
    {
      accent: "bg-success",
      badge: "잔여",
      label: "남은 예산",
      value: formatWon(kpis.remainingAmount),
      description: `집행 완료 ${formatWon(kpis.spentAmount)}`,
    },
    {
      accent: "bg-warning",
      badge: "소진율",
      label: "예산 소진율",
      value: formatRatio(kpis.burnRatio),
      description: "집행 완료 금액 기준",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="프로젝트 핵심 지표">
      {cards.map((card) => (
        <Card key={card.label} className="relative overflow-hidden">
          <div className={`absolute inset-x-0 top-0 h-1 ${card.accent}`} aria-hidden="true" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardDescription>{card.label}</CardDescription>
              <Badge variant="neutral">{card.badge}</Badge>
            </div>
            <CardTitle className="text-right text-2xl text-primary tabular-nums sm:text-3xl" aria-label={`${card.label} ${card.value}`}>
              {card.value}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{card.description}</CardContent>
        </Card>
      ))}
    </div>
  );
}
