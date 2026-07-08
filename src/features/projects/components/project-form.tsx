"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_UPLOAD_ACCEPT } from "@/lib/file-upload";
import { ProjectInputSchema, type ProjectInput, type ProjectResponse } from "../lib/dto";

export const EMPTY_PROJECT: ProjectInput = {
  agreementEndDate: "", agreementStartDate: "", assignmentName: "", assignmentNumber: "",
  governmentSubsidyAmount: "0", hostInstitution: "", managerEmail: null, managerName: "", managerPhone: null,
  projectName: "", projectNotes: null, selfCashAmount: "0", selfInKindAmount: "0",
};

export const projectToInput = (project: ProjectResponse): ProjectInput => ({
  agreementEndDate: project.agreementEndDate, agreementStartDate: project.agreementStartDate,
  assignmentName: project.assignmentName, assignmentNumber: project.assignmentNumber,
  governmentSubsidyAmount: String(project.governmentSubsidyAmount), hostInstitution: project.hostInstitution,
  managerEmail: project.managerEmail, managerName: project.managerName, managerPhone: project.managerPhone,
  projectName: project.projectName, projectNotes: project.projectNotes, selfCashAmount: String(project.selfCashAmount),
  selfInKindAmount: String(project.selfInKindAmount),
});

const ErrorText = ({ message }: { message?: string }) => message ? <p className="text-sm font-medium text-destructive" role="alert">{message}</p> : null;

export function ProjectForm({ assignmentError, companyName, initialValues = EMPTY_PROJECT, isSubmitting, onDirtyChange, onSubmit, projects = [], showAttachments = false, submitLabel = "사업 등록" }: {
  assignmentError?: string | null;
  companyName: string; initialValues?: ProjectInput; isSubmitting: boolean; onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: ProjectInput, files: File[]) => Promise<void>; projects?: ProjectResponse[]; showAttachments?: boolean; submitLabel?: string;
}) {
  const form = useForm<ProjectInput>({ defaultValues: initialValues, mode: "onChange", resolver: zodResolver(ProjectInputSchema) });
  const [files, setFiles] = useState<File[]>([]);
  const projectName = form.watch("projectName");
  const amounts = form.watch(["governmentSubsidyAmount", "selfCashAmount", "selfInKindAmount"]);
  const total = useMemo(() => amounts.every((value) => /^\d+$/.test(value)) ? amounts.reduce((sum, value) => sum + BigInt(value), BigInt(0)).toLocaleString("ko-KR") : "-", [amounts]);
  const duplicateName = projectName.trim() && projects.some((project) => project.projectName === projectName.trim());

  useEffect(() => form.reset(initialValues), [form, initialValues]);
  useEffect(() => {
    if (assignmentError) form.setError("assignmentNumber", { message: assignmentError, type: "server" });
  }, [assignmentError, form]);
  useEffect(() => onDirtyChange?.(form.formState.isDirty || files.length > 0), [files.length, form.formState.isDirty, onDirtyChange]);

  return <form className="grid gap-5 sm:grid-cols-2" onSubmit={form.handleSubmit((input) => onSubmit(input, files))}>
    <div className="rounded-md bg-muted px-4 py-3 text-sm sm:col-span-2"><span className="text-muted-foreground">등록 기업</span><strong className="ml-2">{companyName}</strong></div>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">사업명<Input {...form.register("projectName")} /><ErrorText message={form.formState.errors.projectName?.message} />{duplicateName ? <p className="text-sm text-amber-700">같은 기업에 동일한 사업명이 있습니다. 과제번호가 다르면 등록할 수 있습니다.</p> : null}</label>
    <label className="grid gap-2 text-sm font-medium">주관기관<Input {...form.register("hostInstitution")} /><ErrorText message={form.formState.errors.hostInstitution?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">과제번호<Input {...form.register("assignmentNumber")} /><ErrorText message={form.formState.errors.assignmentNumber?.message} /></label>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">과제명<Input {...form.register("assignmentName")} /><ErrorText message={form.formState.errors.assignmentName?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">협약 시작일<Input type="date" {...form.register("agreementStartDate")} /><ErrorText message={form.formState.errors.agreementStartDate?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">협약 종료일<Input type="date" {...form.register("agreementEndDate")} /><ErrorText message={form.formState.errors.agreementEndDate?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">기관 담당자명<Input {...form.register("managerName")} /><ErrorText message={form.formState.errors.managerName?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">기관 담당자 이메일<Controller control={form.control} name="managerEmail" render={({ field }) => <Input type="email" {...field} value={field.value ?? ""} />} /><ErrorText message={form.formState.errors.managerEmail?.message} /></label>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">기관 담당자 연락처<Controller control={form.control} name="managerPhone" render={({ field }) => <Input {...field} value={field.value ?? ""} />} /><ErrorText message={form.formState.errors.managerPhone?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">정부지원금<Controller control={form.control} name="governmentSubsidyAmount" render={({ field }) => <NumberInput name={field.name} onBlur={field.onBlur} onValueChange={field.onChange} ref={field.ref} value={field.value} />} /><ErrorText message={form.formState.errors.governmentSubsidyAmount?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">자기부담금(현금)<Controller control={form.control} name="selfCashAmount" render={({ field }) => <NumberInput name={field.name} onBlur={field.onBlur} onValueChange={field.onChange} ref={field.ref} value={field.value} />} /><ErrorText message={form.formState.errors.selfCashAmount?.message} /></label>
    <label className="grid gap-2 text-sm font-medium">자기부담금(현물)<Controller control={form.control} name="selfInKindAmount" render={({ field }) => <NumberInput name={field.name} onBlur={field.onBlur} onValueChange={field.onChange} ref={field.ref} value={field.value} />} /><ErrorText message={form.formState.errors.selfInKindAmount?.message} /></label>
    <div className="rounded-md border p-3 text-sm"><span className="text-muted-foreground">총 사업비</span><strong className="ml-2 tabular-nums">{total}원</strong></div>
    <label className="grid gap-2 text-sm font-medium sm:col-span-2">유의사항<Controller control={form.control} name="projectNotes" render={({ field }) => <Textarea rows={4} {...field} value={field.value ?? ""} />} /><ErrorText message={form.formState.errors.projectNotes?.message} /></label>
    {showAttachments ? <label className="grid gap-2 text-sm font-medium sm:col-span-2">추가 첨부파일<Input accept={DEFAULT_UPLOAD_ACCEPT} multiple type="file" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><span className="text-xs text-muted-foreground">정책 PDF와 기관 양식 외 참고 파일을 추가합니다. 파일당 최대 20MB입니다.</span></label> : null}
    <div className="flex justify-end border-t pt-5 sm:col-span-2"><Button disabled={!form.formState.isValid || isSubmitting} type="submit">{isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{submitLabel}</Button></div>
  </form>;
}
