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

const formatBlockingError = (error: string, draft: PolicyDraftUpdateInput) => {
  const categoryReviewPrefix = "Category requires admin review: ";
  if (error.startsWith(categoryReviewPrefix)) {
    const categoryKey = error.slice(categoryReviewPrefix.length);
    const categoryName = draft.categories.find((category) => category.categoryKey === categoryKey)?.categoryName;
    return `비목 검토가 필요합니다: ${categoryName || "이름 없는 비목"}`;
  }

  const evidenceReviewPrefix = "Evidence requires admin review: ";
  if (error.startsWith(evidenceReviewPrefix)) {
    const evidenceKey = error.slice(evidenceReviewPrefix.length);
    const evidenceName = draft.evidenceRequirements.find((evidence) => evidence.evidenceKey === evidenceKey)?.evidenceName;
    return `증빙서류 검토가 필요합니다: ${evidenceName || "이름 없는 증빙서류"}`;
  }

  const subcategoryReviewPrefix = "Subcategory requires admin review: ";
  if (error.startsWith(subcategoryReviewPrefix)) {
    const subcategoryKey = error.slice(subcategoryReviewPrefix.length);
    const subcategoryName = draft.subcategories.find((subcategory) => subcategory.subcategoryKey === subcategoryKey)?.subcategoryName;
    return `하위항목 검토가 필요합니다: ${subcategoryName || "이름 없는 하위항목"}`;
  }

  return error.replace(/\b(?:category|subcategory|evidence|document)_[a-z0-9_]+\b/g, "내부 항목");
};

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
        acceptedDocuments: evidence.acceptedDocuments,
        conditionText: evidence.conditionText,
        documentKey: evidence.documentKey,
        evidenceKey: evidence.evidenceKey,
        evidenceName: evidence.evidenceName,
        fulfillmentType: evidence.fulfillmentType,
        id: evidence.id,
        requirementType: evidence.requirementType,
        reviewStatus: evidence.reviewStatus,
        sourceReference: evidence.sourceReference,
        sortOrder: evidence.sortOrder,
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

  const blockingErrors = useMemo(() => draftQuery.data?.blockingErrors ?? [], [draftQuery.data?.blockingErrors]);
  const canEditDraft = draftQuery.data
    ? draftQuery.data.version.status !== "confirmed"
      && draftQuery.data.version.status !== "archived"
      && draftQuery.data.version.operationStatus !== "extraction_failed"
    : false;
  const canConfirm = Boolean(latestVersionId && canEditDraft);
  const latestStatus = statusQuery.data?.operationStatus ?? "legacy_fallback";
  const versionRows = statusQuery.data?.versions ?? [];
  const summary = useMemo(() => ({
    categories: draft.categories.length,
    evidence: draft.evidenceRequirements.length,
    subcategories: draft.subcategories.length,
  }), [draft]);
  const displayBlockingErrors = useMemo(
    () => blockingErrors.map((error) => formatBlockingError(error, draft)),
    [blockingErrors, draft],
  );

  const showExtractionError = (error: unknown) => {
    toast({
      title: "정책 추출에 실패했습니다.",
      description: extractApiErrorMessage(error, "기본 비목으로 시작하거나 텍스트를 붙여 넣어 다시 시도해 주세요."),
      variant: "destructive",
    });
  };

  const onExtract = async (versionId: string) => {
    try {
      await mutations.extractMutation.mutateAsync({ extractedText: extractedText || null, versionId });
      toast({ title: "정책 초안을 추출했습니다.", description: "추출된 비목과 증빙서류를 검토해 주세요." });
    } catch (error) {
      showExtractionError(error);
    }
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const intent = await mutations.uploadMutation.mutateAsync(file);
      toast({ title: "정책 PDF를 등록했습니다.", description: "비목/증빙서류 초안 버전을 생성했습니다." });
      try {
        await mutations.extractMutation.mutateAsync({ extractedText: null, versionId: intent.policyVersionId });
        toast({ title: "정책 초안을 추출했습니다.", description: "추출된 비목과 증빙서류를 검토해 주세요." });
      } catch (error) {
        showExtractionError(error);
      }
    } catch (error) {
      toast({ title: "정책 PDF를 등록하지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" });
    }
  };

  const onConfirmPolicy = async () => {
    try {
      await mutations.confirmMutation.mutateAsync();
      toast({ title: "정책을 확정했습니다.", description: "이제 지출 비목과 증빙서류가 확정된 정책을 따릅니다." });
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
              onClick={() => latestVersionId && void onExtract(latestVersionId)}
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
            placeholder="PDF 텍스트 추출이 실패했을 때만 추출된 텍스트를 붙여 넣어 다시 시도합니다."
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
                비목 {summary.categories}개 / 하위항목 {summary.subcategories}개 / 증빙서류 {summary.evidence}개
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
                <p className="mb-2 font-medium">검토 필요 항목이 있어도 정책 확정은 가능합니다. 확정 전 표 내용만 한 번 더 확인해 주세요.</p>
                {displayBlockingErrors.slice(0, 5).map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}
              </div>
            ) : null}

            {canEditDraft ? (
              <PolicyRowEditor draft={draft} onChange={setDraft} />
            ) : (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                이 정책 버전은 읽기 전용입니다. 다른 PDF를 업로드하면 새 초안을 만들 수 있습니다.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid gap-2">
          <p className="text-sm font-medium">버전</p>
          <div className="grid gap-2">
            {versionRows.length === 0 ? <p className="text-sm text-muted-foreground">아직 정책 버전이 없습니다.</p> : null}
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
  const updateCategoryName = (index: number, value: string) => {
    const categories = draft.categories.map((category, current) =>
      current === index ? { ...category, categoryName: value, reviewStatus: "auto_confident" as const } : category,
    );
    onChange({ ...draft, categories });
  };

  const updateSubcategoryName = (index: number, value: string) => {
    const subcategories = draft.subcategories.map((subcategory, current) =>
      current === index ? { ...subcategory, subcategoryName: value, reviewStatus: "auto_confident" as const } : subcategory,
    );
    onChange({ ...draft, subcategories });
  };

  const createInternalKey = (prefix: string, existingKeys: Set<string>) => {
    let index = existingKeys.size + 1;
    let candidate = `${prefix}_${index}`;
    while (existingKeys.has(candidate)) {
      index += 1;
      candidate = `${prefix}_${index}`;
    }
    return candidate;
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

  const deleteSubcategory = (index: number) => {
    const subcategoryKey = draft.subcategories[index]?.subcategoryKey;
    onChange({
      ...draft,
      evidenceRequirements: draft.evidenceRequirements.filter((evidence) => evidence.subcategoryKey !== subcategoryKey),
      subcategories: draft.subcategories.filter((_, current) => current !== index),
    });
  };

  const updateEvidence = (
    index: number,
    key: "evidenceName" | "requirementType",
    value: string,
  ) => {
    const evidenceRequirements = draft.evidenceRequirements.map((evidence, current) =>
      current === index
        ? {
            ...evidence,
            [key]: value,
            acceptedDocuments: key === "evidenceName" && (evidence.acceptedDocuments?.length ?? 0) <= 1
              ? [{ documentKey: evidence.documentKey ?? evidence.evidenceKey, label: value }]
              : evidence.acceptedDocuments,
            reviewStatus: "auto_confident" as const,
          }
        : evidence,
    );
    onChange({ ...draft, evidenceRequirements });
  };

  const deleteEvidence = (index: number) => {
    onChange({
      ...draft,
      evidenceRequirements: draft.evidenceRequirements.filter((_, current) => current !== index),
    });
  };

  const addCategory = () => {
    const existingCategoryKeys = new Set(draft.categories.map((category) => category.categoryKey));
    onChange({
      ...draft,
      categories: [...draft.categories, {
        categoryKey: createInternalKey("category_manual", existingCategoryKeys),
        categoryName: "",
        reviewStatus: "auto_confident",
        sortOrder: draft.categories.length,
        sourceReference: {},
      }],
    });
  };

  const addSubcategory = (categoryKey: string) => {
    const existingSubcategoryKeys = new Set(draft.subcategories.map((subcategory) => subcategory.subcategoryKey));
    const nextSubcategoryKey = createInternalKey("subcategory_manual", existingSubcategoryKeys);
    onChange({
      ...draft,
      subcategories: [...draft.subcategories, {
        categoryKey,
        reviewStatus: "auto_confident",
        sortOrder: draft.subcategories.filter((subcategory) => subcategory.categoryKey === categoryKey).length,
        sourceReference: {},
        subcategoryKey: nextSubcategoryKey,
        subcategoryName: "",
      }],
    });
  };

  const addEvidence = (categoryKey: string | null, subcategoryKey: string | null = null) => {
    const existingEvidenceKeys = new Set(draft.evidenceRequirements.map((evidence) => evidence.evidenceKey));
    const existingDocumentKeys = new Set(draft.evidenceRequirements.map((evidence) => evidence.documentKey).filter(Boolean) as string[]);
    const nextEvidenceKey = createInternalKey("evidence_manual", existingEvidenceKeys);
    const nextDocumentKey = createInternalKey("document_manual", existingDocumentKeys);
    onChange({
      ...draft,
      evidenceRequirements: [...draft.evidenceRequirements, {
        acceptedDocuments: [{ documentKey: nextDocumentKey, label: "" }],
        categoryKey,
        documentKey: nextDocumentKey,
        evidenceKey: nextEvidenceKey,
        evidenceName: "",
        fulfillmentType: "single",
        requirementType: "required",
        reviewStatus: "auto_confident",
        sortOrder: draft.evidenceRequirements.filter((evidence) =>
          evidence.categoryKey === categoryKey && (evidence.subcategoryKey ?? null) === subcategoryKey,
        ).length,
        sourceReference: {},
        subcategoryKey,
      }],
    });
  };

  const groupedRows = draft.categories.map((category, categoryIndex) => {
    const categorySubcategories = draft.subcategories
      .map((subcategory, subcategoryIndex) => ({ subcategory, subcategoryIndex }))
      .filter(({ subcategory }) => subcategory.categoryKey === category.categoryKey);
    const categoryCommonEvidence = draft.evidenceRequirements
      .map((evidence, evidenceIndex) => ({ evidence, evidenceIndex }))
      .filter(({ evidence }) => evidence.categoryKey === category.categoryKey && !evidence.subcategoryKey)
      .sort((left, right) => (left.evidence.sortOrder ?? 0) - (right.evidence.sortOrder ?? 0) || left.evidenceIndex - right.evidenceIndex);
    const subcategoryRows = categorySubcategories.map(({ subcategory, subcategoryIndex }) => ({
      evidenceItems: draft.evidenceRequirements
        .map((evidence, evidenceIndex) => ({ evidence, evidenceIndex }))
        .filter(({ evidence }) => evidence.categoryKey === category.categoryKey && evidence.subcategoryKey === subcategory.subcategoryKey)
        .sort((left, right) => (left.evidence.sortOrder ?? 0) - (right.evidence.sortOrder ?? 0) || left.evidenceIndex - right.evidenceIndex),
      kind: "subcategory" as const,
      label: subcategory.subcategoryName,
      subcategory,
      subcategoryIndex,
    }));

    return {
      category,
      categoryIndex,
      rows: [
        ...(categoryCommonEvidence.length > 0 || categorySubcategories.length === 0
          ? [{
              evidenceItems: categoryCommonEvidence,
              kind: "common" as const,
              label: categorySubcategories.length > 0 ? "공통(자동 포함)" : "비목 공통",
              subcategory: null,
              subcategoryIndex: -1,
            }]
          : []),
        ...subcategoryRows,
      ],
    };
  });
  const commonEvidence = draft.evidenceRequirements
    .map((evidence, evidenceIndex) => ({ evidence, evidenceIndex }))
    .filter(({ evidence }) => !evidence.categoryKey);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">비목별 집행 증빙서류</p>
          <p className="text-xs text-muted-foreground">PDF 표처럼 비목, 하위항목, 집행 증빙서류를 나란히 검토합니다.</p>
        </div>
        <Button onClick={addCategory} size="sm" type="button" variant="outline">
          <Plus className="mr-2 size-4" />
          비목 추가
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="hidden grid-cols-[minmax(170px,0.8fr)_minmax(160px,0.8fr)_minmax(0,2fr)] border-b bg-muted/50 text-xs font-medium text-muted-foreground md:grid">
          <div className="border-r px-3 py-2">비목</div>
          <div className="border-r px-3 py-2">하위항목</div>
          <div className="px-3 py-2">집행 증빙서류</div>
        </div>

        {groupedRows.map(({ category, categoryIndex, rows }) => (
          <div key={`${category.id ?? category.categoryKey}-${categoryIndex}`} className="border-b last:border-b-0">
            {rows.map((row, rowIndex) => (
              <div
                key={`${category.categoryKey}-${row.kind}-${row.subcategory?.subcategoryKey ?? "common"}`}
                className="grid gap-0 border-b last:border-b-0 md:grid-cols-[minmax(170px,0.8fr)_minmax(160px,0.8fr)_minmax(0,2fr)]"
              >
                <div className="grid content-start gap-2 border-b bg-muted/20 p-3 md:border-b-0 md:border-r">
                  {rowIndex === 0 ? (
                    <>
                      <div className="flex items-start gap-2">
                        <Input
                          aria-label="비목명"
                          className="bg-background"
                          value={category.categoryName}
                          onChange={(event) => updateCategoryName(categoryIndex, event.target.value)}
                        />
                        <Button aria-label="비목 삭제" onClick={() => deleteCategory(categoryIndex)} size="icon" type="button" variant="ghost">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <Badge className="w-fit" variant={category.reviewStatus === "auto_confident" ? "default" : "secondary"}>
                        {category.reviewStatus === "auto_confident" ? "검토 완료" : "검토 필요"}
                      </Badge>
                      <Button onClick={() => addSubcategory(category.categoryKey)} size="sm" type="button" variant="outline">
                        <Plus className="mr-2 size-4" />
                        하위항목 추가
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground md:sr-only">{category.categoryName}</span>
                  )}
                </div>

                <div className="grid content-start gap-2 border-b p-3 md:border-b-0 md:border-r">
                  {row.kind === "subcategory" ? (
                    <>
                      <div className="flex items-start gap-2">
                        <Input
                          aria-label={`${category.categoryName || "비목"} 하위항목`}
                          value={row.label}
                          onChange={(event) => updateSubcategoryName(row.subcategoryIndex, event.target.value)}
                        />
                        <Button aria-label="하위항목 삭제" onClick={() => deleteSubcategory(row.subcategoryIndex)} size="icon" type="button" variant="ghost">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <Badge className="w-fit" variant={row.subcategory?.reviewStatus === "auto_confident" ? "default" : "secondary"}>
                        {row.subcategory?.reviewStatus === "auto_confident" ? "검토 완료" : "검토 필요"}
                      </Badge>
                    </>
                  ) : (
                    <div className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
                      {row.label}
                    </div>
                  )}
                </div>

                <EvidenceList
                  addLabel="증빙서류 추가"
                  evidenceItems={row.evidenceItems}
                  onAdd={() => addEvidence(category.categoryKey, row.subcategory?.subcategoryKey ?? null)}
                  onDelete={deleteEvidence}
                  onUpdate={updateEvidence}
                  ownerLabel={row.kind === "subcategory" ? row.label : category.categoryName}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {commonEvidence.length > 0 ? (
        <div className="grid gap-2 rounded-md border p-3">
          <p className="text-sm font-medium">전체 공통 증빙서류</p>
          <EvidenceList
            addLabel="공통 증빙서류 추가"
            evidenceItems={commonEvidence}
            onAdd={() => addEvidence(null)}
            onDelete={deleteEvidence}
            onUpdate={updateEvidence}
            ownerLabel="공통"
          />
        </div>
      ) : null}
    </div>
  );
}

function EvidenceList({
  addLabel,
  evidenceItems,
  onAdd,
  onDelete,
  onUpdate,
  ownerLabel,
}: {
  addLabel: string;
  evidenceItems: Array<{ evidence: PolicyDraftUpdateInput["evidenceRequirements"][number]; evidenceIndex: number }>;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onUpdate: (index: number, key: "evidenceName" | "requirementType", value: string) => void;
  ownerLabel: string;
}) {
  return (
    <div className="grid gap-2 p-3">
      {evidenceItems.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">연결된 증빙서류가 없습니다.</p>
      ) : null}

      {evidenceItems.map(({ evidence, evidenceIndex }, rowIndex) => (
        <div key={`${evidence.id ?? evidence.evidenceKey}-${evidenceIndex}`} className="grid gap-2 md:grid-cols-[2rem_minmax(0,1fr)_9rem_2.5rem]">
          <div className="flex h-10 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">
            {rowIndex + 1}
          </div>
          <Input
            aria-label={`${ownerLabel || "항목"} 증빙서류 ${rowIndex + 1}`}
            value={evidence.evidenceName}
            onChange={(event) => onUpdate(evidenceIndex, "evidenceName", event.target.value)}
          />
          <select
            aria-label="증빙 필수 여부"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={evidence.requirementType}
            onChange={(event) => onUpdate(evidenceIndex, "requirementType", event.target.value)}
          >
            <option value="required">필수</option>
            <option value="conditional">조건부</option>
            <option value="optional">선택</option>
          </select>
          <Button aria-label="증빙서류 삭제" onClick={() => onDelete(evidenceIndex)} size="icon" type="button" variant="ghost">
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <div>
        <Button onClick={onAdd} size="sm" type="button" variant="outline">
          <FileUp className="mr-2 size-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
