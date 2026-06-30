"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/constants/routes";
import { useToast } from "@/hooks/use-toast";
import { extractApiErrorMessage } from "@/lib/remote/api-client";
import type { PolicyDraftUpdateInput } from "../backend/schema";
import { usePolicyDraftDetailQuery, useProgramPolicyMutations, useProjectPolicyStatusQuery } from "../hooks/use-program-policy";

const statusLabel = {
  confirmed_policy: "정책 확정",
  draft_needs_review: "검토 필요",
  extraction_failed: "추출 실패",
  legacy_fallback: "기본 비목",
} as const;

const createEmptyDraft = (): PolicyDraftUpdateInput => ({
  categories: [],
  evidenceRequirements: [],
  subcategories: [],
});

export function ProgramPolicyPanel({
  projectId,
  redirectOnConfirm = false,
}: {
  projectId: string;
  redirectOnConfirm?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const statusQuery = useProjectPolicyStatusQuery(projectId);
  const latestVersionId = statusQuery.data?.latestPolicyVersion?.id ?? null;
  const draftQuery = usePolicyDraftDetailQuery(projectId, latestVersionId);
  const mutations = useProgramPolicyMutations(projectId, latestVersionId);
  const [draft, setDraft] = useState<PolicyDraftUpdateInput>(createEmptyDraft);
  const [extractedText, setExtractedText] = useState("");

  useEffect(() => {
    if (!draftQuery.data) return;
    setDraft({
      categories: draftQuery.data.categories.map((category) => ({
        categoryKey: category.categoryKey,
        categoryName: category.categoryName,
        id: category.id,
        rawCategoryName: category.rawCategoryName,
        reviewStatus: category.reviewStatus,
        sortOrder: category.sortOrder,
        sourceReference: category.sourceReference,
      })),
      evidenceRequirements: draftQuery.data.evidenceRequirements.map((evidence) => ({
        categoryKey: evidence.categoryKey,
        conditionText: evidence.conditionText,
        documentKey: evidence.documentKey,
        evidenceKey: evidence.evidenceKey,
        evidenceName: evidence.evidenceName,
        fulfillmentType: evidence.fulfillmentType,
        id: evidence.id,
        requirementType: evidence.requirementType,
        reviewStatus: evidence.reviewStatus,
        sourceReference: evidence.sourceReference,
        subcategoryKey: evidence.subcategoryKey,
      })),
      subcategories: draftQuery.data.subcategories.map((subcategory) => ({
        categoryId: subcategory.categoryId,
        categoryKey: subcategory.categoryKey,
        id: subcategory.id,
        rawSubcategoryName: subcategory.rawSubcategoryName,
        reviewStatus: subcategory.reviewStatus,
        sortOrder: subcategory.sortOrder,
        sourceReference: subcategory.sourceReference,
        subcategoryKey: subcategory.subcategoryKey,
        subcategoryName: subcategory.subcategoryName,
      })),
    });
  }, [draftQuery.data]);

  const blockingErrors = draftQuery.data?.blockingErrors ?? [];
  const canEditDraft = draftQuery.data
    ? draftQuery.data.version.status !== "confirmed"
      && draftQuery.data.version.status !== "archived"
      && draftQuery.data.version.operationStatus !== "extraction_failed"
    : false;
  const canConfirm = latestVersionId && canEditDraft && blockingErrors.length === 0;
  const latestStatus = statusQuery.data?.operationStatus ?? "legacy_fallback";
  const versionRows = statusQuery.data?.versions ?? [];
  const summary = useMemo(() => ({
    categories: draft.categories.length,
    evidence: draft.evidenceRequirements.length,
    subcategories: draft.subcategories.length,
  }), [draft]);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const intent = await mutations.uploadMutation.mutateAsync(file);
      toast({ title: "정책 PDF를 등록했습니다.", description: "비목/증빙서류 초안 버전이 생성되었습니다." });
      try {
        await mutations.extractMutation.mutateAsync({ extractedText: null, versionId: intent.policyVersionId });
        toast({ title: "정책 초안을 추출했습니다.", description: "추출된 비목과 증빙서류를 검토해 주세요." });
      } catch (error) {
        toast({
          title: "정책 추출에 실패했습니다.",
          description: extractApiErrorMessage(error, "기본 비목으로 시작하거나 텍스트를 붙여넣어 다시 시도해 주세요."),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({ title: "정책 PDF를 등록하지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" });
    }
  };

  const onConfirmPolicy = async () => {
    try {
      await mutations.confirmMutation.mutateAsync();
      toast({ title: "정책을 확정했습니다.", description: "이제 지출 비목과 증빙서류가 확정한 정책을 따릅니다." });
      if (redirectOnConfirm) {
        router.push(routes.project(projectId));
      }
    } catch (error) {
      toast({
        title: "정책을 확정하지 못했습니다.",
        description: extractApiErrorMessage(error, "정책을 확정하지 못했습니다. 현재 비목으로 계속 진행해 주세요."),
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">정책 PDF 및 비목/증빙서류 세팅</CardTitle>
          <Badge variant={latestStatus === "confirmed_policy" ? "default" : "secondary"}>
            {statusLabel[latestStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              accept="application/pdf,.pdf"
              className="max-w-md"
              disabled={mutations.uploadMutation.isPending}
              onChange={(event) => void onUpload(event.target.files?.[0])}
              type="file"
            />
            <Button
              disabled={!latestVersionId || mutations.extractMutation.isPending}
              onClick={() => latestVersionId && mutations.extractMutation.mutate({ extractedText: extractedText || null, versionId: latestVersionId })}
              type="button"
              variant="outline"
            >
              <RefreshCcw className="mr-2 size-4" />
              초안 추출
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push(routes.project(projectId))}>
              기본 비목으로 시작
            </Button>
          </div>
          <Textarea
            placeholder="PDF 텍스트 추출이 실패했을 때만 추출된 텍스트를 붙여넣어 다시 시도합니다."
            value={extractedText}
            onChange={(event) => setExtractedText(event.target.value)}
          />
          {latestStatus === "legacy_fallback" ? (
            <p className="text-sm text-muted-foreground">확정된 정책이 아직 없습니다. 세팅하지 않으면 기존 비목과 지출카드 레이아웃을 그대로 사용합니다.</p>
          ) : null}
          {latestStatus === "extraction_failed" ? (
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <AlertCircle className="size-4" />
              추출에 실패했습니다. 정책을 확정하기 전까지는 기존 비목 흐름을 계속 사용합니다.
            </p>
          ) : null}
        </div>

        {draftQuery.data ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                비목 {summary.categories}개 / 세부항목 {summary.subcategories}개 / 증빙서류 {summary.evidence}개
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={!canEditDraft || mutations.updateDraftMutation.isPending}
                  onClick={() => mutations.updateDraftMutation.mutate(draft)}
                  type="button"
                  variant="outline"
                >
                  <Save className="mr-2 size-4" />
                  검토 내용 저장
                </Button>
                <Button
                  disabled={!canConfirm || mutations.confirmMutation.isPending}
                  onClick={() => void onConfirmPolicy()}
                  type="button"
                >
                  <CheckCircle2 className="mr-2 size-4" />
                  정책 확정
                </Button>
              </div>
            </div>

            {blockingErrors.length > 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {blockingErrors.slice(0, 5).map((error) => <p key={error}>{error}</p>)}
              </div>
            ) : null}

            {canEditDraft ? (
              <PolicyRowEditor draft={draft} onChange={setDraft} />
            ) : (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                This policy version is read-only. Upload another PDF to create a new draft.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid gap-2">
          <p className="text-sm font-medium">Versions</p>
          <div className="grid gap-2">
            {versionRows.length === 0 ? <p className="text-sm text-muted-foreground">No policy versions yet.</p> : null}
            {versionRows.map((version) => (
              <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span>v{version.versionNumber} · {version.status}</span>
                <span className="text-muted-foreground">{version.confirmedAt ? `confirmed ${version.confirmedAt.slice(0, 10)}` : version.createdAt.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PolicyRowEditor({
  draft,
  onChange,
}: {
  draft: PolicyDraftUpdateInput;
  onChange: (draft: PolicyDraftUpdateInput) => void;
}) {
  const updateCategory = (index: number, key: "categoryKey" | "categoryName", value: string) => {
    const categories = draft.categories.map((category, current) =>
      current === index ? { ...category, [key]: value, reviewStatus: "auto_confident" as const } : category,
    );
    onChange({ ...draft, categories });
  };

  const deleteCategory = (index: number) => {
    const categoryKey = draft.categories[index]?.categoryKey;
    onChange({
      ...draft,
      categories: draft.categories.filter((_, current) => current !== index).map((category, current) => ({ ...category, sortOrder: current })),
      evidenceRequirements: draft.evidenceRequirements.filter((evidence) => evidence.categoryKey !== categoryKey),
      subcategories: draft.subcategories.filter((subcategory) => subcategory.categoryKey !== categoryKey),
    });
  };

  const updateEvidence = (
    index: number,
    key: "categoryKey" | "evidenceKey" | "evidenceName" | "requirementType",
    value: string,
  ) => {
    const evidenceRequirements = draft.evidenceRequirements.map((evidence, current) =>
      current === index ? { ...evidence, [key]: value, reviewStatus: "auto_confident" as const } : evidence,
    );
    onChange({ ...draft, evidenceRequirements });
  };

  const deleteEvidence = (index: number) => {
    onChange({
      ...draft,
      evidenceRequirements: draft.evidenceRequirements.filter((_, current) => current !== index),
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Categories</p>
          <Button
            onClick={() => onChange({
              ...draft,
              categories: [...draft.categories, {
                categoryKey: `category_${draft.categories.length + 1}`,
                categoryName: "",
                reviewStatus: "auto_confident",
                sortOrder: draft.categories.length,
                sourceReference: {},
              }],
            })}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="mr-2 size-4" />
            Add category
          </Button>
        </div>
        {draft.categories.map((category, index) => (
          <div key={`${category.id ?? "new"}-${index}`} className="grid gap-2 rounded-md border p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
              <Input value={category.categoryKey} onChange={(event) => updateCategory(index, "categoryKey", event.target.value)} />
              <Input value={category.categoryName} onChange={(event) => updateCategory(index, "categoryName", event.target.value)} />
              <div className="flex items-center justify-end gap-2">
                <Badge variant={category.reviewStatus === "auto_confident" ? "default" : "secondary"}>{category.reviewStatus}</Badge>
                <Button aria-label="Delete category" onClick={() => deleteCategory(index)} size="icon" type="button" variant="ghost">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Evidence requirements</p>
          <Button
            onClick={() => onChange({
              ...draft,
              evidenceRequirements: [...draft.evidenceRequirements, {
                categoryKey: draft.categories[0]?.categoryKey ?? null,
                documentKey: `document_${draft.evidenceRequirements.length + 1}`,
                evidenceKey: `evidence_${draft.evidenceRequirements.length + 1}`,
                evidenceName: "",
                fulfillmentType: "single",
                requirementType: "required",
                reviewStatus: "auto_confident",
                sourceReference: {},
              }],
            })}
            size="sm"
            type="button"
            variant="outline"
          >
            <FileUp className="mr-2 size-4" />
            Add evidence
          </Button>
        </div>
        {draft.evidenceRequirements.map((evidence, index) => (
          <div key={`${evidence.id ?? "new"}-${index}`} className="grid gap-2 rounded-md border p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
              <Input value={evidence.categoryKey ?? ""} onChange={(event) => updateEvidence(index, "categoryKey", event.target.value)} />
              <Input value={evidence.evidenceKey} onChange={(event) => updateEvidence(index, "evidenceKey", event.target.value)} />
              <Input value={evidence.evidenceName} onChange={(event) => updateEvidence(index, "evidenceName", event.target.value)} />
              <div className="flex items-center justify-end gap-2">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={evidence.requirementType}
                  onChange={(event) => updateEvidence(index, "requirementType", event.target.value)}
                >
                  <option value="required">required</option>
                  <option value="conditional">conditional</option>
                  <option value="optional">optional</option>
                </select>
                <Button aria-label="Delete evidence" onClick={() => deleteEvidence(index)} size="icon" type="button" variant="ghost">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
