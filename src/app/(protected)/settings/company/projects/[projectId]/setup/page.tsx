import { use } from "react";
import { ProjectSetup } from "@/features/projects/components/project-setup";

export default function ProjectSetupPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return <ProjectSetup projectId={use(params).projectId} />;
}
