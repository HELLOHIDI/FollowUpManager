"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_UPLOAD_ACCEPT } from "@/lib/file-upload";
import { ProjectInputSchema, type ProjectInput, type ProjectResponse } from "../lib/dto";

export const EMPTY_PROJECT: ProjectInput = {
  agreementEndDate: "", agreementStartDate: "", assignmentName: "", assignmentNumber: "",
  governmentSubsidyRatio: "100", hostInstitution: "", managerEmail: null, managerName: "", managerPhone: null,
  projectName: "", projectNotes: null, selfCashRatio: "0", selfInKindRatio: "0", totalProjectBudget: "0",
};

export const projectToInput = (project: ProjectResponse): ProjectInput => ({
  agreementEndDate: project.agreementEndDate, agreementStartDate: project.agreementStartDate,
  assignmentName: project.assignmentName, assignmentNumber: project.assignmentNumber ?? "",
  governmentSubsidyRatio: String(project.governmentSubsidyRatio), hostInstitution: project.hostInstitution,
  managerEmail: project.managerEmail, managerName: project.managerName, managerPhone: project.managerPhone,
  projectName: project.projectName, projectNotes: project.projectNotes, selfCashRatio: String(project.selfCashRatio),
  selfInKindRatio: String(project.selfInKindRatio), totalProjectBudget: String(project.totalProjectBudget),
});

