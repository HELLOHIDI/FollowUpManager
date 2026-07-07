"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2, ChevronDown, Download, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyPanel, PageHeading } from "@/components/product-shell";
import {
  EXPENSE_FUNDING_SOURCE_OPTIONS,
  EXPENSE_STAGES,
  getExpenseStageIndex,
  type ExpenseStageKey,
} from "@/features/domain/contracts";
import { routes } from "@/constants/routes";
import { extractApiErrorMessage } from "@/lib/remote/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type ExpenseDetailResponse, type ExpenseUpdateInput } from "../backend/schema";
import {
  useExpenseDetailMutations,
  useExpenseDetailQuery,
  useExpenseStageMutation,
} from "../hooks/use-expenses-query";
import {
  executionProgressStatuses,
  executionRequestStatuses,
  expenseStageDetailCopy,
  expenseStageFieldLabels,
  expenseProcedureSteps,
  preApprovalStatuses,
} from "../lib/expense-detail-policy";
import { requiresSubcategorySelection } from "../lib/policy-category-options";
import { getProjectDocumentSignedUrl } from "@/features/projects/api";
import { useProjectEvidenceTemplateDownloadsQuery } from "@/features/projects/hooks/use-projects";
import type { ProjectEvidenceTemplateDownload } from "@/features/projects/lib/dto";

type FormValues = ExpenseUpdateInput;
type DetailEvidenceDocumentOption = { key: string; label: string; source?: "policy" | "custom" };

const selectedOrNone = (value: string | null | undefined) => value ?? "none";
const noneToNull = (value: string) => (value === "none" ? null : value);
const downloadProjectTemplate = async (projectId: string, template: ProjectEvidenceTemplateDownload) => {
  const { signedUrl } = await getProjectDocumentSignedUrl(projectId, template.id);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Template download failed");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = template.originalFileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const policyEvidenceOptionsFromSnapshot = (policySnapshot: ExpenseDetailResponse["policySnapshot"]): DetailEvidenceDocumentOption[] => {
  const requirements = policySnapshot?.evidence_requirements;
  if (!Array.isArray(requirements)) return [];

  const uniqueOptions = new Map<string, DetailEvidenceDocumentOption>();
  for (const requirement of requirements) {
    if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) continue;
    const row = requirement as Record<string, unknown>;
    const acceptedDocuments = Array.isArray(row.accepted_documents) ? row.accepted_documents : [];
    for (const document of acceptedDocuments) {
      if (!document || typeof document !== "object" || Array.isArray(document)) continue;
      const accepted = document as Record<string, unknown>;
      const acceptedKey = typeof accepted.documentKey === "string" ? accepted.documentKey : null;
      if (!acceptedKey) continue;
      uniqueOptions.set(acceptedKey, {
        key: acceptedKey,
        label: typeof accepted.label === "string" ? accepted.label : acceptedKey,
      });
    }
    const key = typeof row.document_key === "string" ? row.document_key : typeof row.evidence_key === "string" ? row.evidence_key : null;
    if (!key) continue;
    const label = typeof row.evidence_name === "string" ? row.evidence_name : key;
    uniqueOptions.set(key, { key, label });
  }

  return [...uniqueOptions.values()];
};

