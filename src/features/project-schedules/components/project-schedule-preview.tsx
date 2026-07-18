"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { useProjectSchedulesQuery } from "../hooks/use-project-schedules";

export function ProjectSchedulePreview({ projectId }: { projectId: string }) {
  const query = useProjectSchedulesQuery(projectId, "this-week");
  if (query.isPending || query.error) return null;

  return (
    <section className="mt-10" aria-labelledby="this-week-schedules-title">
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <h2 id="this-week-schedules-title" className="text-lg font-bold leading-tight tracking-normal text-[#191f28]">이번 주 일정</h2>
            <p className="mt-1 text-sm text-muted-foreground">이번 주에 예정된 주요 일정입니다.</p>
          </div>
          <Button asChild size="sm" variant="weak-primary"><Link href={routes.projectSchedules(projectId)}>전체 일정 관리</Link></Button>
        </CardHeader>
        <CardContent>
          {query.data?.length ? <ul className="space-y-3" aria-label="이번 주 일정 목록">
            {query.data.map((schedule) => <li key={schedule.id} className="flex items-center justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0">
              <span className="font-medium">{schedule.title}</span><time className="shrink-0 text-sm text-muted-foreground" dateTime={schedule.scheduledOn}>{schedule.scheduledOn}</time>
            </li>)}
          </ul> : <p className="text-sm text-muted-foreground">이번 주에 예정된 일정이 없습니다.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
