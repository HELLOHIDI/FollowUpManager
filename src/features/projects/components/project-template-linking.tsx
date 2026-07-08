"use client";

import { ChevronDown, ChevronRight, GripVertical, Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_UPLOAD_ACCEPT } from "@/lib/file-upload";
import { extractApiErrorMessage } from "@/lib/remote/api-client";
import { getProjectDocumentSignedUrl } from "../api";
import { useProjectDocumentsQuery, useProjectEvidenceDocumentsQuery, useProjectMutations } from "../hooks/use-projects";
import type { ProjectDocumentResponse, ProjectDocumentTemplateLink, ProjectEvidenceDocumentType } from "../lib/dto";

type DraftType = ProjectEvidenceDocumentType | {
  categoryKey?: string | null;
  categoryName?: string | null;
  displayName: string;
  documentKey: string;
  sortOrder: number;
  source: "custom";
  stageKey: "execution_request";
  subcategoryKey?: string | null;
  subcategoryName?: string | null;
};

const makeCustomKey = (label: string) => {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "document";
  return `custom_${slug}_${crypto.randomUUID().slice(0, 8).replace(/-/g, "")}`;
};

const linkKey = (documentKey: string, projectDocumentId: string) => `${documentKey}:${projectDocumentId}`;

export function ProjectTemplateLinking({
  onDirtyChange,
  onSaved,
  projectId,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
  projectId: string;
}) {
  const documentsQuery = useProjectDocumentsQuery(projectId);
  const setupQuery = useProjectEvidenceDocumentsQuery(projectId);
  const { deleteDocumentMutation, saveEvidenceDocumentsMutation, uploadMutation } = useProjectMutations();
  const { toast } = useToast();
  const [documentTypes, setDocumentTypes] = useState<DraftType[]>([]);
  const [links, setLinks] = useState<Array<Omit<ProjectDocumentTemplateLink, "documentTypeId"> & { documentTypeId?: string }>>([]);
  const [dirty, setDirty] = useState(false);
  const [openGroupKeys, setOpenGroupKeys] = useState<Set<string>>(new Set());
  const [openSubgroupKeys, setOpenSubgroupKeys] = useState<Set<string>>(new Set());
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!setupQuery.data || dirty) return;
    setDocumentTypes(setupQuery.data.documentTypes);
    setLinks(setupQuery.data.links);
  }, [dirty, setupQuery.data]);

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const documents = documentsQuery.data ?? [];
  const linkedIds = useMemo(() => new Set(links.map((link) => link.projectDocumentId)), [links]);
  const availableDocuments = useMemo(() => documents.filter((document) => !linkedIds.has(document.id)), [documents, linkedIds]);
  const groupedDocumentTypes = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; subgroups: Array<{ key: string; name: string; types: DraftType[] }> }>();
    for (const type of documentTypes) {
      const key = type.categoryKey || "__uncategorized";
      const subgroupKey = type.subcategoryKey || "__common";
      const group = groups.get(key) ?? { key, name: type.categoryName || "비목 미지정", subgroups: [] };
      let subgroup = group.subgroups.find((item) => item.key === subgroupKey);
      if (!subgroup) {
        subgroup = { key: subgroupKey, name: type.subcategoryName || "공통", types: [] };
        group.subgroups.push(subgroup);
      }
      subgroup.types.push(type);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [documentTypes]);

  const markDirty = () => setDirty(true);
  const toggleGroup = (key: string) => {
    setOpenGroupKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleSubgroup = (key: string) => {
    setOpenSubgroupKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const addLink = (documentKey: string, document: ProjectDocumentResponse) => {
    setLinks((current) => current.some((link) => linkKey(link.documentKey, link.projectDocumentId) === linkKey(documentKey, document.id))
      ? current
      : [...current, { documentKey, projectDocumentId: document.id, sortOrder: current.filter((link) => link.documentKey === documentKey).length }]);
    markDirty();
  };
  const removeLink = (documentKey: string, projectDocumentId: string) => {
    setLinks((current) => current.filter((link) => linkKey(link.documentKey, link.projectDocumentId) !== linkKey(documentKey, projectDocumentId)));
    markDirty();
  };
  const renameType = (documentKey: string, displayName: string) => {
    setDocumentTypes((current) => current.map((type) => type.documentKey === documentKey ? { ...type, displayName } : type));
    markDirty();
  };
  const addType = () => {
    const displayName = "새 증빙서류";
    setDocumentTypes((current) => [...current, {
      displayName,
      documentKey: makeCustomKey(displayName),
      sortOrder: current.length,
      source: "custom",
      stageKey: "execution_request",
    }]);
    markDirty();
  };
  const upload = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      try {
        await uploadMutation.mutateAsync({ file, projectId, purpose: "institution_template" });
      } catch (error) {
        toast({ title: "파일을 추가하지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" });
      }
    }
  };
  const openDocument = async (documentId: string) => {
    const tab = window.open("about:blank", "_blank");
    if (!tab) return;
    setOpeningId(documentId);
    try {
      tab.location.href = (await getProjectDocumentSignedUrl(projectId, documentId)).signedUrl;
    } catch (error) {
      tab.close();
      toast({ title: "파일을 열지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" });
    } finally {
      setOpeningId(null);
    }
  };
  const save = async () => {
    try {
      const saved = await saveEvidenceDocumentsMutation.mutateAsync({ input: { documentTypes, links }, projectId });
      setDocumentTypes(saved.documentTypes);
      setLinks(saved.links);
      setDirty(false);
      toast({ title: "기관 양식 연결을 저장했습니다.", description: "저장한 양식은 지출 상세에서 다운로드할 수 있습니다." });
      onSaved?.();
    } catch (error) {
      toast({ title: "기관 양식 연결을 저장하지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">증빙서류와 기관 양식</h2>
            {dirty ? <Badge variant="warning">검토 필요</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">저장하면 변경사항이 지출 상세에 반영됩니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addType}>
            <Plus className="mr-2 size-4" />
            증빙서류 추가
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!dirty || saveEvidenceDocumentsMutation.isPending}>
            {saveEvidenceDocumentsMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            저장
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">기관 양식 파일</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
              <Upload className="size-4" />
              파일 추가
              <Input className="sr-only" multiple type="file" accept={DEFAULT_UPLOAD_ACCEPT} onChange={(event) => void upload(event.target.files).finally(() => { event.target.value = ""; })} />
            </label>
          </div>
          {documentsQuery.isPending ? <Loader2 className="size-5 animate-spin" /> : null}
          {availableDocuments.length === 0 && !documentsQuery.isPending ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">연결 가능한 기관 양식 파일이 없습니다.</p> : null}
          <ul className="space-y-2">
            {availableDocuments.map((document) => (
              <li key={document.id} className="rounded-md border p-3" draggable onDragStart={() => setDraggedDocumentId(document.id)} onDragEnd={() => setDraggedDocumentId(null)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{document.originalFileName}</p>
                    <p className="text-xs text-muted-foreground">{Math.ceil(document.fileSize / 1024).toLocaleString("ko-KR")}KB</p>
                  </div>
                  <GripVertical className="mt-1 size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button aria-label={`열기 ${document.originalFileName}`} size="sm" variant="ghost" type="button" onClick={() => void openDocument(document.id)} disabled={openingId === document.id}>열기</Button>
                  <Button aria-label={`삭제 ${document.originalFileName}`} size="sm" variant="ghost" type="button" onClick={async () => {
                    try {
                      await deleteDocumentMutation.mutateAsync({ documentId: document.id, projectId });
                    } catch (error) {
                      toast({ title: "파일을 삭제하지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" });
                    }
                  }}>
                    <Trash2 className="mr-1 size-3" />
                    삭제
                  </Button>
                  {linkedIds.has(document.id) ? <Badge variant="secondary">연결됨</Badge> : <Badge variant="outline">미연결</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          {setupQuery.isPending ? <Loader2 className="size-5 animate-spin" /> : null}
          {documentTypes.length === 0 && !setupQuery.isPending ? <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">기관에서 전달받은 양식이 없으면 비워두면 됩니다.</p> : null}
          {groupedDocumentTypes.map((group) => (
            <div key={group.key} className="rounded-md border bg-muted/20 p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={openGroupKeys.has(group.key)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {openGroupKeys.has(group.key) ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                  <span className="truncate text-base font-semibold">{group.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{group.subgroups.reduce((sum, subgroup) => sum + subgroup.types.length, 0)}개</span>
              </button>
              {openGroupKeys.has(group.key) ? <div className="mt-3 space-y-3">
          {group.subgroups.map((subgroup) => (
            <div key={subgroup.key} className={group.subgroups.length > 1 || subgroup.key !== "__common" ? "space-y-2 rounded-md border bg-background/70 p-2" : "space-y-2"}>
              {group.subgroups.length > 1 || subgroup.key !== "__common" ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-1 text-left"
                  onClick={() => toggleSubgroup(`${group.key}:${subgroup.key}`)}
                  aria-expanded={openSubgroupKeys.has(`${group.key}:${subgroup.key}`)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {openSubgroupKeys.has(`${group.key}:${subgroup.key}`) ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                    <span className="truncate text-sm font-medium">{subgroup.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{subgroup.types.length}개</span>
                </button>
              ) : null}
          {(group.subgroups.length > 1 || subgroup.key !== "__common") && !openSubgroupKeys.has(`${group.key}:${subgroup.key}`) ? null : subgroup.types.map((type) => {
            const typeLinks = links.filter((link) => link.documentKey === type.documentKey);
            return (
              <div
                key={type.documentKey}
                className="rounded-md border bg-background p-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const document = documents.find((item) => item.id === draggedDocumentId);
                  if (document) addLink(type.documentKey, document);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="증빙서류명" value={type.displayName} onChange={(event) => renameType(type.documentKey, event.target.value)} />
                </div>
                {typeLinks.length > 0 ? <div className="mt-2 grid gap-2 border-t pt-2">
                  {typeLinks.map((link) => {
                    const document = documents.find((item) => item.id === link.projectDocumentId);
                    if (!document) return null;
                    return (
                      <div key={linkKey(type.documentKey, document.id)} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                        <span className="truncate">{document.originalFileName}</span>
                        <Button aria-label="연결 해제" size="icon" type="button" variant="ghost" onClick={() => removeLink(type.documentKey, document.id)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div> : null}
              </div>
            );
          })}
            </div>
          ))}
              </div> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
