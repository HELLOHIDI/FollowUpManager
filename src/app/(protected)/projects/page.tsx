"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  FolderKanban,
  Loader2,
  Plus,
  Settings,
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
import {
  COMPANY_ACCOUNT_MANAGER_OPTIONS,
  type CompanyResponse,
} from "@/features/company/lib/dto";
import {
  useCompanyProjectsQuery,
  useProjectNavigationPrefetch,
} from "@/features/projects/hooks/use-projects";
import { cn } from "@/lib/utils";

const TEAM_FILTER_OPTIONS = ["전체", "1팀", "2팀", "블랜"] as const;
type TeamFilter = (typeof TEAM_FILTER_OPTIONS)[number];

export default function ProjectsPage() {
  const companiesQuery = useCompaniesQuery();
  const companies = companiesQuery.data ?? [];
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("전체");
  const managerSections = COMPANY_ACCOUNT_MANAGER_OPTIONS.filter(
    (manager) => teamFilter === "전체" || manager.team.includes(teamFilter),
  ).map((manager) => ({
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
          <div className="flex flex-wrap items-center gap-4">
            <label className="sr-only" htmlFor="team-filter">
              팀 필터
            </label>
            <select
              className="h-10 min-w-24 rounded-md border border-input bg-background py-2 pl-3 pr-10 text-sm font-medium text-foreground shadow-xs focus:outline-hidden focus:ring-2 focus:ring-ring"
              id="team-filter"
              onChange={(event) => setTeamFilter(event.target.value as TeamFilter)}
              value={teamFilter}
            >
              {TEAM_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button asChild>
              <Link href={routes.companyCreate(routes.projects)}>
                <Building2 className="size-4" aria-hidden="true" />
                기업 추가하기
              </Link>
            </Button>
          </div>
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
        <div className="-mx-4 overflow-x-auto px-4 pb-3">
          <section
            className="flex w-max gap-4"
            aria-label="담당자별 기업과 사업"
          >
            {managerSections.map((manager) => (
              <section
                className="grid w-80 shrink-0 content-start gap-3 rounded-lg border bg-card p-3"
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
  const { prefetchDashboard, prefetchProject } = useProjectNavigationPrefetch();
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const projects = projectsQuery.data ?? [];

  return (
    <Card className="overflow-hidden rounded-md border bg-background shadow-none">
      <CardHeader className="gap-3 p-4">
        <button
          aria-controls={contentId}
          aria-expanded={isOpen}
          className="flex min-w-0 items-center gap-2 text-left"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
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
            </div>
          </div>
          <ChevronDown
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      </CardHeader>
      {isOpen ? (
        <CardContent className="p-4 pt-0" id={contentId}>
          <div className="mb-3 grid grid-cols-2 gap-2 border-b pb-3">
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
          </div>
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
              <p className="text-sm font-medium">
                아직 등록된 사업이 없습니다
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                이 기업의 첫 사업을 등록하면 대시보드가 생성됩니다.
              </p>
            </div>
          ) : (
            <ul
              className="grid gap-2"
              aria-label={`${company.companyName} 사업 목록`}
            >
              {projects.map((project) => (
                <li
                  className="grid gap-3 rounded-md border p-3"
                  key={project.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {project.projectName}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild size="sm">
                      <Link
                        href={routes.project(project.id)}
                        onFocus={() => void prefetchDashboard(project.id)}
                        onMouseEnter={() => void prefetchDashboard(project.id)}
                      >
                        <FolderKanban className="size-4" aria-hidden="true" />
                        대시보드
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={routes.projectManagement(project.id)}
                        onFocus={() => void prefetchProject(project.id)}
                        onMouseEnter={() => void prefetchProject(project.id)}
                      >
                        <Settings className="size-4" aria-hidden="true" />
                        관리
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
