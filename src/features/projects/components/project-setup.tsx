"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { ProgramPolicyPanel } from "@/features/program-evidence-policy/components/program-policy-panel";
import { ProjectDocuments } from "./project-documents";
import { useProjectQuery } from "../hooks/use-projects";

export function ProjectSetup({ projectId }: { projectId: string }) {
  const router = useRouter();
  const projectQuery = useProjectQuery(projectId);
  const projectName = projectQuery.data?.projectName ?? "등록한 사업";

  if (projectQuery.isPending) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          사업 세팅 정보를 불러오는 중입니다.
        </CardContent>
      </Card>
    );
  }

  if (!projectQuery.data) {
    return <p role="alert">사업 정보를 불러오지 못했습니다.</p>;
  }

  return (
    <>
      <PageHeading
        eyebrow="사업 세팅"
        title={`${projectName} 세팅`}
        description="정책 PDF와 기관 제공 파일을 구분해서 등록한 뒤, 비목과 증빙서류 초안을 확인합니다."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(routes.project(projectId))}
          >
            대시보드로 이동
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        }
      />

      <div className="grid gap-6">
        <ProgramPolicyPanel projectId={projectId} redirectOnConfirm />

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">기관 제공 파일</CardTitle>
            <CardDescription>
              협약서, 안내문, 참고자료처럼 보관이 필요한 파일을 등록합니다. 이 파일들은 V1 자동 추출에는 사용하지 않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectDocuments projectId={projectId} embedded />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