const ErrorText = ({ message }: { message?: string }) => message ? <p className="text-sm font-medium text-destructive" role="alert">{message}</p> : null;
const toBasisPoints = (value: string) => /^(100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/.test(value) ? Math.round(Number(value) * 100) : null;
const formatWon = (value: bigint | null) => value === null ? "-" : `${value.toLocaleString("ko-KR")}원`;
const toFiles = (fileList: FileList | null) => Array.from(fileList ?? []);

const calculateBudgetAmounts = ([totalValue, subsidyValue, cashValue, inKindValue]: string[]) => {
  if (!/^\d+$/.test(totalValue)) return null;
  const total = BigInt(totalValue);
  const subsidyRatio = toBasisPoints(subsidyValue);
  const cashRatio = toBasisPoints(cashValue);
  const inKindRatio = toBasisPoints(inKindValue);
  if (subsidyRatio === null || cashRatio === null || inKindRatio === null || subsidyRatio + cashRatio + inKindRatio !== 10000) return null;
  const subsidy = (total * BigInt(subsidyRatio)) / BigInt(10000);
  const cash = (total * BigInt(cashRatio)) / BigInt(10000);
  return { cash, inKind: total - subsidy - cash, subsidy };
};

export function ProjectForm({ assignmentError, companyName, initialValues = EMPTY_PROJECT, isSubmitting, onDirtyChange, onSubmit, projects = [], showAttachments = false, submitLabel = "사업 등록" }: {
  assignmentError?: string | null;
  companyName: string; initialValues?: ProjectInput; isSubmitting: boolean; onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: ProjectInput, files: File[]) => Promise<void>; projects?: ProjectResponse[]; showAttachments?: boolean; submitLabel?: string;
}) {
  const form = useForm<ProjectInput>({ defaultValues: initialValues, mode: "onChange", resolver: zodResolver(ProjectInputSchema) });
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectName = form.watch("projectName");
  const budgetInputs = form.watch(["totalProjectBudget", "governmentSubsidyRatio", "selfCashRatio", "selfInKindRatio"]);
  const budget = useMemo(() => calculateBudgetAmounts(budgetInputs), [budgetInputs]);
  const duplicateName = projectName.trim() && projects.some((project) => project.projectName === projectName.trim());

  useEffect(() => form.reset(initialValues), [form, initialValues]);
  useEffect(() => {
    if (assignmentError) form.setError("assignmentNumber", { message: assignmentError, type: "server" });
  }, [assignmentError, form]);
  useEffect(() => onDirtyChange?.(form.formState.isDirty || files.length > 0), [files.length, form.formState.isDirty, onDirtyChange]);
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => setFiles(toFiles(event.target.files));
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    setFiles(toFiles(event.dataTransfer.files));
  };

  return <form className="grid gap-5 sm:grid-cols-2" onSubmit={form.handleSubmit((input) => onSubmit(input, files))}>
    <div className="rounded-md bg-muted px-4 py-3 text-sm sm:col-span-2"><span className="text-muted-foreground">등록 기업</span><strong className="ml-2">{companyName}</strong></div>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">사업명<Input {...form.register("projectName")} /><ErrorText message={form.formState.errors.projectName?.message} />{duplicateName ? <p className="text-sm text-amber-700">같은 기업에 동일한 사업명이 있습니다. 과제번호가 다르면 등록할 수 있습니다.</p> : null}</label>
    <label className="grid gap-2 text-sm font-medium">주관기관<Input {...form.register("hostInstitution")} /><ErrorText message={form.formState.errors.hostInstitution?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">과제번호 (선택)<Input {...form.register("assignmentNumber")} /><ErrorText message={form.formState.errors.assignmentNumber?.message} /></label>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">과제명<Input {...form.register("assignmentName")} /><ErrorText message={form.formState.errors.assignmentName?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">협약 시작일<Input type="date" {...form.register("agreementStartDate")} /><ErrorText message={form.formState.errors.agreementStartDate?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">협약 종료일<Input type="date" {...form.register("agreementEndDate")} /><ErrorText message={form.formState.errors.agreementEndDate?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">기관 담당자명<Input {...form.register("managerName")} /><ErrorText message={form.formState.errors.managerName?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">기관 담당자 이메일<Controller control={form.control} name="managerEmail" render={({ field }) => <Input type="email" {...field} value={field.value ?? ""} />} /><ErrorText message={form.formState.errors.managerEmail?.message} /></label>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">기관 담당자 연락처<Controller control={form.control} name="managerPhone" render={({ field }) => <Input {...field} value={field.value ?? ""} />} /><ErrorText message={form.formState.errors.managerPhone?.message} /></label>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">총 사업비<Controller control={form.control} name="totalProjectBudget" render={({ field }) => <NumberInput name={field.name} onBlur={field.onBlur} onValueChange={field.onChange} ref={field.ref} value={field.value} />} /><ErrorText message={form.formState.errors.totalProjectBudget?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">정부지원금 비율(%)<Input inputMode="decimal" {...form.register("governmentSubsidyRatio")} /><ErrorText message={form.formState.errors.governmentSubsidyRatio?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">현금 비율(%)<Input inputMode="decimal" {...form.register("selfCashRatio")} /><ErrorText message={form.formState.errors.selfCashRatio?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">현물 비율(%)<Input inputMode="decimal" {...form.register("selfInKindRatio")} /><ErrorText message={form.formState.errors.selfInKindRatio?.message} /></label>
    <div className="rounded-md border p-3 text-sm">
      <p className="text-muted-foreground">산출 금액</p>
      <div className="mt-2 grid gap-1 tabular-nums">
        <span>정부지원금 <strong>{formatWon(budget?.subsidy ?? null)}</strong></span>
        <span>현금 <strong>{formatWon(budget?.cash ?? null)}</strong></span>
        <span>현물 <strong>{formatWon(budget?.inKind ?? null)}</strong></span>
      </div>
    </div>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">유의사항<Controller control={form.control} name="projectNotes" render={({ field }) => <Textarea rows={4} {...field} value={field.value ?? ""} />} /><ErrorText message={form.formState.errors.projectNotes?.message} /></label>
    {showAttachments ? <div className="grid gap-2 text-sm font-medium sm:col-span-2">
      <span>추가 첨부파일</span>
      <div
        className={`grid min-h-44 place-items-center rounded-lg border border-dashed bg-muted/70 p-6 text-center transition-colors ${isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25"}`}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="grid justify-items-center gap-4">
          <p className="text-sm font-medium text-muted-foreground">첨부할 파일을 여기에 끌어다 놓거나, 파일 선택 버튼을 직접 선택해주세요.</p>
          <Button type="button" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" aria-hidden="true" />파일선택</Button>
          <Input ref={fileInputRef} accept={DEFAULT_UPLOAD_ACCEPT} className="hidden" multiple type="file" onChange={handleFileChange} />
          <p className="text-xs font-normal text-muted-foreground">협약 PDF와 기관 양식 등 참고 파일을 추가합니다. 파일은 최대 20MB입니다.</p>
          {files.length > 0 ? <ul className="grid gap-1 text-xs font-normal text-muted-foreground">
            {files.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}
          </ul> : null}
        </div>
      </div>
    </div> : null}
    <div className="flex justify-end border-t pt-5 sm:col-span-2"><Button disabled={!form.formState.isValid || isSubmitting} type="submit">{isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{submitLabel}</Button></div>
  </form>;
}
