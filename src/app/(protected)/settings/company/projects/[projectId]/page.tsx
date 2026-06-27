"use client";

import { use } from "react";
import { ProjectManagement } from "@/features/projects/components/project-management";

export default function ProjectManagementPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <ProjectManagement projectId={use(params).projectId} />;
}
