"use client";

import * as React from "react";
import { Input, type InputProps } from "./input";

export const digitsOnly = (value: string | number | null | undefined) =>
  String(value ?? "").replace(/\D/g, "");

export const formatNumberInput = (value: string | number | null | undefined) => {
  const digits = digitsOnly(value).replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export interface NumberInputProps
  extends Omit<InputProps, "inputMode" | "onChange" | "type" | "value" | "variant"> {
  onValueChange: (value: string) => void;
  value: string | number | null | undefined;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ onValueChange, value, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      inputMode="numeric"
      onChange={(event) => onValueChange(digitsOnly(event.target.value))}
      type="text"
      value={formatNumberInput(value)}
      variant="amount"
    />
  ),
);
NumberInput.displayName = "NumberInput";
