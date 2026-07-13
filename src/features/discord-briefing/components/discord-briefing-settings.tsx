"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/remote/api-client";
import { COMPANY_ACCOUNT_MANAGER_OPTIONS } from "@/features/company/lib/dto";

type Channel = { account_manager: string; discord_channel_id: string };
type Delivery = { account_manager: string; external_request_step: string | null; last_error: string | null; scope_key: string; status: string };
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
    <Card className="shadow-none"><CardHeader><CardTitle>Discord \uC8FC\uAC04 \uBE0C\uB9AC\uD551</CardTitle><CardDescription>\uB2F4\uB2F9\uC790\uBCC4 \uCC44\uB110\uC744 \uB4F1\uB85D\uD558\uACE0 \uC2E4\uC81C \uD604\uD669\uC73C\uB85C \uD14C\uC2A4\uD2B8\uD569\uB2C8\uB2E4.</CardDescription></CardHeader><CardContent className="grid gap-4">
      {COMPANY_ACCOUNT_MANAGER_OPTIONS.map(({ name, role, team }) => <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center" key={name}><div className="min-w-40 text-sm font-medium">{name} {team} {role}</div><input className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" aria-label={`${name} Discord channel ID`} defaultValue={configured.get(name) ?? ""} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} placeholder="Discord channel ID" /><Button disabled={save.isPending || !(values[name] ?? configured.get(name))} onClick={() => save.mutate({ manager: name, channelId: values[name] ?? configured.get(name) ?? "" }, { onSuccess: () => toast({ title: "\uCC44\uB110\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4." }), onError: () => toast({ title: "\uCC44\uB110 \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", variant: "destructive" }) })} type="button" variant="outline">\uC800\uC7A5</Button><Button disabled={test.isPending || !configured.get(name)} onClick={() => test.mutate(name, { onSuccess: () => toast({ title: "\uD14C\uC2A4\uD2B8 \uBC1C\uC1A1\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4." }), onError: () => toast({ title: "\uD14C\uC2A4\uD2B8 \uBC1C\uC1A1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", variant: "destructive" }) })} type="button">\uD14C\uC2A4\uD2B8</Button></div>)}
    </CardContent></Card>
    {(deliveries.data ?? []).filter((delivery) => delivery.status === "needs_review" || delivery.external_request_step).map((delivery) => <Card key={`${delivery.account_manager}-${delivery.scope_key}`} className="border-destructive/40 shadow-none"><CardContent className="p-4 text-sm"><strong>{delivery.account_manager}</strong> · {delivery.scope_key}<br />검토 필요: {delivery.external_request_step ?? delivery.last_error ?? "Discord 전송 상태를 확인하세요."}</CardContent></Card>)}
  </section>;
}
