"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2, ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
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
  getNextExpenseStageKey,
  type ExpenseStageKey,
} from "@/features/domain/contracts";
import { routes } from "@/constants/routes";
import { extractApiErrorMessage } from "@/lib/remote/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EVIDENCE_DOCUMENT_OPTIONS, type ExpenseDetailResponse, type ExpenseEvidenceFileResponse, type ExpenseUpdateInput } from "../backend/schema";
import {
  useExpenseEvidenceMutations,
  useExpenseEvidenceQuery,
  useExpenseDetailMutations,
  useExpenseDetailQuery,
  useExpenseHistoryQuery,
  useExpenseStageMutation,
} from "../hooks/use-expenses-query";
import {
  evidenceOptionsForStage,
  executionProgressStatuses,
  executionRequestStatuses,
  expenseStageDetailCopy,
  expenseStageFieldLabels,
  preApprovalStatuses,
} from "../lib/expense-detail-policy";

type FormValues = ExpenseUpdateInput;
type DetailEvidenceDocumentOption = { key: string; label: string };

const selectedOrNone = (value: string | null | undefined) => value ?? "none";
const noneToNull = (value: string) => (value === "none" ? null : value);
const policyEvidenceOptionsFromSnapshot = (policySnapshot: ExpenseDetailResponse["policySnapshot"]): DetailEvidenceDocumentOption[] => {
  const requirements = policySnapshot?.evidence_requirements;
  if (!Array.isArray(requirements)) return [];

  const uniqueOptions = new Map<string, DetailEvidenceDocumentOption>();
  for (const requirement of requirements) {
    if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) continue;
    const row = requirement as Record<string, unknown>;
    const key = typeof row.document_key === "string" ? row.document_key : typeof row.evidence_key === "string" ? row.evidence_key : null;
    if (!key) continue;
    const label = typeof row.evidence_name === "string" ? row.evidence_name : key;
    uniqueOptions.set(key, { key, label });
  }

  return [...uniqueOptions.values()];
};

