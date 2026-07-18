import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full border text-sm text-[#333d4b] shadow-none transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#b0b8c1] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        box: "h-11 rounded-[10px] border-[#e5e8eb] bg-[#f9fafb] px-4 py-2",
        amount:
          "h-11 rounded-[10px] border-[#e5e8eb] bg-[#f9fafb] px-4 py-2 text-right font-semibold tabular-nums",
        search:
          "h-10 rounded-[10px] border-[#e5e8eb] bg-[#f9fafb] px-4 py-2",
        compact:
          "h-8 rounded-lg border-[#e5e8eb] bg-white px-2.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "box",
    },
  },
);

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)]
    .filter(Boolean)
    .join("-");
};

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, onChange, ...props }, ref) => {
    const isDate = type === "date";
    return (
      <input
        type={isDate ? "text" : type}
        inputMode={isDate ? "numeric" : props.inputMode}
        maxLength={isDate ? 10 : props.maxLength}
        placeholder={isDate ? "YYYY-MM-DD" : props.placeholder}
        className={cn(inputVariants({ variant }), className)}
        ref={ref}
        onChange={isDate ? (event) => {
          event.currentTarget.value = formatDateInput(event.currentTarget.value);
          onChange?.(event);
        } : onChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