export function ExpenseDetailPageContent({ projectId, expenseId }: { projectId: string; expenseId: string }) {
  const { toast } = useToast();
  const [selectedStageKey, setSelectedStageKey] = useState<ExpenseStageKey | null>(null);
  const query = useExpenseDetailQuery(projectId, expenseId);
  const templateDownloadsQuery = useProjectEvidenceTemplateDownloadsQuery(projectId);
  const { updateMutation } = useExpenseDetailMutations(projectId, expenseId);
  const stageMutation = useExpenseStageMutation(projectId);

  const form = useForm<FormValues>({
    defaultValues: {
      amount: 0,
      categoryKey: "",
      subcategoryKey: null,
      executionProgressStatus: null,
      executionRequestDate: null,
      executionRequestStatus: null,
      expectedSpendDate: null,
      fundingSourceKey: "government_subsidy",
      memo: null,
      preApprovalStatus: null,
      stageFields: {},
      title: "",
      vendorName: null,
    },
  });

  useEffect(() => {
    if (!query.data) return;
    setSelectedStageKey((current) => current ?? query.data.stageKey);
    form.reset({
      amount: query.data.amount,
      categoryKey: query.data.categoryKey,
      subcategoryKey: query.data.subcategoryKey ?? null,
      executionProgressStatus: query.data.executionProgressStatus,
      executionRequestDate: query.data.executionRequestDate,
      executionRequestStatus: query.data.executionRequestStatus,
      expectedSpendDate: query.data.expectedSpendDate,
      fundingSourceKey: query.data.fundingSourceKey,
      memo: query.data.memo,
      preApprovalStatus: query.data.preApprovalStatus,
      stageFields: query.data.stageFields,
      title: query.data.title,
      vendorName: query.data.vendorName,
    });
  }, [form, query.data]);

  if (query.isPending) {
    return (
      <div className="grid gap-4">
        <div className="h-16 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyPanel
        title="지출 정보를 불러오지 못했습니다"
        description={extractApiErrorMessage(query.error, "잠시 후 다시 시도해 주세요.")}
        action={<Button onClick={() => void query.refetch()} variant="outline">다시 시도</Button>}
      />
    );
  }

  if (!query.data) return null;

  const currentStageIndex = getExpenseStageIndex(query.data.stageKey);
  const currentStageLabel = EXPENSE_STAGES[currentStageIndex]?.label ?? query.data.stageKey;
  const selectedStage = selectedStageKey ?? query.data.stageKey;
  const selectedStageIndex = getExpenseStageIndex(selectedStage);
  const selectedStageLabel = EXPENSE_STAGES[selectedStageIndex]?.label ?? selectedStage;
  const snapshotDocumentOptions = policyEvidenceOptionsFromSnapshot(query.data.policySnapshot);
  const requiredDocumentKeys = new Set(snapshotDocumentOptions.map((option) => option.key));
  const templateDownloads = (templateDownloadsQuery.data ?? []).filter((template) => requiredDocumentKeys.has(template.documentKey));

  const handleSave = form.handleSubmit(async (values) => {
    const selectedCategory = query.data.categoryOptions.find((option) => option.categoryKey === values.categoryKey);
    if (requiresSubcategorySelection(selectedCategory) && !values.subcategoryKey) {
      form.setError("subcategoryKey", { message: "하위비목을 선택해 주세요.", type: "required" });
      toast({ title: "저장할 수 없습니다.", description: "선택한 비목의 하위비목을 선택해 주세요.", variant: "destructive" });
      return;
    }
    form.clearErrors("subcategoryKey");
    try {
      await updateMutation.mutateAsync(values);
      toast({ title: "저장했습니다", description: "지출 상세 정보가 반영되었습니다." });
    } catch (error) {
      toast({
        title: "저장하지 못했습니다",
        description: extractApiErrorMessage(error, "잠시 후 다시 시도해 주세요."),
        variant: "destructive",
      });
    }
  });

  const handleMoveSelectedStage = async () => {
    if (selectedStage === query.data.stageKey) return;
    try {
      await stageMutation.mutateAsync({ expenseId, input: { targetStageKey: selectedStage } });
      toast({ title: "단계를 변경했습니다", description: "지출 진행 단계가 업데이트되었습니다." });
    } catch (error) {
      toast({
        title: "단계를 변경하지 못했습니다",
        description: extractApiErrorMessage(error, "잠시 후 다시 시도해 주세요."),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <PageHeading
        title={query.data.title}
        description={`${currentStageLabel} 단계의 지출 상세 정보를 관리합니다.`}
        backHref={routes.project(projectId)}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            {selectedStage !== query.data.stageKey ? (
              <Button type="button" variant="outline" onClick={() => void handleMoveSelectedStage()} disabled={stageMutation.isPending}>
                이 단계로 이동
              </Button>
            ) : null}
            <Button type="button" onClick={() => void handleSave()} disabled={updateMutation.isPending}>
              저장
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <StageStepper
          currentStageIndex={currentStageIndex}
          onSelectStage={setSelectedStageKey}
          selectedStageKey={selectedStage}
        />

        <Card className="shadow-xs">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{selectedStageLabel}</CardTitle>
                <CardDescription>선택한 단계에서 필요한 업무절차만 확인하고 완료 처리합니다.</CardDescription>
              </div>
              <Badge variant="info">현재 단계: {currentStageLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <BasicInfoFields form={form} categoryOptions={query.data.categoryOptions} />
            <EnterpriseFormsToggle projectId={projectId} templateDownloads={templateDownloads} />
            <StageSection
              control={form.control}
              form={form}
              isCurrent={selectedStage === query.data.stageKey}
              isEditable
              stageKey={selectedStage}
              stageLabel={selectedStageLabel}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function BasicInfoFields({
  categoryOptions,
  form,
}: {
  categoryOptions: ExpenseDetailResponse["categoryOptions"];
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  const selectedCategoryKey = form.watch("categoryKey");
  const selectedCategory = categoryOptions.find((option) => option.categoryKey === selectedCategoryKey);
  const subcategoryOptions = useMemo(() => selectedCategory?.subcategories ?? [], [selectedCategory]);

  useEffect(() => {
    const currentSubcategoryKey = form.getValues("subcategoryKey");
    if (!currentSubcategoryKey) return;
    if (subcategoryOptions.some((option) => option.subcategoryKey === currentSubcategoryKey)) return;
    form.setValue("subcategoryKey", null);
  }, [form, selectedCategoryKey, subcategoryOptions]);

  return (
    <section className="rounded-md border bg-muted/20 p-4" aria-labelledby="expense-basic-info-title">
      <h2 id="expense-basic-info-title" className="mb-4 text-base font-semibold">기본 정보</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="expense-title" label="지출 제목">
          <Input id="expense-title" {...form.register("title", { required: true })} />
        </Field>
        <Field id="expense-category" label="비목">
          <Controller
            control={form.control}
            name="categoryKey"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="expense-category">
                  <SelectValue placeholder="비목을 선택해 주세요" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.categoryKey} value={option.categoryKey}>
                      {option.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        {subcategoryOptions.length > 0 ? (
          <Field id="expense-subcategory" label="하위비목">
            <Controller
              control={form.control}
              name="subcategoryKey"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(value) => field.onChange(value || null)}>
                  <SelectTrigger id="expense-subcategory">
                    <SelectValue placeholder="하위비목을 선택해 주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategoryOptions.map((option) => (
                      <SelectItem key={option.subcategoryKey} value={option.subcategoryKey}>
                        {option.subcategoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
          />
          {form.formState.errors.subcategoryKey?.message ? (
            <p className="text-sm text-destructive">{form.formState.errors.subcategoryKey.message}</p>
          ) : null}
        </Field>
      ) : null}
        <Field id="expense-amount" label="금액">
          <Input id="expense-amount" type="number" min={0} {...form.register("amount", { valueAsNumber: true })} />
        </Field>
        <Field id="expense-funding-source" label="재원 구분">
          <Controller
            control={form.control}
            name="fundingSourceKey"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="expense-funding-source">
                  <SelectValue placeholder="재원 구분을 선택해 주세요" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_FUNDING_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.fundingSourceKey} value={option.fundingSourceKey}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="expense-expected-spend-date" label="예상 지출일">
          <DateInput control={form.control} id="expense-expected-spend-date" name="expectedSpendDate" />
        </Field>
        <Field id="expense-vendor-name" label="거래처명">
          <Input id="expense-vendor-name" {...form.register("vendorName")} />
        </Field>
        <Field id="expense-memo" label="메모" className="sm:col-span-2">
          <Textarea id="expense-memo" rows={4} {...form.register("memo")} />
        </Field>
      </div>
    </section>
  );
}

function StageStepper({
  currentStageIndex,
  onSelectStage,
  selectedStageKey,
}: {
  currentStageIndex: number;
  onSelectStage: (stageKey: ExpenseStageKey) => void;
  selectedStageKey: ExpenseStageKey;
}) {
  return (
    <aside className="rounded-md border bg-card p-3">
      <ol aria-label="지출 5단계 진행 상태" className="space-y-2">
        {EXPENSE_STAGES.map((stage, index) => {
          const isCurrent = index === currentStageIndex;
          const isSelected = stage.key === selectedStageKey;

          return (
            <li key={stage.key}>
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                  isCurrent ? "border-primary/30 bg-gradient-to-r from-primary/15 to-info/10" : "bg-background hover:bg-muted/60",
                  isSelected ? "ring-2 ring-primary/25" : null,
                )}
                onClick={() => onSelectStage(stage.key)}
              >
                <span className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  isCurrent ? "border-primary bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{stage.label}</span>
                  <span className="block text-xs text-muted-foreground">{isCurrent ? "현재 단계" : "단계 보기"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function Field({ children, className, id, label }: { children: React.ReactNode; className?: string; id?: string; label: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function DateInput({
  control,
  id,
  name,
  readOnly,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  id: string;
  name: "expectedSpendDate" | "executionRequestDate";
  readOnly?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          id={id}
          readOnly={readOnly}
          type="date"
          value={field.value ?? ""}
          onChange={(event) => field.onChange(event.target.value || null)}
        />
      )}
    />
  );
}

function EnterpriseFormsToggle({
  projectId,
  templateDownloads,
}: {
  projectId: string;
  templateDownloads: ProjectEvidenceTemplateDownload[];
}) {
  const { toast } = useToast();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openTemplate = async (template: ProjectEvidenceTemplateDownload) => {
    setOpeningId(template.id);
    try {
      const { signedUrl } = await getProjectDocumentSignedUrl(projectId, template.id);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "기업양식을 열지 못했습니다",
        description: extractApiErrorMessage(error, "잠시 후 다시 시도해 주세요."),
        variant: "destructive",
      });
    } finally {
      setOpeningId(null);
    }
  };

  const downloadTemplate = async (template: ProjectEvidenceTemplateDownload) => {
    setOpeningId(template.id);
    try {
      await downloadProjectTemplate(projectId, template);
    } catch (error) {
      toast({
        title: "기업양식을 다운로드하지 못했습니다",
        description: extractApiErrorMessage(error, "잠시 후 다시 시도해 주세요."),
        variant: "destructive",
      });
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <details className="rounded-md border bg-background p-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="text-sm font-semibold">기업양식</h2>
          <p className="mt-1 text-xs text-muted-foreground">연결된 기업 양식은 보기와 다운로드만 가능합니다.</p>
        </div>
        <Badge variant="info">{templateDownloads.length}개</Badge>
      </summary>
      <div className="mt-4 divide-y rounded-md border">
        {templateDownloads.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">연결된 기업양식이 없습니다.</p>
        ) : templateDownloads.map((template) => (
          <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0 truncate text-sm font-medium">{template.originalFileName}</span>
            <span className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="outline" aria-label={`${template.originalFileName} 보기`} onClick={() => void openTemplate(template)} disabled={openingId === template.id}>
                <ExternalLink className="mr-2 size-3" aria-hidden="true" />
                보기
              </Button>
              <Button type="button" size="sm" variant="outline" aria-label={`${template.originalFileName} 다운로드`} onClick={() => void downloadTemplate(template)} disabled={openingId === template.id}>
                {openingId === template.id ? <Loader2 className="mr-2 size-3 animate-spin" aria-hidden="true" /> : <Download className="mr-2 size-3" aria-hidden="true" />}
                다운로드
              </Button>
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

function StageSection({
  control,
  form,
  isCurrent,
  isEditable,
  stageKey,
  stageLabel,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  form: ReturnType<typeof useForm<FormValues>>;
  isCurrent: boolean;
  isEditable: boolean;
  stageKey: ExpenseStageKey;
  stageLabel: string;
}) {
  const copy = expenseStageDetailCopy[stageKey];

  return (
    <section className={cn("rounded-md border p-4", isCurrent ? "border-primary/40 bg-primary/5" : "bg-background")} aria-labelledby={`stage-${stageKey}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`stage-${stageKey}`} className="text-sm font-semibold">{stageLabel}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.description}</p>
        </div>
        <Badge className="shrink-0" variant={isCurrent ? "info" : "outline"}>{isCurrent ? "현재 단계" : "미리보기"}</Badge>
      </div>

      <div className="mt-4 space-y-4">
        <ProcedureChecklist form={form} isEditable={isEditable} stageKey={stageKey} />
        <StageStatusFields control={control} isEditable={isEditable} stageKey={stageKey} />

        {copy.fields.length > 0 ? (
          <div className="grid gap-4">
            {copy.fields.map((fieldKey) => (
              <Field key={fieldKey} id={`expense-stage-${stageKey}-${fieldKey}`} label={expenseStageFieldLabels[fieldKey]}>
                <Textarea id={`expense-stage-${stageKey}-${fieldKey}`} readOnly={!isEditable} rows={3} {...form.register(`stageFields.${fieldKey}`)} />
              </Field>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProcedureChecklist({
  form,
  isEditable,
  stageKey,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  isEditable: boolean;
  stageKey: ExpenseStageKey;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <h3 className="text-sm font-semibold">업무절차</h3>
      <div className="grid gap-2">
        {expenseProcedureSteps.map((step) => (
          <div key={step.key} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[minmax(0,1fr)_160px_minmax(180px,1fr)] md:items-center">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                disabled={!isEditable}
                {...form.register(`stageFields.procedures.${stageKey}.${step.key}.completed`)}
              />
              {step.label}
            </label>
            <Input
              type="date"
              disabled={!isEditable}
              {...form.register(`stageFields.procedures.${stageKey}.${step.key}.completedDate`, {
                setValueAs: (value) => value || null,
              })}
            />
            <Input
              placeholder="메모"
              disabled={!isEditable}
              {...form.register(`stageFields.procedures.${stageKey}.${step.key}.memo`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StageStatusFields({
  control,
  isEditable,
  stageKey,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  isEditable: boolean;
  stageKey: ExpenseStageKey;
}) {
  if (stageKey === "pre_approval") {
    return (
      <Field id="expense-pre-approval-status" label="승인 상태">
        <Controller
          control={control}
          name="preApprovalStatus"
          render={({ field }) => (
            <Select disabled={!isEditable} value={selectedOrNone(field.value)} onValueChange={(value) => field.onChange(noneToNull(value))}>
              <SelectTrigger id="expense-pre-approval-status"><SelectValue placeholder="승인 상태 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">미입력</SelectItem>
                {preApprovalStatuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
    );
  }

  if (stageKey === "execution_in_progress") {
    return (
      <Field id="expense-execution-progress-status" label="수행 상태">
        <Controller
          control={control}
          name="executionProgressStatus"
          render={({ field }) => (
            <Select disabled={!isEditable} value={selectedOrNone(field.value)} onValueChange={(value) => field.onChange(noneToNull(value))}>
              <SelectTrigger id="expense-execution-progress-status"><SelectValue placeholder="수행 상태 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">미입력</SelectItem>
                {executionProgressStatuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
    );
  }

  if (stageKey === "execution_request") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="expense-execution-request-status" label="집행 요청 상태">
          <Controller
            control={control}
            name="executionRequestStatus"
            render={({ field }) => (
              <Select disabled={!isEditable} value={selectedOrNone(field.value)} onValueChange={(value) => field.onChange(noneToNull(value))}>
                <SelectTrigger id="expense-execution-request-status"><SelectValue placeholder="집행 요청 상태 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미입력</SelectItem>
                  {executionRequestStatuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="expense-execution-request-date" label="집행 요청일">
          <DateInput control={control} id="expense-execution-request-date" name="executionRequestDate" readOnly={!isEditable} />
        </Field>
      </div>
    );
  }

  return null;
}
