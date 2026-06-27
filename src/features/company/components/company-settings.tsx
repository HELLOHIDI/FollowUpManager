"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ChevronDown, ChevronRight, FolderKanban, Loader2, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PageHeading } from "@/components/product-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from "@/lib/remote/api-client";
import { useCompaniesQuery } from "../hooks/use-companies-query";
import { useCompanyMutations } from "../hooks/use-company-mutations";
import {
  CompanyInputSchema,
  formatBusinessRegistrationNumber,
  type CompanyInput,
  type CompanyResponse,
} from "../lib/dto";
import { routes } from "@/constants/routes";
import { uploadProjectDocuments } from "@/features/projects/api";
import { ProjectForm } from "@/features/projects/components/project-form";
import { useCompanyProjectsQuery, useProjectMutations, useProjectNavigationPrefetch } from "@/features/projects/hooks/use-projects";
import { confirmDiscardChanges } from "@/features/projects/hooks/use-dirty-navigation-guard";

const EMPTY_COMPANY: CompanyInput = {
  businessRegistrationNumber: "",
  businessType: "sole_proprietor",
  companyName: "",
  companySize: "unknown",
  corporateRegistrationNumber: null,
  foundedAt: "",
};

const BUSINESS_TYPE_OPTIONS = [
  ["sole_proprietor", "개인사업자"],
  ["corporation", "법인사업자"],
] as const;
const COMPANY_SIZE_OPTIONS = [
  ["medium_enterprise", "중기업"],
  ["small_enterprise", "소기업"],
  ["micro_business", "소상공인"],
  ["unknown", "확인 필요"],
] as const;

const toFormValues = (company: CompanyResponse): CompanyInput => ({
  businessRegistrationNumber: company.businessRegistrationNumber,
  businessType: company.businessType,
  companyName: company.companyName,
  companySize: company.companySize,
  corporateRegistrationNumber: company.corporateRegistrationNumber,
  foundedAt: company.foundedAt,
});

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p className="text-sm font-medium text-destructive" role="alert">
      {message}
    </p>
  ) : null;