export function ExpenseDetailPageContent({ projectId, expenseId }: { projectId: string; expenseId: string }) {
  const { toast } = useToast();
  const query = useExpenseDetailQuery(projectId, expenseId);
  const evidenceQuery = useExpenseEvidenceQuery(projectId, expenseId);
  const historyQuery = useExpenseHistoryQuery(projectId, expenseId);
  const { updateMutation } = useExpenseDetailMutations(projectId, expenseId);
  const evidenceMutations = useExpenseEvidenceMutations(projectId, expenseId);
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
  const nextStageKey = getNextExpenseStageKey(query.data.stageKey);
  const currentStageLabel = EXPENSE_STAGES[currentStageIndex]?.label ?? query.data.stageKey;
  const policyDocumentOptions = policyEvidenceOptionsFromSnapshot(query.data.policySnapshot);

  const handleSave = form.handleSubmit(async (values) => {
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

  const handleMoveNext = async () => {
    if (!nextStageKey) return;
    try {
      await stageMutation.mutateAsync({ expenseId, input: { targetStageKey: nextStageKey } });
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
        eyebrow={`지출 ${expenseId}`}
        title={query.data.title}
        description={`${currentStageLabel} 단계의 지출 상세 정보를 관리합니다.`}
        backHref={routes.project(projectId)}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            {nextStageKey ? (
              <Button type="button" variant="outline" onClick={() => void handleMoveNext()} disabled={stageMutation.isPending}>
                다음 단계
              </Button>
            ) : null}
            <Button type="button" onClick={() => void handleSave()} disabled={updateMutation.isPending}>
              저장
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <StageStepper currentStageIndex={currentStageIndex} />

        <Card className="shadow-xs">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">지출 상세</CardTitle>
                <CardDescription>기본 정보, 단계 입력, 증빙과 변경 이력을 한 흐름에서 관리합니다.</CardDescription>
              </div>
              <Badge variant="info">{currentStageLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <BasicInfoFields form={form} categoryOptions={query.data.categoryOptions} />
            <PolicyEvidenceSummary policySnapshot={query.data.policySnapshot} />

            <div className="space-y-4">
              {EXPENSE_STAGES.map((stage, index) => (
                <StageSection
                  key={stage.key}
                  control={form.control}
                  form={form}
                  deleteMutation={evidenceMutations.deleteMutation}
                  evidenceQuery={evidenceQuery}
                  isCurrent={stage.key === query.data.stageKey}
                  isEditable={index <= currentStageIndex}
                  policyDocumentOptions={policyDocumentOptions}
                  signedUrlMutation={evidenceMutations.signedUrlMutation}
                  stageKey={stage.key}
                  stageLabel={stage.label}
                  uploadMutation={evidenceMutations.uploadMutation}
                />
              ))}
            </div>

            <ValidationSection />
            <HistorySection historyQuery={historyQuery} />
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

function PolicyEvidenceSummary({ policySnapshot }: { policySnapshot: ExpenseDetailResponse["policySnapshot"] }) {
  const requirements = policyEvidenceOptionsFromSnapshot(policySnapshot);
  if (requirements.length === 0) return null;

  return (
    <section className="rounded-md border bg-primary/5 p-4" aria-labelledby="expense-policy-evidence-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="expense-policy-evidence-title" className="text-sm font-semibold">정책 증빙서류</h2>
          <p className="mt-1 text-xs text-muted-foreground">확정된 사업 정책에서 이 지출에 저장된 증빙 요구사항입니다.</p>
        </div>
        <Badge variant="info">{requirements.length}개</Badge>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {requirements.map((requirement) => (
          <li key={requirement.key} className="rounded-md border bg-background px-3 py-2 text-sm">
            {requirement.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StageStepper({ currentStageIndex }: { currentStageIndex: number }) {
  return (
    <ol className="grid gap-2 rounded-md border bg-card p-3 md:grid-cols-5" aria-label="지출 5단계 진행 상태">
      {EXPENSE_STAGES.map((stage, index) => {
        const isDone = index < currentStageIndex;
        const isCurrent = index === currentStageIndex;
        return (
          <li
            key={stage.key}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              isCurrent && "border-primary bg-primary/10 text-primary",
              isDone && "border-success/30 bg-success/10 text-success",
              !isDone && !isCurrent && "bg-muted/30 text-muted-foreground",
            )}
          >
            <div className="flex items-center gap-2">
              {isDone ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <span className="font-semibold tabular-nums">{index + 1}</span>}
              <span className="font-medium">{stage.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ children, className, id, label }: { children: React.ReactNode; className?: string; id?: string; label: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function DateInput({
  control,
  id,
  name,
  readOnly = false,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  id?: string;
  name: "executionRequestDate" | "expectedSpendDate";
  readOnly?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          id={id}
          type="date"
          name={field.name}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(event.target.value || null)}
          readOnly={readOnly}
          ref={field.ref}
          value={field.value ?? ""}
        />
      )}
    />
  );
}

type EvidenceMutation<TInput, TData> = {
  isPending: boolean;
  mutateAsync: (input: TInput) => Promise<TData>;
};

function ExpenseEvidencePanel({
  deleteMutation,
  documentOptions,
  evidenceQuery,
  fieldId,
  signedUrlMutation,
  uploadMutation,
}: {
  deleteMutation: EvidenceMutation<string, unknown>;
  documentOptions: DetailEvidenceDocumentOption[];
  evidenceQuery: ReturnType<typeof useExpenseEvidenceQuery>;
  fieldId: string;
  signedUrlMutation: EvidenceMutation<string, { signedUrl?: string }>;
  uploadMutation: EvidenceMutation<{ documentKey: string; file: File; requirementKey?: string | null }, unknown>;
}) {
  const { toast } = useToast();
  const [documentKey, setDocumentKey] = useState(documentOptions[0]?.key ?? "etc");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const visibleDocumentKeys = useMemo<Set<string>>(() => new Set(documentOptions.map((option) => option.key)), [documentOptions]);
  const files = evidenceQuery.data?.files.filter((file) => visibleDocumentKeys.has(file.documentKey)) ?? [];

  useEffect(() => {
    if (!visibleDocumentKeys.has(documentKey)) {
      setDocumentKey(documentOptions[0]?.key ?? "etc");
    }
  }, [documentKey, documentOptions, visibleDocumentKeys]);

  const handleUpload = async (filesToUpload: FileList | null) => {
    const selectedFiles = Array.from(filesToUpload ?? []);
    for (const file of selectedFiles) {
      try {
        await uploadMutation.mutateAsync({ documentKey, file });
      } catch (error) {
        toast({
          title: "증빙을 추가하지 못했습니다",
          description: extractApiErrorMessage(error, "파일 형식과 크기를 확인해 주세요."),
          variant: "destructive",
        });
      }
    }
  };

  const openEvidence = async (evidence: ExpenseEvidenceFileResponse) => {
    setOpeningId(evidence.id);
    try {
      const { signedUrl } = await signedUrlMutation.mutateAsync(evidence.id);
      if (!signedUrl) throw new Error("Missing signed URL");
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "증빙을 열지 못했습니다",
        description: extractApiErrorMessage(error, "잠시 후 다시 시도해 주세요."),
        variant: "destructive",
      });
    } finally {
      setOpeningId(null);
    }
  };

  const removeEvidence = async (evidence: ExpenseEvidenceFileResponse) => {
    try {
      await deleteMutation.mutateAsync(evidence.id);
    } catch (error) {
      toast({
        title: "증빙을 삭제하지 못했습니다",
        description: extractApiErrorMessage(error, "잠시 후 다시 시도해 주세요."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label htmlFor={fieldId}>증빙 유형</Label>
        <Select value={documentKey} onValueChange={(value) => setDocumentKey(value as typeof documentKey)}>
          <SelectTrigger id={fieldId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {documentOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
        {uploadMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
        파일 추가
        <Input
          className="sr-only"
          disabled={uploadMutation.isPending}
          multiple
          type="file"
          accept=".pdf,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.zip"
          onChange={(event) => {
            void handleUpload(event.target.files).finally(() => {
              event.target.value = "";
            });
          }}
        />
      </label>

      {evidenceQuery.isPending ? <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
      {evidenceQuery.isError ? (
        <div className="space-y-2 rounded-md border border-dashed p-3" role="alert">
          <p className="text-sm text-muted-foreground">증빙 목록을 불러오지 못했습니다.</p>
          <Button onClick={() => void evidenceQuery.refetch()} size="sm" type="button" variant="outline">
            다시 시도
          </Button>
        </div>
      ) : null}
      {files.length === 0 && !evidenceQuery.isPending && !evidenceQuery.isError ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">등록된 증빙 파일이 없습니다.</p>
      ) : null}
      {files.length ? (
        <ul className="divide-y rounded-md border">
          {files.map((evidence) => (
            <li className="flex items-center justify-between gap-3 p-3" key={evidence.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{evidence.originalFileName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {EVIDENCE_DOCUMENT_OPTIONS.find((option) => option.key === evidence.documentKey)?.label ?? evidence.documentKey} ·{" "}
                  {Math.ceil(evidence.fileSize / 1024).toLocaleString("ko-KR")}KB ·{" "}
                  {new Date(evidence.uploadedAt).toLocaleDateString("ko-KR")}
                </p>
                {evidence.duplicateStatus === "possible_duplicate" ? (
                  <Badge className="mt-2" variant="warning">
                    중복 가능
                  </Badge>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  aria-label={`${evidence.originalFileName} 새 창에서 열기`}
                  disabled={openingId === evidence.id}
                  onClick={() => void openEvidence(evidence)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  {openingId === evidence.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ExternalLink className="size-4" aria-hidden="true" />}
                </Button>
                <Button
                  aria-label={`${evidence.originalFileName} 삭제`}
                  disabled={deleteMutation.isPending}
                  onClick={() => void removeEvidence(evidence)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StageSection({
  control,
  deleteMutation,
  evidenceQuery,
  form,
  isCurrent,
  isEditable,
  policyDocumentOptions,
  signedUrlMutation,
  stageKey,
  stageLabel,
  uploadMutation,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  deleteMutation: EvidenceMutation<string, unknown>;
  evidenceQuery: ReturnType<typeof useExpenseEvidenceQuery>;
  form: ReturnType<typeof useForm<FormValues>>;
  isCurrent: boolean;
  isEditable: boolean;
  policyDocumentOptions: DetailEvidenceDocumentOption[];
  signedUrlMutation: EvidenceMutation<string, { signedUrl?: string }>;
  stageKey: ExpenseStageKey;
  stageLabel: string;
  uploadMutation: EvidenceMutation<{ documentKey: string; file: File; requirementKey?: string | null }, unknown>;
}) {
  const copy = expenseStageDetailCopy[stageKey];
  const documentOptions = useMemo<DetailEvidenceDocumentOption[]>(
    () => policyDocumentOptions.length > 0 ? policyDocumentOptions : evidenceOptionsForStage(stageKey),
    [policyDocumentOptions, stageKey],
  );

  return (
    <section className={cn("rounded-md border p-4", isCurrent ? "border-primary/40 bg-primary/5" : "bg-background")} aria-labelledby={`stage-${stageKey}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id={`stage-${stageKey}`} className="text-sm font-semibold">{stageLabel}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{copy.description}</p>
        </div>
        <Badge variant={isCurrent ? "info" : isEditable ? "secondary" : "outline"}>{isCurrent ? "현재 단계" : isEditable ? "입력 가능" : "예정"}</Badge>
      </div>

      <div className="space-y-4">
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

        <div className="border-t pt-4">
          <div className="mb-3">
            <h4 className="text-sm font-semibold">증빙 파일</h4>
            <p className="mt-1 text-xs text-muted-foreground">이 단계에 필요한 증빙을 추가합니다.</p>
          </div>
          <ExpenseEvidencePanel
            deleteMutation={deleteMutation}
            documentOptions={documentOptions}
            evidenceQuery={evidenceQuery}
            fieldId={`expense-evidence-document-key-${stageKey}`}
            signedUrlMutation={signedUrlMutation}
            uploadMutation={uploadMutation}
          />
        </div>
      </div>
    </section>
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

function ValidationSection() {
  return (
    <section className="rounded-md border border-warning/30 bg-warning/10 p-4" aria-labelledby="expense-validation-title">
      <h2 id="expense-validation-title" className="text-sm font-semibold">검증 메시지</h2>
      <p className="mt-1 text-sm text-muted-foreground">단계별 필수 입력과 증빙 검증 메시지는 이 영역에 누적됩니다.</p>
    </section>
  );
}

function HistorySection({
  historyQuery,
}: {
  historyQuery: ReturnType<typeof useExpenseHistoryQuery>;
}) {
  return (
    <section className="rounded-md border p-4" aria-labelledby="expense-history-title">
      <h2 id="expense-history-title" className="text-sm font-semibold">변경 이력</h2>
      {historyQuery.isPending ? (
        <p className="mt-2 text-sm text-muted-foreground">변경 이력을 불러오는 중입니다.</p>
      ) : null}
      {historyQuery.isError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">변경 이력을 불러오지 못했습니다.</p>
      ) : null}
      {!historyQuery.isPending && !historyQuery.isError && (historyQuery.data?.events.length ?? 0) === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">아직 기록된 변경 이력이 없습니다.</p>
      ) : null}
      {historyQuery.data?.events.length ? (
        <ul className="mt-3 space-y-2">
          {historyQuery.data.events.map((event) => (
            <li key={event.id} className="rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-medium">{event.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(event.changedAt).toLocaleString("ko-KR")}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
