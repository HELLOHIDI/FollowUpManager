"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, type UseFormReturn, useForm } from "react-hook-form";
import { routes } from "@/constants/routes";
import { PageHeading } from "@/components/product-shell";
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
import { uploadProjectDocuments } from "@/features/projects/api";
import { ProjectForm } from "@/features/projects/components/project-form";
import {
  useCompanyProjectsQuery,
  useProjectMutations,
  useProjectNavigationPrefetch,
} from "@/features/projects/hooks/use-projects";
import type { ProjectInput } from "@/features/projects/lib/dto";
import { useCompaniesQuery } from "../hooks/use-companies-query";
import { useCompanyMutations } from "../hooks/use-company-mutations";
import {
  CompanyInputSchema,
  type CompanyInput,
  type CompanyResponse,
} from "../lib/dto";

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

const getSafeReturnPath = (returnTo: string | null) =>
  returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;

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

function CompanyForm({
  businessType,
  form,
  isSubmitting,
  onSubmit,
  submitLabel,
}: {
  businessType: CompanyInput["businessType"];
  form: UseFormReturn<CompanyInput>;
  isSubmitting: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <form className="grid gap-5 sm:grid-cols-2" onSubmit={onSubmit}>
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
          message={form.formState.errors.businessRegistrationNumber?.message}
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
            message={form.formState.errors.corporateRegistrationNumber?.message}
          />
        </label>
      ) : null}

      <div className="flex flex-col gap-3 border-t pt-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {form.formState.isValid
            ? "필수 정보가 모두 입력되었습니다."
            : "필수 정보를 입력하면 저장할 수 있습니다."}
        </p>
        <Button type="submit" disabled={!form.formState.isValid || isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function CompanySettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companiesQuery = useCompaniesQuery();
  const { createMutation, updateMutation } = useCompanyMutations();
  const { toast } = useToast();
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [projectCompanyId, setProjectCompanyId] = useState<string | null>(null);
  const [isProjectDirty, setIsProjectDirty] = useState(false);
  const [projectAssignmentError, setProjectAssignmentError] = useState<
    string | null
  >(null);
  const { createMutation: createProjectMutation } = useProjectMutations();
  const { prefetchDashboard } = useProjectNavigationPrefetch();
  const form = useForm<CompanyInput>({
    defaultValues: EMPTY_COMPANY,
    mode: "onChange",
    resolver: zodResolver(CompanyInputSchema),
  });
  const companies = useMemo(
    () => companiesQuery.data ?? [],
    [companiesQuery.data],
  );
  const businessType = form.watch("businessType");
  const requestedMode = searchParams.get("mode");
  const requestedCompanyId = searchParams.get("companyId");
  const requestedProjectCompanyId = searchParams.get("projectCompanyId");
  const safeReturnTo = getSafeReturnPath(searchParams.get("returnTo"));
  const isFocusedCreate = requestedMode === "create";
  const isFocusedEdit = Boolean(requestedCompanyId);
  const isFocusedCompanyForm = isFocusedCreate || isFocusedEdit;
  const isFocusedProjectCreate =
    requestedMode === "project-create" && Boolean(requestedProjectCompanyId);
  const focusedEditCompany = requestedCompanyId
    ? companies.find(({ id }) => id === requestedCompanyId)
    : null;
  const focusedProjectCompany = requestedProjectCompanyId
    ? companies.find(({ id }) => id === requestedProjectCompanyId)
    : null;
  const projectCompany = companies.find(({ id }) => id === projectCompanyId);
  const projectsQuery = useCompanyProjectsQuery(
    projectCompanyId ?? "",
    Boolean(projectCompanyId),
  );
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!isFocusedCompanyForm && !isFocusedProjectCreate) {
      router.replace(routes.projects);
    }
  }, [isFocusedCompanyForm, isFocusedProjectCreate, router]);

  useEffect(() => {
    if (!isFocusedCompanyForm) {
      return;
    }

    setProjectCompanyId(null);
    setIsProjectDirty(false);
    setProjectAssignmentError(null);

    if (isFocusedCreate) {
      setEditingCompanyId(null);
      form.reset(EMPTY_COMPANY);
      return;
    }

    if (!requestedCompanyId || companiesQuery.isPending) {
      return;
    }

    if (focusedEditCompany) {
      setEditingCompanyId(focusedEditCompany.id);
      form.reset(toFormValues(focusedEditCompany));
    }
  }, [
    companiesQuery.isPending,
    focusedEditCompany,
    form,
    isFocusedCompanyForm,
    isFocusedCreate,
    requestedCompanyId,
  ]);

  useEffect(() => {
    if (!isFocusedProjectCreate || !requestedProjectCompanyId) {
      return;
    }

    setEditingCompanyId(null);
    setProjectCompanyId(requestedProjectCompanyId);
    setIsProjectDirty(false);
    setProjectAssignmentError(null);

    if (focusedProjectCompany) {
      form.reset(toFormValues(focusedProjectCompany));
    }
  }, [
    focusedProjectCompany,
    form,
    isFocusedProjectCreate,
    requestedProjectCompanyId,
  ]);

  useEffect(() => {
    if (businessType === "sole_proprietor") {
      form.setValue("corporateRegistrationNumber", null, {
        shouldDirty: form.formState.isDirty,
        shouldValidate: true,
      });
    }
  }, [businessType, form]);

  const submit = form.handleSubmit(async (input) => {
    try {
      const company = editingCompanyId
        ? await updateMutation.mutateAsync({
            companyId: editingCompanyId,
            input,
          })
        : await createMutation.mutateAsync(input);

      setEditingCompanyId(company.id);
      form.reset(toFormValues(company));
      toast({
        title: editingCompanyId
          ? "기업 정보가 수정되었습니다."
          : "기업을 등록했습니다.",
        description: `${company.companyName} 정보를 저장했습니다.`,
      });

      if (safeReturnTo) {
        router.push(safeReturnTo);
      }
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
          "입력값을 확인하고 다시 시도해 주세요.",
        ),
        variant: "destructive",
      });
    }
  });

  const submitProject = async (input: ProjectInput, files: File[]) => {
    if (!projectCompany) {
      return;
    }

    try {
      setProjectAssignmentError(null);
      const project = await createProjectMutation.mutateAsync({
        companyId: projectCompany.id,
        input,
      });
      const result = await uploadProjectDocuments(project.id, files);
      toast({
        title: "사업을 등록했습니다.",
        description: result.failed
          ? `${result.failed}개 파일은 업로드하지 못했습니다. 관리 화면에서 다시 시도해 주세요.`
          : `${project.projectName} 등록이 완료되었습니다.`,
      });
      if (result.failed) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      }
      setIsProjectDirty(false);
      void prefetchDashboard(project.id);
      router.push(routes.project(project.id));
    } catch (error) {
      if (extractApiErrorCode(error) === "PROJECT_ASSIGNMENT_NUMBER_CONFLICT") {
        setProjectAssignmentError("같은 기업에 이미 등록된 과제번호입니다.");
      }
      toast({
        title: "사업을 등록하지 못했습니다.",
        description: extractApiErrorMessage(error, "입력값을 확인해 주세요."),
        variant: "destructive",
      });
    }
  };

  if (isFocusedProjectCreate) {
    const backPath = safeReturnTo ?? routes.projects;
    const isProjectCompanyMissing =
      !companiesQuery.isPending && !focusedProjectCompany;

    return (
      <>
        <PageHeading
          eyebrow="사업"
          title="사업 등록"
          description="선택한 기업에 연결할 사업 정보와 기관 제공 서류를 등록합니다."
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(backPath)}
            >
              목록으로 돌아가기
            </Button>
          }
        />

        {companiesQuery.isPending ? (
          <Card className="shadow-none">
            <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              기업 정보를 불러오는 중입니다.
            </CardContent>
          </Card>
        ) : companiesQuery.isError ? (
          <Card className="border-destructive/30 shadow-none" role="alert">
            <CardHeader>
              <CardTitle className="text-lg" role="heading" aria-level={2}>
                기업 정보를 불러오지 못했습니다.
              </CardTitle>
              <CardDescription>잠시 후 다시 시도해 주세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={() => void companiesQuery.refetch()}
              >
                다시 시도
              </Button>
            </CardContent>
          </Card>
        ) : isProjectCompanyMissing ? (
          <Card className="shadow-none" role="alert">
            <CardHeader>
              <CardTitle className="text-lg" role="heading" aria-level={2}>
                사업을 등록할 기업을 찾지 못했습니다.
              </CardTitle>
              <CardDescription>
                기업 목록으로 돌아가 다시 선택해 주세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={() => router.push(backPath)}>
                목록으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        ) : focusedProjectCompany ? (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-lg" role="heading" aria-level={2}>
                새 사업 등록
              </CardTitle>
              <CardDescription>
                임시저장 없이 필수 정보가 모두 유효할 때 저장됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectForm
                assignmentError={projectAssignmentError}
                companyName={focusedProjectCompany.companyName}
                isSubmitting={createProjectMutation.isPending}
                onDirtyChange={setIsProjectDirty}
                onSubmit={submitProject}
                projects={projectsQuery.data ?? []}
                showAttachments
              />
            </CardContent>
          </Card>
        ) : null}
      </>
    );
  }

  if (isFocusedCompanyForm) {
    const backPath = safeReturnTo ?? routes.projects;
    const isEditMissing =
      isFocusedEdit && !companiesQuery.isPending && !focusedEditCompany;

    return (
      <>
        <PageHeading
          eyebrow="기업"
          title={isFocusedCreate ? "기업 추가하기" : "기업 정보 수정"}
          description={
            isFocusedCreate
              ? "사업 운영 대시보드에서 사용할 기업 기본 정보만 입력합니다."
              : "선택한 기업의 기본 정보를 수정합니다."
          }
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(backPath)}
            >
              목록으로 돌아가기
            </Button>
          }
        />

        {isFocusedEdit && companiesQuery.isPending ? (
          <Card className="shadow-none">
            <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              기업 정보를 불러오는 중입니다.
            </CardContent>
          </Card>
        ) : companiesQuery.isError ? (
          <Card className="border-destructive/30 shadow-none" role="alert">
            <CardHeader>
              <CardTitle className="text-lg" role="heading" aria-level={2}>
                기업 정보를 불러오지 못했습니다.
              </CardTitle>
              <CardDescription>잠시 후 다시 시도해 주세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={() => void companiesQuery.refetch()}
              >
                다시 시도
              </Button>
            </CardContent>
          </Card>
        ) : isEditMissing ? (
          <Card className="shadow-none" role="alert">
            <CardHeader>
              <CardTitle className="text-lg" role="heading" aria-level={2}>
                수정할 기업을 찾지 못했습니다.
              </CardTitle>
              <CardDescription>
                기업 목록으로 돌아가 다시 선택해 주세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={() => router.push(backPath)}>
                목록으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-lg" role="heading" aria-level={2}>
                {isFocusedCreate ? "새 기업 등록" : "기업 정보 수정"}
              </CardTitle>
              <CardDescription>
                기업 등록에 필요한 기본 정보만 입력합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyForm
                businessType={businessType}
                form={form}
                isSubmitting={isSubmitting}
                onSubmit={submit}
                submitLabel={
                  isFocusedCreate ? "기업 추가하기" : "기업 정보 수정"
                }
              />
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  return null;
}
