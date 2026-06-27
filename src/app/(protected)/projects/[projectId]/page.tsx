"use client";

import { use } from "react";
import { DashboardPageContent } from "@/features/dashboard/components/dashboard-page-content";

export default function ProjectDashboardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return <DashboardPageContent projectId={projectId} />;
}
