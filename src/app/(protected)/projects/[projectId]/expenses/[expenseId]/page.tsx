"use client";

import { use } from "react";
import { ExpenseDetailPageContent } from "@/features/expenses/components/expense-detail-page-content";

export default function ExpenseDetailPage({ params }: { params: Promise<{ projectId: string; expenseId: string }> }) {
  const { projectId, expenseId } = use(params);
  return <ExpenseDetailPageContent projectId={projectId} expenseId={expenseId} />;
}
