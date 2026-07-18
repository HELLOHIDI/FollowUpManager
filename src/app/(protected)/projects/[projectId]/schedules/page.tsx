"use client";

import { use } from "react";
import { ScheduleManagementPage } from "@/features/project-schedules/components/schedule-management-page";

export default function ProjectSchedulePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return <ScheduleManagementPage projectId={projectId} />;
}
