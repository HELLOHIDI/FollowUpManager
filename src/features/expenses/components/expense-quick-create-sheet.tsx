"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ExpenseCreateInput } from "../backend/schema";

type CategoryOption = {
  categoryKey: string;
  categoryName: string;
  sortOrder: number;
};

type FundingSourceOption = {
  fundingSourceKey: "government_subsidy" | "self_cash" | "self_in_kind";
  label: string;
};

type ExpenseQuickCreateFormValues = {
  title: string;
  categoryKey: string;
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
    fundingSourceKey: firstFundingSource?.fundingSourceKey ?? "government_subsidy",
    amount: 0,
    expectedSpendDate: "",
    memo: "",
  };
};

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

  useEffect(() => {
    form.reset(buildDefaultValues(categoryOptions, fundingSourceOptions));
  }, [categoryOptions, fundingSourceOptions, form, open]);

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
            await onSubmit({
              ...values,
              amount: Number(values.amount),
              expectedSpendDate: values.expectedSpendDate ? values.expectedSpendDate : null,
              memo: values.memo.trim() ? values.memo.trim() : null,
            });
          })}
        >
          <div className="grid gap-2">
            <Label htmlFor="expense-title">지출 제목</Label>
            <Input id="expense-title" {...form.register("title", { required: true })} placeholder="예: 시제품 재료 구입" />
          </div>
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="expense-funding-source">
                    <SelectValue placeholder="재원 구분을 선택해 주세요." />
                  </SelectTrigger>
                  <SelectContent>
                    {fundingSourceOptions.map((option) => (
                      <SelectItem key={option.fundingSourceKey} value={option.fundingSourceKey}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-amount">금액</Label>
            <Input id="expense-amount" inputMode="numeric" type="number" min={0} step={1} {...form.register("amount", { valueAsNumber: true, required: true })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-date">지출 예정일</Label>
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
