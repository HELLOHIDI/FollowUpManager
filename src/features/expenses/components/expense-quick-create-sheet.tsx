"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPENSE_FUNDING_SOURCE_BASE_KEYS,
  type ExpenseFundingSourceBaseKey,
  type ExpenseFundingSourceKey,
} from "@/features/domain/contracts";
import { requiresSubcategorySelection } from "../lib/policy-category-options";
import type { ExpenseCreateInput } from "../backend/schema";

type CategoryOption = {
  categoryKey: string;
  categoryName: string;
  sortOrder: number;
  subcategories?: Array<{
    subcategoryKey: string;
    subcategoryName: string;
    sortOrder: number;
  }>;
};

type FundingSourceOption = {
  fundingSourceKey: ExpenseFundingSourceKey;
  label: string;
};

type ExpenseQuickCreateFormValues = {
  title: string;
  categoryKey: string;
  subcategoryKey: string;
  fundingSourceKey: FundingSourceOption["fundingSourceKey"];
  amount: number;
  expectedSpendDate: string;
  memo: string;
};

const buildDefaultValues = (
  categoryOptions: ReadonlyArray<CategoryOption>,
  fundingSourceOptions: ReadonlyArray<FundingSourceOption>,
): ExpenseQuickCreateFormValues => {
  const firstCategory = categoryOptions[0];
  const firstFundingSource = fundingSourceOptions[0];
  return {
    title: "",
    categoryKey: firstCategory?.categoryKey ?? "",
    subcategoryKey: "",
    fundingSourceKey: firstFundingSource?.fundingSourceKey ?? "government_subsidy",
    amount: 0,
    expectedSpendDate: "",
    memo: "",
  };
};

const fundingSourceLabels = new Map<string, string>([
  ["government_subsidy", "정부지원금"],
  ["self_cash", "현금"],
  ["self_in_kind", "현물"],
]);

const splitFundingSourceKey = (key: ExpenseFundingSourceKey) =>
  key.split("+") as ExpenseFundingSourceBaseKey[];

const joinFundingSourceKeys = (keys: ReadonlyArray<ExpenseFundingSourceBaseKey>) =>
  keys.join("+") as ExpenseFundingSourceKey;

export function ExpenseQuickCreateSheet({
  categoryOptions,
  fundingSourceOptions,
  isSubmitting,
  onOpenChange,
  open,
  onSubmit,
}: {
  categoryOptions: CategoryOption[];
  fundingSourceOptions: ReadonlyArray<FundingSourceOption>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  onSubmit: (input: ExpenseCreateInput) => Promise<void>;
}) {
  const form = useForm<ExpenseQuickCreateFormValues>({
    defaultValues: buildDefaultValues(categoryOptions, fundingSourceOptions),
  });
  const selectedCategoryKey = form.watch("categoryKey");
  const selectedCategory = categoryOptions.find((option) => option.categoryKey === selectedCategoryKey);
  const subcategoryOptions = useMemo(() => selectedCategory?.subcategories ?? [], [selectedCategory]);
  const baseFundingSourceOptions = useMemo(
    () => EXPENSE_FUNDING_SOURCE_BASE_KEYS.map((key) => ({
      fundingSourceKey: key,
      label: fundingSourceOptions.find((option) => option.fundingSourceKey === key)?.label ?? fundingSourceLabels.get(key) ?? key,
    })),
    [fundingSourceOptions],
  );

  useEffect(() => {
    form.reset(buildDefaultValues(categoryOptions, fundingSourceOptions));
  }, [categoryOptions, fundingSourceOptions, form, open]);

  useEffect(() => {
    if (subcategoryOptions.some((option) => option.subcategoryKey === form.getValues("subcategoryKey"))) {
      return;
    }
    form.setValue("subcategoryKey", "");
  }, [form, selectedCategoryKey, subcategoryOptions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>지출 빠른 등록</SheetTitle>
          <SheetDescription>페이지 이동 없이 최소 정보로 지출을 등록합니다.</SheetDescription>
        </SheetHeader>
        <form
          className="mt-6 grid gap-4"
          onSubmit={form.handleSubmit(async (values) => {
            if (requiresSubcategorySelection(selectedCategory) && !values.subcategoryKey) {
              form.setError("subcategoryKey", { message: "하위비목을 선택해 주세요.", type: "required" });
              return;
            }
            form.clearErrors("subcategoryKey");
            await onSubmit({
              ...values,
              amount: Number(values.amount),
              expectedSpendDate: values.expectedSpendDate ? values.expectedSpendDate : null,
              memo: values.memo.trim() ? values.memo.trim() : null,
              subcategoryKey: values.subcategoryKey || null,
            });
          })}
        >
          <div className="grid gap-2">
            <Label htmlFor="expense-title">지출 제목</Label>
            <Input id="expense-title" {...form.register("title", { required: true })} placeholder="예: 시제품 재료 구입" />
          </div>
          {subcategoryOptions.length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="expense-subcategory">Subcategory</Label>
              <Controller
                control={form.control}
                name="subcategoryKey"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="expense-subcategory">
                      <SelectValue placeholder="Select a subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategoryOptions.map((option) => (
                        <SelectItem key={option.subcategoryKey} value={option.subcategoryKey}>
                          {option.subcategoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.subcategoryKey?.message ? (
                <p className="text-sm text-destructive">{form.formState.errors.subcategoryKey.message}</p>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="expense-category">비목</Label>
            <Controller
              control={form.control}
              name="categoryKey"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="expense-category">
                    <SelectValue placeholder="비목을 선택해 주세요." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.categoryKey} value={option.categoryKey}>
                        {option.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-funding-source">재원 구분</Label>
            <Controller
              control={form.control}
              name="fundingSourceKey"
              render={({ field }) => (
                <div className="grid gap-2">
                  <div id="expense-funding-source" className="grid grid-cols-3 gap-2" role="group" aria-label="재원 구분">
                    {baseFundingSourceOptions.map((option) => {
                      const selectedKeys = splitFundingSourceKey(field.value);
                      const checked = selectedKeys.includes(option.fundingSourceKey);
                      return (
                        <label
                          key={option.fundingSourceKey}
                          className={[
                            "flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors",
                            checked ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-foreground hover:bg-muted",
                          ].join(" ")}
                        >
                          <input
                            checked={checked}
                            className="sr-only"
                            onChange={() => {
                              const nextKeys = checked
                                ? selectedKeys.filter((key) => key !== option.fundingSourceKey)
                                : EXPENSE_FUNDING_SOURCE_BASE_KEYS.filter((key) => [...selectedKeys, option.fundingSourceKey].includes(key));
                              if (nextKeys.length === 0) return;
                              field.onChange(joinFundingSourceKeys(nextKeys));
                            }}
                            type="checkbox"
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    선택: {splitFundingSourceKey(field.value).map((key) => fundingSourceLabels.get(key) ?? key).join(" + ")}
                  </p>
                </div>
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-amount">금액</Label>
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <NumberInput
                  id="expense-amount"
                  onBlur={field.onBlur}
                  onValueChange={(value) => field.onChange(Number(value || 0))}
                  value={field.value}
                />
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-date">지출 예정일 (선택)</Label>
            <Input id="expense-date" type="date" {...form.register("expectedSpendDate")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-memo">메모</Label>
            <Textarea id="expense-memo" {...form.register("memo")} placeholder="선택 입력" />
          </div>
          <SheetFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={isSubmitting || categoryOptions.length === 0}>등록</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
