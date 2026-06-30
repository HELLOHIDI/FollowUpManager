import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-normal transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        "fill-primary":
          "border-transparent bg-primary text-primary-foreground hover:bg-[#2272eb]",
        "fill-green":
          "border-transparent bg-success text-success-foreground hover:bg-success/90",
        "fill-red":
          "border-transparent bg-destructive text-destructive-foreground hover:bg-[#e42939]",
        "fill-yellow":
          "border-transparent bg-warning text-warning-foreground hover:bg-warning/90",
        "weak-primary":
          "border-transparent bg-[#e8f3ff] text-[#2272eb] hover:bg-[#d7eaff]",
        "weak-green":
          "border-transparent bg-[#e6f8f1] text-[#008f5a] hover:bg-[#d7f3e8]",
        "weak-red":
          "border-transparent bg-[#ffe7e9] text-[#e42939] hover:bg-[#ffd8dc]",
        "weak-yellow":
          "border-transparent bg-[#fff4d6] text-[#a15c00] hover:bg-[#ffedbd]",
        "weak-gray":
          "border-transparent bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]",
        default:
          "border-transparent bg-[#e8f3ff] text-[#2272eb] hover:bg-[#d7eaff]",
        secondary:
          "border-transparent bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]",
        destructive:
          "border-transparent bg-[#ffe7e9] text-[#e42939] hover:bg-[#ffd8dc]",
        success:
          "border-transparent bg-[#e6f8f1] text-[#008f5a] hover:bg-[#d7f3e8]",
        warning:
          "border-transparent bg-[#fff4d6] text-[#a15c00] hover:bg-[#ffedbd]",
        info:
          "border-transparent bg-[#e8f3ff] text-[#2272eb] hover:bg-[#d7eaff]",
        neutral:
          "border-transparent bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]",
        outline: "border-[#e5e8eb] text-[#4e5968]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
