"use client";

import { use } from "react";
import { ProjectExportPageContent } from "@/features/project-export/components/project-export-page-content";

export default function ExportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);

  return <ProjectExportPageContent projectId={projectId} />;
}
