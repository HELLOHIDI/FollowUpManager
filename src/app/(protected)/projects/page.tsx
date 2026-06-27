"use client";

import Link from "next/link";
import { ArrowRight, Building2, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/product-shell";
import { routes } from "@/constants/routes";

export default function ProjectsPage() {
  return (
    <>
      <PageHeading
        eyebrow="시작하기"
        title="프로젝트를 선택하세요"
        description="등록된 프로젝트가 생기면 이곳에서 선택해 지출 현황 대시보드로 이동할 수 있습니다."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-dashed shadow-none">
          <CardHeader className="items-start">
            <span className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <FolderKanban className="size-6" />
            </span>
            <CardTitle className="pt-3 text-xl">아직 선택할 프로젝트가 없습니다</CardTitle>
            <CardDescription className="max-w-xl leading-6">
              프로젝트 목록과 생성 기능은 데이터 수직 슬라이스에서 연결합니다. 먼저 기업 기본 정보를 확인해 초기 설정을 준비하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={routes.companySettings}>
                기업 정보 설정 <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <Building2 className="size-5 text-primary" aria-hidden="true" />
            <CardTitle className="text-base">설정 순서</CardTitle>
            <CardDescription>실제 저장 기능이 연결되면 다음 순서로 시작합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li><span className="mr-2 font-semibold text-primary">1.</span>기업 기본 정보 입력</li>
              <li><span className="mr-2 font-semibold text-primary">2.</span>지원 사업과 예산 등록</li>
              <li><span className="mr-2 font-semibold text-primary">3.</span>프로젝트 대시보드 확인</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
