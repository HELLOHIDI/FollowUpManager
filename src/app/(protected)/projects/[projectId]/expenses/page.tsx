"use client";

import { use } from "react";
import { ExpenseListPageContent } from "@/features/expenses/components/expense-list-page-content";

export default function ProjectExpensesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return <ExpenseListPageContent projectId={projectId} />;
}
