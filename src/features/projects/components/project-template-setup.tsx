"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeading } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { useDirtyNavigationGuard } from "../hooks/use-dirty-navigation-guard";
import { useProjectQuery } from "../hooks/use-projects";
import { ProjectTemplateLinking } from "./project-template-linking";

export function ProjectTemplateSetup({ projectId }: { projectId: string }) {
  const router = useRouter();
  const projectQuery = useProjectQuery(projectId);
  const [dirty, setDirty] = useState(false);
  const projectName = projectQuery.data?.projectName ?? "등록된 사업";

  useDirtyNavigationGuard(dirty);

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

  if (!projectQuery.data) return <p role="alert">사업 정보를 불러오지 못했습니다.</p>;

  return (
    <>
      <PageHeading
        eyebrow="사업 설정"
        title={`${projectName} 기관 양식 연결`}
        description="기관 양식 파일을 업로드하고 비목별 증빙서류에 드래그 앤 드랍으로 연결합니다."
        actions={
          <Button type="button" variant="outline" onClick={() => router.push(routes.project(projectId))}>
            대시보드로 이동
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      <ProjectTemplateLinking projectId={projectId} onDirtyChange={setDirty} onSaved={() => router.push(routes.project(projectId))} />
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(routes.project(projectId))}>
          건너뛰기
        </Button>
      </div>
    </>
  );
}
