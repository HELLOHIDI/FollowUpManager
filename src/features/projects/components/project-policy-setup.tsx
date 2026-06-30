"use client";

import { ProgramPolicyPanel } from "@/features/program-evidence-policy/components/program-policy-panel";

export function ProjectPolicySetup({ projectId }: { projectId: string }) {
  return <ProgramPolicyPanel projectId={projectId} />;
}
