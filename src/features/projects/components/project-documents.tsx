"use client";

import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_UPLOAD_ACCEPT } from "@/lib/file-upload";
import { extractApiErrorMessage } from "@/lib/remote/api-client";
import { getProjectDocumentSignedUrl } from "../api";
import { useProjectDocumentsQuery, useProjectMutations } from "../hooks/use-projects";

export function ProjectDocuments({
  embedded = false,
  projectId,
  purpose = "general",
}: {
  embedded?: boolean;
  projectId: string;
  purpose?: "general" | "institution_template";
}) {
  const query = useProjectDocumentsQuery(projectId, purpose);
  const { deleteDocumentMutation, uploadMutation } = useProjectMutations();
  const { toast } = useToast();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const open = async (documentId: string) => {
    const tab = window.open("about:blank", "_blank");
    if (!tab) return;
    setOpeningId(documentId);
    try { tab.location.href = (await getProjectDocumentSignedUrl(projectId, documentId)).signedUrl; }
    catch (error) { tab.close(); toast({ title: "파일을 열지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" }); }
    finally { setOpeningId(null); }
  };
  return <section className={embedded ? "space-y-4" : "space-y-4 border-t pt-6"}>
    {!embedded ? <div><h2 className="text-lg font-semibold">첨부파일</h2><p className="text-sm text-muted-foreground">정책 PDF와 기관 양식 외 참고 파일을 등록합니다.</p></div> : null}
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"><Upload className="size-4" />파일 추가<Input className="sr-only" multiple type="file" accept={DEFAULT_UPLOAD_ACCEPT} onChange={async (event) => { for (const file of Array.from(event.target.files ?? [])) { try { await uploadMutation.mutateAsync({ file, projectId, purpose }); } catch (error) { toast({ title: "파일을 추가하지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" }); } } event.target.value = ""; }} /></label>
    {query.isPending ? <Loader2 className="size-5 animate-spin" /> : query.isError ? <div className="space-y-2" role="alert"><p className="text-sm">첨부파일을 불러오지 못했습니다.</p><Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">다시 시도</Button></div> : query.data?.length ? <ul className="divide-y rounded-md border">{query.data.map((document) => <li className="flex items-center justify-between gap-3 p-3" key={document.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{document.originalFileName}</p><p className="text-xs text-muted-foreground">{Math.ceil(document.fileSize / 1024).toLocaleString()}KB · {new Date(document.createdAt).toLocaleDateString("ko-KR")}</p></div><div className="flex gap-1"><Button aria-label={`${document.originalFileName} 새 창에서 열기`} disabled={openingId === document.id} onClick={() => void open(document.id)} size="icon" type="button" variant="ghost"><ExternalLink className="size-4" /></Button><Button aria-label={`${document.originalFileName} 삭제`} disabled={deleteDocumentMutation.isPending} onClick={async () => { try { await deleteDocumentMutation.mutateAsync({ documentId: document.id, projectId }); } catch (error) { toast({ title: "첨부파일을 삭제하지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" }); } }} size="icon" type="button" variant="ghost"><Trash2 className="size-4" /></Button></div></li>)}</ul> : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">등록된 첨부파일이 없습니다.</p>}
  </section>;
}
