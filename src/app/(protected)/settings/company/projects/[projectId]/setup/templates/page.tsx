import { use } from "react";
import { ProjectTemplateSetup } from "@/features/projects/components/project-template-setup";

export default function ProjectTemplateSetupPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return <ProjectTemplateSetup projectId={use(params).projectId} />;
}
