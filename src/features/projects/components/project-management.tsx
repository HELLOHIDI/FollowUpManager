"use client";

import { useMemo, useState } from "react";
import { PageHeading } from "@/components/product-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { extractApiErrorCode, extractApiErrorMessage } from "@/lib/remote/api-client";
import { useCompaniesQuery } from "@/features/company/hooks/use-companies-query";
import { ProjectDocuments } from "./project-documents";
import { ProjectForm, projectToInput } from "./project-form";
import { ProjectPolicySetup } from "./project-policy-setup";
import { useProjectMutations, useProjectQuery } from "../hooks/use-projects";
import { useDirtyNavigationGuard } from "../hooks/use-dirty-navigation-guard";

export function ProjectManagement({ projectId }: { projectId: string }) {
  const projectQuery = useProjectQuery(projectId);
  const companiesQuery = useCompaniesQuery();
  const { updateMutation } = useProjectMutations();
  const { toast } = useToast();
  const [dirty, setDirty] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const project = projectQuery.data;
  const values = useMemo(() => project ? projectToInput(project) : undefined, [project]);
  const companyName = companiesQuery.data?.find((company) => company.id === project?.companyId)?.companyName ?? "등록 기업";

  useDirtyNavigationGuard(dirty);

  if (projectQuery.isPending) return <p>사업 정보를 불러오는 중입니다.</p>;
  if (!project || !values) return <p role="alert">사업 정보를 불러오지 못했습니다.</p>;

  return <>
    <PageHeading eyebrow="설정" title="사업 관리" description="사업 정보와 기관 제공 서류를 관리합니다." />
    <Card className="shadow-none"><CardHeader><CardTitle className="text-lg">사업 정보 수정</CardTitle></CardHeader><CardContent>
      <ProjectForm assignmentError={assignmentError} companyName={companyName} initialValues={values} isSubmitting={updateMutation.isPending} onDirtyChange={setDirty} onSubmit={async (input) => {
        try { setAssignmentError(null); const updated = await updateMutation.mutateAsync({ input, projectId }); setDirty(false); toast({ title: "사업 정보가 수정되었습니다.", description: `${updated.projectName} 정보를 저장했습니다.` }); }
        catch (error) { if (extractApiErrorCode(error) === "PROJECT_ASSIGNMENT_NUMBER_CONFLICT") setAssignmentError("같은 기업에 이미 등록된 과제번호입니다."); toast({ title: "사업 정보를 수정하지 못했습니다.", description: extractApiErrorMessage(error), variant: "destructive" }); }
      }} submitLabel="사업 정보 수정" />
      <ProjectDocuments projectId={projectId} />
    </CardContent></Card>
    <ProjectPolicySetup projectId={projectId} />
  </>;
}