export function CompanySettings() {
  const router = useRouter();
  const companiesQuery = useCompaniesQuery();
  const { createMutation, updateMutation } = useCompanyMutations();
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [projectCompanyId, setProjectCompanyId] = useState<string | null>(null);
  const [isProjectDirty, setIsProjectDirty] = useState(false);
  const [projectAssignmentError, setProjectAssignmentError] = useState<string | null>(null);
  const projectCompany = companiesQuery.data?.find(({ id }) => id === projectCompanyId);
  const projectsQuery = useCompanyProjectsQuery(projectCompanyId ?? "", Boolean(projectCompanyId));
  const { createMutation: createProjectMutation } = useProjectMutations();
  const { prefetchDashboard, prefetchProject } = useProjectNavigationPrefetch();
  const form = useForm<CompanyInput>({
    defaultValues: EMPTY_COMPANY,
    mode: "onChange",
    resolver: zodResolver(CompanyInputSchema),
  });
  const companies = useMemo(
    () => companiesQuery.data ?? [],
    [companiesQuery.data]
  );
  const businessType = form.watch("businessType");
  const selectedCompany = companies.find(
    ({ id }) => id === selectedCompanyId
  );
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (
      companies.length === 0 ||
      selectedCompanyId !== null ||
      isCreating
    ) {
      return;
    }

    const firstCompany = companies[0];
    setSelectedCompanyId(firstCompany.id);
    form.reset(toFormValues(firstCompany));
  }, [companies, form, isCreating, selectedCompanyId]);

  useEffect(() => {
    if (businessType === "sole_proprietor") {
      form.setValue("corporateRegistrationNumber", null, {
        shouldDirty: form.formState.isDirty,
        shouldValidate: true,
      });
    }
  }, [businessType, form]);

  const canDiscardChanges = () =>
    confirmDiscardChanges(form.formState.isDirty || isProjectDirty);

  const selectCompany = (company: CompanyResponse) => {
    if (!canDiscardChanges()) {
      return false;
    }

    setSelectedCompanyId(company.id);
    setIsCreating(false);
    setProjectCompanyId(null);
    setIsProjectDirty(false);
    setProjectAssignmentError(null);
    form.reset(toFormValues(company));
    return true;
  };

  const startNewCompany = () => {
    if (!canDiscardChanges()) {
      return;
    }

    setSelectedCompanyId(null);
    setIsCreating(true);
    setProjectCompanyId(null);
    setProjectAssignmentError(null);
    form.reset(EMPTY_COMPANY);
  };

  const startProject = (company: CompanyResponse) => {
    if (!canDiscardChanges()) return;
    setSelectedCompanyId(company.id);
    setIsCreating(false);
    setProjectCompanyId(company.id);
    setExpandedCompanyId(company.id);
    setIsProjectDirty(false);
    setProjectAssignmentError(null);
    form.reset(toFormValues(company));
  };

  const submit = form.handleSubmit(async (input) => {
    try {
      const company = selectedCompanyId
        ? await updateMutation.mutateAsync({
            companyId: selectedCompanyId,
            input,
          })
        : await createMutation.mutateAsync(input);

      setSelectedCompanyId(company.id);
      setIsCreating(false);
      form.reset(toFormValues(company));
      toast({
        title: selectedCompanyId
          ? "기업 정보가 수정되었습니다."
          : "기업이 등록되었습니다.",
        description: `${company.companyName} 정보를 저장했습니다.`,
      });
    } catch (error) {
      if (
        extractApiErrorCode(error) ===
        "COMPANY_REGISTRATION_NUMBER_CONFLICT"
      ) {
        form.setError("businessRegistrationNumber", {
          message: "이미 등록된 사업자등록번호입니다.",
          type: "server",
        });
      }

      toast({
        title: "기업 정보를 저장하지 못했습니다.",
        description: extractApiErrorMessage(
          error,
          "입력값을 확인한 뒤 다시 시도해 주세요."
        ),
        variant: "destructive",
      });
    }
  });

  return (
    <>
      <PageHeading
        eyebrow="설정"
        title="기업 정보"
        description="기업을 선택해 정보를 관리하고, 하위 사업을 등록하거나 운영 화면으로 이동합니다."
        actions={
          <Button type="button" variant="outline" onClick={startNewCompany}>
            <Plus className="size-4" aria-hidden="true" /> 기업 추가
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.8fr)]">
        <Card className="h-fit shadow-none">
          <CardHeader>
            <CardTitle className="text-lg" role="heading" aria-level={2}>
              등록 기업
            </CardTitle>
            <CardDescription>
              {companies.length}개 기업을 관리하고 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {companiesQuery.isPending ? (
              <div className="space-y-2" aria-label="기업 목록 불러오는 중">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-md bg-muted"
                  />
                ))}
              </div>
            ) : companiesQuery.isError ? (
              <div className="space-y-3 text-sm" role="alert">
                <p>기업 목록을 불러오지 못했습니다.</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void companiesQuery.refetch()}
                >
                  다시 시도
                </Button>
              </div>
            ) : companies.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-center">
                <Building2
                  className="mx-auto mb-3 size-8 text-primary"
                  aria-hidden="true"
                />
                <p className="font-medium">등록된 기업이 없습니다.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  첫 기업 정보를 입력해 주세요.
                </p>
                <Button
                  className="mt-4"
                  type="button"
                  onClick={startNewCompany}
                >
                  첫 기업 등록
                </Button>
              </div>
            ) : (
              <ul className="space-y-2" aria-label="기업 목록">
                {companies.map((company) => <CompanyProjectNavigationItem company={company} expanded={expandedCompanyId === company.id} key={company.id} onNavigate={(path) => { if (canDiscardChanges()) router.push(path); }} onPrefetchDashboard={(projectId) => void prefetchDashboard(projectId)} onPrefetchManagement={(projectId) => void prefetchProject(projectId)} onRegister={() => startProject(company)} onSelect={() => { if (selectCompany(company)) setExpandedCompanyId((current) => current === company.id ? null : company.id); }} selected={selectedCompanyId === company.id} />)}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-lg" role="heading" aria-level={2}>
                {projectCompany ? "새 사업 등록" : selectedCompany ? "기업 정보 수정" : "새 기업 등록"}
              </CardTitle>
              <CardDescription className="mt-1">
                임시저장 없이 필수 정보가 모두 유효할 때 저장됩니다.
              </CardDescription>
            </div>
            {!projectCompany && selectedCompany?.profileStatus === "review_required" ? (
              <Badge variant="secondary">기업규모 확인 필요</Badge>
            ) : !projectCompany && selectedCompany ? (
              <Badge>등록 완료</Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {projectCompany ? <ProjectForm assignmentError={projectAssignmentError} companyName={projectCompany.companyName} isSubmitting={createProjectMutation.isPending} onDirtyChange={setIsProjectDirty} projects={projectsQuery.data ?? []} showAttachments onSubmit={async (input, files) => {
              try {
                setProjectAssignmentError(null);
                const project = await createProjectMutation.mutateAsync({ companyId: projectCompany.id, input });
                const result = await uploadProjectDocuments(project.id, files);
                toast({ title: "사업이 등록되었습니다.", description: result.failed ? `${result.failed}개 파일은 업로드하지 못했습니다. 관리 화면에서 다시 시도해 주세요.` : `${project.projectName} 등록을 완료했습니다.` });
                if (result.failed) await new Promise((resolve) => window.setTimeout(resolve, 1_000));
                setIsProjectDirty(false);
                void prefetchDashboard(project.id);
                router.push(routes.project(project.id));
              } catch (error) {
                if (extractApiErrorCode(error) === "PROJECT_ASSIGNMENT_NUMBER_CONFLICT") setProjectAssignmentError("같은 기업에 이미 등록된 과제번호입니다.");
                toast({ title: "사업을 등록하지 못했습니다.", description: extractApiErrorMessage(error, "입력값을 확인해 주세요."), variant: "destructive" });
              }
            }} /> : <form className="grid gap-5 sm:grid-cols-2" onSubmit={submit}>
              <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                기업명
                <Input
                  autoComplete="organization"
                  placeholder="사업자등록증 기준 상호명"
                  {...form.register("companyName")}
                />
                <FieldError message={form.formState.errors.companyName?.message} />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                회사 형태
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  {...form.register("businessType")}
                >
                  {BUSINESS_TYPE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldError message={form.formState.errors.businessType?.message} />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                기업규모
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  {...form.register("companySize")}
                >
                  {COMPANY_SIZE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldError message={form.formState.errors.companySize?.message} />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                사업자등록번호
                <Input
                  inputMode="numeric"
                  placeholder="000-00-00000"
                  {...form.register("businessRegistrationNumber")}
                />
                <FieldError
                  message={
                    form.formState.errors.businessRegistrationNumber?.message
                  }
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                설립일
                <Input type="date" {...form.register("foundedAt")} />
                <FieldError message={form.formState.errors.foundedAt?.message} />
              </label>

              {businessType === "corporation" ? (
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  법인등록번호
                  <Controller
                    control={form.control}
                    name="corporateRegistrationNumber"
                    render={({ field }) => (
                      <Input
                        inputMode="numeric"
                        placeholder="000000-0000000"
                        {...field}
                        value={field.value ?? ""}
                      />
                    )}
                  />
                  <FieldError
                    message={
                      form.formState.errors.corporateRegistrationNumber?.message
                    }
                  />
                </label>
              ) : null}

              <div className="flex flex-col gap-3 border-t pt-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {form.formState.isValid
                    ? "필수 정보가 모두 입력되었습니다."
                    : "필수 정보를 입력하면 저장할 수 있습니다."}
                </p>
                <Button
                  type="submit"
                  disabled={!form.formState.isValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {selectedCompanyId ? "기업 정보 수정" : "기업 등록"}
                </Button>
              </div>
            </form>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CompanyProjectNavigationItem({ company, expanded, onNavigate, onPrefetchDashboard, onPrefetchManagement, onRegister, onSelect, selected }: { company: CompanyResponse; expanded: boolean; onNavigate: (path: string) => void; onPrefetchDashboard: (projectId: string) => void; onPrefetchManagement: (projectId: string) => void; onRegister: () => void; onSelect: () => void; selected: boolean }) {
  const projectsQuery = useCompanyProjectsQuery(company.id, expanded);

  return (
    <li className="rounded-lg border">
      <button aria-expanded={expanded} aria-pressed={selected} className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-muted aria-pressed:bg-primary/5" onClick={onSelect} type="button">
        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{company.companyName}</span>
          <span className="mt-1 block text-xs text-muted-foreground tabular-nums">{formatBusinessRegistrationNumber(company.businessRegistrationNumber)}</span>
        </span>
      </button>
      {expanded ? (
        <div className="space-y-1 border-t p-2 pl-6">
          {projectsQuery.isPending ? (
            <div className="h-10 animate-pulse rounded bg-muted" />
          ) : projectsQuery.isError ? (
            <div className="space-y-2 rounded-md bg-destructive/5 p-2 text-sm" role="alert">
              <p>사업 목록을 불러오지 못했습니다.</p>
              <Button onClick={() => void projectsQuery.refetch()} size="sm" type="button" variant="outline">다시 시도</Button>
            </div>
          ) : (
            <>
              {projectsQuery.data?.length ? projectsQuery.data.map((project) => (
                <div className="flex items-center rounded-md hover:bg-muted" key={project.id}>
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm"
                    onClick={() => onNavigate(routes.project(project.id))}
                    onFocus={() => onPrefetchDashboard(project.id)}
                    onMouseEnter={() => onPrefetchDashboard(project.id)}
                    type="button"
                  >
                    <FolderKanban className="size-4 shrink-0" />
                    <span className="truncate">{project.projectName}</span>
                  </button>
                  <Button
                    aria-label={`${project.projectName} 관리`}
                    onClick={() => onNavigate(routes.projectManagement(project.id))}
                    onFocus={() => onPrefetchManagement(project.id)}
                    onMouseEnter={() => onPrefetchManagement(project.id)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Settings className="size-4" />
                  </Button>
                </div>
              )) : <p className="px-2 py-3 text-sm text-muted-foreground">등록된 사업이 없습니다.</p>}
              <Button className="w-full justify-start" onClick={onRegister} size="sm" type="button" variant="ghost"><Plus className="size-4" />사업 등록</Button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
