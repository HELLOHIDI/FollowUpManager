import { z } from "zod";
import { EXPENSE_FUNDING_SOURCE_KEYS, EXPENSE_STAGES } from "@/features/domain/contracts";

const safeAmount = z.number().int().safe().nonnegative();
const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const stageKeys = EXPENSE_STAGES.map(({ key }) => key) as [
  (typeof EXPENSE_STAGES)[number]["key"],
  ...(typeof EXPENSE_STAGES)[number]["key"][],
];

const optionalQueryValue = <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

export const ProjectExportParamsSchema = z.object({
  projectId: z.string().uuid(),
});

export const ProjectExportQuerySchema = z
  .object({
    category: optionalQueryValue(z.string().trim().min(1)),
    from: optionalQueryValue(dateValue),
    stage: optionalQueryValue(z.enum(stageKeys)),
    to: optionalQueryValue(dateValue),
  })
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from must be before or equal to to",
        path: ["from"],
      });
    }
  });

export const ProjectExportCategoryOptionSchema = z.object({
  categoryKey: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
});

export const ProjectExportStageOptionSchema = z.object({
  stageKey: z.enum(stageKeys),
  label: z.string().trim().min(1),
});

export const ProjectExportRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  fundingSourceKey: z.enum(EXPENSE_FUNDING_SOURCE_KEYS),
  amount: safeAmount,
  stageKey: z.enum(stageKeys),
  stageLabel: z.string().trim().min(1),
  expectedSpendDate: z.string().nullable(),
  executionRequestDate: z.string().nullable(),
  vendorName: z.string().nullable(),
  memo: z.string().nullable(),
  createdAt: z.string().trim().min(1),
});

export const ProjectExportResponseSchema = z.object({
  project: z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1),
  }),
  filters: z.object({
    category: z.string().nullable(),
    from: z.string().nullable(),
    stage: z.enum(stageKeys).nullable(),
    to: z.string().nullable(),
  }),
  categoryOptions: z.array(ProjectExportCategoryOptionSchema),
  stageOptions: z.array(ProjectExportStageOptionSchema),
  rows: z.array(ProjectExportRowSchema),
});

export type ProjectExportQuery = z.infer<typeof ProjectExportQuerySchema>;
export type ProjectExportResponse = z.infer<typeof ProjectExportResponseSchema>;
