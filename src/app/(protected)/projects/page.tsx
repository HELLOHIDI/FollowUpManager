"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FolderKanban,
  Loader2,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { PageHeading } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { useCompaniesQuery } from "@/features/company/hooks/use-companies-query";
import { useCompanyMutations } from "@/features/company/hooks/use-company-mutations";
import {
  COMPANY_ACCOUNT_MANAGER_OPTIONS,
  formatBusinessRegistrationNumber,
  type CompanyResponse,
} from "@/features/company/lib/dto";
import {
  useCompanyProjectsQuery,
  useProjectMutations,
  useProjectNavigationPrefetch,
} from "@/features/projects/hooks/use-projects";
import { useToast } from "@/hooks/use-toast";

export default function ProjectsPage() {
  const companiesQuery = useCompaniesQuery();
  const companies = companiesQuery.data ?? [];
  const managerSections = COMPANY_ACCOUNT_MANAGER_OPTIONS.map((manager) => ({
    ...manager,
    companies: companies.filter(({ accountManager }) => accountManager === manager.name),
  }));

  return (
    <>
      <PageHeading
        eyebrow="기업 담당"
        title="담당자별 기업을 확인하세요"
        description="기업별 담당자를 기준으로 사업 등록과 운영 대시보드 진입을 관리합니다."
        actions={
          <Button asChild>
            <Link href={routes.companyCreate(routes.projects)}>
              <Building2 className="size-4" aria-hidden="true" />
              기업 추가하기
            </Link>
          </Button>
        }
      />

      {companiesQuery.isPending ? (
        <LoadingProjects />
      ) : companiesQuery.isError ? (
        <Card className="border-destructive/30 shadow-none" role="alert">
          <CardHeader>
          <CardTitle className="text-lg" role="heading" aria-level={2}>
              기업 정보를 불러오지 못했습니다
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
      ) : companies.length === 0 ? (
        <EmptyCompanyState />
      ) : (
        <div className="grid gap-4">
          <section
            className="grid gap-4 xl:grid-cols-2"
            aria-label="담당자별 기업과 사업"
          >
            {managerSections.map((manager) => (
              <section
                className="grid content-start gap-3 rounded-lg border bg-card p-3"
                key={manager.name}
                aria-labelledby={`manager-${manager.name}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2
                      className="text-base font-semibold"
                      id={`manager-${manager.name}`}
                    >
                      {manager.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {manager.team} {manager.role}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                    {manager.companies.length}
                  </span>
                </div>
                {manager.companies.length > 0 ? (
                  manager.companies.map((company) => (
                    <CompanyProjectCard key={company.id} company={company} />
                  ))
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    배정된 기업이 없습니다.
                  </div>
                )}
              </section>
            ))}
          </section>
        </div>
      )}
    </>
  );
}

function LoadingProjects() {
  return (
    <div className="grid gap-4" aria-label="기업과 사업 목록을 불러오는 중">
      {[1, 2].map((item) => (
        <Card className="shadow-none" key={item}>
          <CardHeader>
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-12 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyCompanyState() {
  return (
    <div className="grid gap-4">
      <Card className="border-dashed shadow-none">
        <CardHeader className="items-start">
          <span
            className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Building2 className="size-6" />
          </span>
          <CardTitle className="pt-3 text-xl" role="heading" aria-level={2}>
            등록된 기업이 없습니다
          </CardTitle>
          <CardDescription className="max-w-xl leading-6">
            먼저 기업 정보를 등록하면 이 화면에서 기업별 사업을 확인하고
            운영 대시보드로 이동할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={routes.companyCreate(routes.projects)}>
              기업 정보 등록
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyProjectCard({ company }: { company: CompanyResponse }) {
  const projectsQuery = useCompanyProjectsQuery(company.id);
  const { deleteMutation: deleteCompanyMutation } = useCompanyMutations();
  const { deleteMutation: deleteProjectMutation } = useProjectMutations();
  const { prefetchDashboard, prefetchProject } = useProjectNavigationPrefetch();
  const { toast } = useToast();
  const projects = projectsQuery.data ?? [];
  const deleteCompany = async () => {
    if (!confirm(`${company.companyName} 기업과 연결된 사업을 삭제할까요?`)) return;
    try {
      await deleteCompanyMutation.mutateAsync(company.id);
      toast({ title: "기업을 삭제했습니다.", description: `${company.companyName} 기업을 목록에서 숨겼습니다.` });
    } catch {
      toast({ title: "기업을 삭제하지 못했습니다.", variant: "destructive" });
    }
  };
  const deleteProject = async (project: { id?: string; projectName?: string }) => {
    if (!project.id || !project.projectName) return;
    if (!confirm(`${project.projectName} 사업을 삭제할까요?`)) return;
    try {
      await deleteProjectMutation.mutateAsync({ companyId: company.id, projectId: project.id });
      toast({ title: "사업을 삭제했습니다.", description: `${project.projectName} 사업을 목록에서 숨겼습니다.` });
    } catch {
      toast({ title: "사업을 삭제하지 못했습니다.", variant: "destructive" });
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate text-lg" role="heading" aria-level={2}>
                {company.companyName}
              </CardTitle>
              <CardDescription className="mt-1 tabular-nums">
                사업자등록번호{" "}
                {formatBusinessRegistrationNumber(
                  company.businessRegistrationNumber,
                )}
              </CardDescription>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={routes.companyProjectCreate(company.id, routes.projects)}>
              <Plus className="size-4" aria-hidden="true" />
              사업 등록
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={routes.companyEdit(company.id, routes.projects)}>
              <Settings className="size-4" aria-hidden="true" />
              기업 정보 수정
            </Link>
          </Button>
          <Button
            disabled={deleteCompanyMutation.isPending}
            onClick={() => void deleteCompany()}
            size="sm"
            type="button"
            variant="weak-danger"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            기업 삭제
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {projectsQuery.isPending ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            사업 목록을 불러오는 중입니다.
          </div>
        ) : projectsQuery.isError ? (
          <div
            className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4"
            role="alert"
          >
            <p className="text-sm text-destructive">
              사업 목록을 불러오지 못했습니다.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void projectsQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-md border border-dashed p-4">
            <p className="text-sm font-medium">아직 등록된 사업이 없습니다</p>
            <p className="mt-1 text-sm text-muted-foreground">
              이 기업의 첫 사업을 등록하면 대시보드가 생성됩니다.
            </p>
            <Button asChild className="mt-3" size="sm">
              <Link href={routes.companyProjectCreate(company.id, routes.projects)}>
                사업 등록하기
              </Link>
            </Button>
          </div>
        ) : (
          <ul
            className="divide-y rounded-md border"
            aria-label={`${company.companyName} 사업 목록`}
          >
            {projects.map((project) => (
              <li
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={project.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.projectName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.hostInstitution} · {project.agreementStartDate} ~{" "}
                    {project.agreementEndDate}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button asChild>
                    <Link
                      href={routes.project(project.id)}
                      onFocus={() => void prefetchDashboard(project.id)}
                      onMouseEnter={() => void prefetchDashboard(project.id)}
                    >
                      <FolderKanban className="size-4" aria-hidden="true" />
                      대시보드
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      href={routes.projectManagement(project.id)}
                      onFocus={() => void prefetchProject(project.id)}
                      onMouseEnter={() => void prefetchProject(project.id)}
                    >
                      <Settings className="size-4" aria-hidden="true" />
                      관리
                    </Link>
                  </Button>
                  <Button
                    disabled={deleteProjectMutation.isPending}
                    onClick={() => void deleteProject(project)}
                    type="button"
                    variant="weak-danger"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    사업 삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
