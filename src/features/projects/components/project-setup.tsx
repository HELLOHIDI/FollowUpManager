"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { ProgramPolicyPanel } from "@/features/program-evidence-policy/components/program-policy-panel";
import { useProjectQuery } from "../hooks/use-projects";

export function ProjectSetup({ projectId }: { projectId: string }) {
  const router = useRouter();
  const projectQuery = useProjectQuery(projectId);
  const projectName = projectQuery.data?.projectName ?? "등록된 사업";

  if (projectQuery.isPending) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          사업 설정 정보를 불러오는 중입니다.
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
        eyebrow="사업 설정"
        title={`${projectName} 설정`}
        description="정책 PDF에서 비목과 증빙서류 초안을 확인하고 참고 파일을 등록합니다."
        actions={
          <Button type="button" variant="outline" onClick={() => router.push(routes.project(projectId))}>
            대시보드로 이동
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        }
      />

      <div className="grid gap-6">
        <ProgramPolicyPanel projectId={projectId} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(routes.project(projectId))}>
            건너뛰기
          </Button>
          <Button type="button" onClick={() => router.push(routes.projectSetupTemplates(projectId))}>
            기관 양식 연결
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </>
  );
}
