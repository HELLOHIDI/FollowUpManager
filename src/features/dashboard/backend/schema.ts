import { z } from "zod";
import { EXPENSE_STAGES } from "@/features/domain/contracts";

const safeAmount = z.number().int().safe().nonnegative();
const stageKeys = EXPENSE_STAGES.map(({ key }) => key) as [
  (typeof EXPENSE_STAGES)[number]["key"],
  ...(typeof EXPENSE_STAGES)[number]["key"][],
];

export const DashboardParamsSchema = z.object({ projectId: z.string().uuid() });

export const DashboardExpenseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  amount: safeAmount,
  stageKey: z.enum(stageKeys),
  evidenceUploadedCount: z.number().int().nonnegative().optional(),
  evidenceRequiredCount: z.number().int().nonnegative().optional(),
});

export const DashboardCategorySchema = z.object({
  categoryKey: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  expenseCount: z.number().int().nonnegative(),
  totalAmount: safeAmount,
  expenses: z.array(DashboardExpenseSchema),
}).superRefine((category, context) => {
  if (category.expenseCount !== category.expenses.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Category expense count mismatch" });
  }
  if (category.totalAmount !== category.expenses.reduce((total, expense) => total + expense.amount, 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Category amount mismatch" });
  }
});

export const DashboardResponseSchema = z.object({
  project: z.object({ id: z.string().uuid(), name: z.string().trim().min(1) }),
  kpis: z.object({
    totalBudget: safeAmount,
    spentAmount: safeAmount,
    remainingAmount: safeAmount,
    burnRatio: z.number().min(0).max(1),
  }),
  categories: z.array(DashboardCategorySchema),
});

export const DashboardSnapshotSchema = z.object({
  project: z.object({ id: z.string().uuid(), name: z.string().trim().min(1) }).nullable(),
  kpis: z.object({
    totalBudget: safeAmount,
    spentAmount: safeAmount,
    remainingAmount: z.number().int().safe(),
    burnRatio: z.number(),
  }).nullable(),
  activeExpenseCount: z.number().int().nonnegative(),
  expenseRows: z.array(z.object({
    categoryKey: z.string().trim().min(1),
    categoryName: z.string().trim().min(1),
    categorySortOrder: z.number().int(),
    id: z.string().uuid(),
    title: z.string().trim().min(1),
    amount: safeAmount,
    stageKey: z.enum(stageKeys),
    evidenceUploadedCount: z.number().int().nonnegative().optional(),
    evidenceRequiredCount: z.number().int().nonnegative().optional(),
  })),
  integrityCode: z.string().nullable(),
});

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
