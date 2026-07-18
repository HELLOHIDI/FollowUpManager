"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeading } from "@/components/product-shell";
import { useToast } from "@/hooks/use-toast";
import type { ProjectSchedule, ProjectScheduleInput } from "../backend/schema";
import { useProjectScheduleMutations, useProjectSchedulesQuery } from "../hooks/use-project-schedules";

const emptyInput: ProjectScheduleInput = { memo: null, scheduledOn: "", title: "" };

function ScheduleForm({ initial, onCancel, onSubmit, submitting }: { initial: ProjectScheduleInput; onCancel?: () => void; onSubmit: (input: ProjectScheduleInput) => Promise<void>; submitting: boolean }) {
  const [input, setInput] = useState(initial);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ ...input, memo: input.memo?.trim() || null, title: input.title.trim() });
    if (!onCancel) setInput(emptyInput);
  };
  return <form className="space-y-4" onSubmit={submit}>
    <label className="block space-y-2 text-sm font-medium">일정명<Input required value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} /></label>
    <label className="block space-y-2 text-sm font-medium">날짜<Input required type="date" value={input.scheduledOn} onChange={(event) => setInput({ ...input, scheduledOn: event.target.value })} /></label>
    <label className="block space-y-2 text-sm font-medium">메모 <span className="font-normal text-muted-foreground">(선택)</span><Textarea value={input.memo ?? ""} onChange={(event) => setInput({ ...input, memo: event.target.value })} /></label>
    <div className="flex gap-2"><Button disabled={submitting} type="submit">{submitting ? "저장 중" : "저장"}</Button>{onCancel ? <Button disabled={submitting} onClick={onCancel} type="button" variant="weak-neutral">취소</Button> : null}</div>
  </form>;
}

function ScheduleList({ schedules, projectId }: { schedules: ProjectSchedule[]; projectId: string }) {
  const { toast } = useToast();
  const { deleteMutation, updateMutation } = useProjectScheduleMutations();
  const [editing, setEditing] = useState<ProjectSchedule | null>(null);
  if (!schedules.length) return <p className="py-6 text-sm text-muted-foreground">등록된 일정이 없습니다.</p>;
  return <ul className="divide-y" aria-label="등록 일정 목록">{schedules.map((schedule) => <li key={schedule.id} className="py-4">
    {editing?.id === schedule.id ? <ScheduleForm initial={{ memo: schedule.memo, scheduledOn: schedule.scheduledOn, title: schedule.title }} submitting={updateMutation.isPending} onCancel={() => setEditing(null)} onSubmit={async (input) => {
      try { await updateMutation.mutateAsync({ input, projectId, scheduleId: schedule.id }); setEditing(null); toast({ title: "일정을 수정했습니다." }); } catch { toast({ title: "일정을 수정하지 못했습니다.", variant: "destructive" }); }
    }} /> : <div className="flex items-start justify-between gap-4"><div><p className="font-medium">{schedule.title}</p><time className="mt-1 block text-sm text-muted-foreground" dateTime={schedule.scheduledOn}>{schedule.scheduledOn}</time>{schedule.memo ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{schedule.memo}</p> : null}</div><div className="flex shrink-0 gap-2"><Button onClick={() => setEditing(schedule)} size="sm" variant="weak-neutral">수정</Button><Button disabled={deleteMutation.isPending} onClick={async () => { if (!window.confirm("이 일정을 삭제할까요?")) return; try { await deleteMutation.mutateAsync({ projectId, scheduleId: schedule.id }); toast({ title: "일정을 삭제했습니다." }); } catch { toast({ title: "일정을 삭제하지 못했습니다.", variant: "destructive" }); } }} size="sm" variant="weak-danger">삭제</Button></div></div>}
  </li>)}</ul>;
}

export function ScheduleManagementPage({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const upcoming = useProjectSchedulesQuery(projectId, "upcoming");
  const past = useProjectSchedulesQuery(projectId, "past");
  const { createMutation } = useProjectScheduleMutations();
  return <><PageHeading eyebrow="프로젝트 일정" title="일정 관리" description="주요 일정을 관리하고 Discord 알림 대상 일정을 확인합니다." />
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"><Card className="shadow-none"><CardHeader><CardTitle>예정 일정</CardTitle></CardHeader><CardContent>{upcoming.isPending ? <p>일정을 불러오는 중입니다.</p> : upcoming.error ? <p role="alert">일정을 불러오지 못했습니다.</p> : <ScheduleList projectId={projectId} schedules={upcoming.data ?? []} />}</CardContent></Card>
      <Card className="h-fit shadow-none"><CardHeader><CardTitle>새 일정 등록</CardTitle></CardHeader><CardContent><ScheduleForm initial={emptyInput} submitting={createMutation.isPending} onSubmit={async (input) => { try { await createMutation.mutateAsync({ input, projectId }); toast({ title: "일정을 등록했습니다." }); } catch { toast({ title: "일정을 등록하지 못했습니다.", variant: "destructive" }); } }} /></CardContent></Card>
    </div>
    <Card className="mt-6 shadow-none"><CardHeader><CardTitle>지난 일정</CardTitle></CardHeader><CardContent>{past.isPending ? <p>지난 일정을 불러오는 중입니다.</p> : past.error ? <p role="alert">지난 일정을 불러오지 못했습니다.</p> : <ScheduleList projectId={projectId} schedules={past.data ?? []} />}</CardContent></Card>
  </>;
}
