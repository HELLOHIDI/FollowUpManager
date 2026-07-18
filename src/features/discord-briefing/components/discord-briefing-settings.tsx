"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPANY_ACCOUNT_MANAGER_OPTIONS } from "@/features/company/lib/dto";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/remote/api-client";

type Channel = { account_manager: string; discord_channel_id: string };
type Delivery = { account_manager: string; external_request_step: string | null; kind: string; last_error: string | null; scope_key: string; status: string };
const key = ["discord-briefing", "channels"] as const;

export function DiscordBriefingSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const channels = useQuery({ queryKey: key, queryFn: async () => (await apiClient.get<Channel[]>("/api/discord/channels")).data });
  const deliveries = useQuery({ queryKey: ["discord-briefing", "deliveries"], queryFn: async () => (await apiClient.get<Delivery[]>("/api/discord/deliveries")).data });
  const save = useMutation({ mutationFn: ({ manager, channelId }: { manager: string; channelId: string }) => apiClient.put(`/api/discord/channels/${encodeURIComponent(manager)}`, { channelId }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }) });
  const test = useMutation({ mutationFn: (accountManager: string) => apiClient.post("/api/discord/test", { accountManager }) });
  const configured = new Map((channels.data ?? []).map((channel) => [channel.account_manager, channel.discord_channel_id]));

  return <section className="grid gap-4">
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Discord 주간 브리핑</CardTitle>
        <CardDescription>담당자별 채널을 등록하고 실제 사업 현황으로 테스트 발송합니다.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {COMPANY_ACCOUNT_MANAGER_OPTIONS.map(({ name, role, team }) => <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center" key={name}><div className="min-w-40 text-sm font-medium">{name} {team} {role}</div><input className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" aria-label={`${name} Discord channel ID`} defaultValue={configured.get(name) ?? ""} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} placeholder="Discord channel ID" /><Button disabled={save.isPending || !(values[name] ?? configured.get(name))} onClick={() => save.mutate({ manager: name, channelId: values[name] ?? configured.get(name) ?? "" }, { onSuccess: () => toast({ title: "채널을 저장했습니다." }), onError: () => toast({ title: "채널 저장에 실패했습니다.", variant: "destructive" }) })} type="button" variant="outline">저장</Button><Button disabled={test.isPending || !configured.get(name)} onClick={() => test.mutate(name, { onSuccess: () => toast({ title: "테스트 발송을 요청했습니다." }), onError: () => toast({ title: "테스트 발송에 실패했습니다.", variant: "destructive" }) })} type="button">테스트</Button></div>)}
      </CardContent>
    </Card>
    {(deliveries.data ?? []).filter((delivery) => delivery.status === "needs_review" || delivery.external_request_step).map((delivery) => <Card key={`${delivery.account_manager}-${delivery.scope_key}`} className="border-destructive/40 shadow-none"><CardContent className="p-4 text-sm"><strong>{delivery.account_manager}</strong> · {delivery.scope_key}<br />검토 필요: {delivery.external_request_step ?? delivery.last_error ?? "Discord 전송 상태를 확인하세요."}</CardContent></Card>)}
    {(deliveries.data ?? []).filter((delivery) => delivery.status === "failed").map((delivery) => <Card key={`failed-${delivery.kind}-${delivery.account_manager}-${delivery.scope_key}`} className="border-destructive/40 shadow-none"><CardContent className="p-4 text-sm"><strong>{delivery.account_manager}</strong> · {delivery.kind === "d_day" ? "D-Day" : delivery.kind === "d_minus_1" ? "D-1" : "주간 브리핑"} · {delivery.scope_key}<br />{delivery.last_error ?? "Discord 발송에 실패했습니다."}</CardContent></Card>)}
  </section>;
}
