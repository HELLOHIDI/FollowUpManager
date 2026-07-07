import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold tracking-normal ring-offset-background transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        "fill-primary": "bg-primary text-primary-foreground hover:bg-[#2272eb]",
        "fill-dark": "bg-[#4e5968] text-white hover:bg-[#333d4b]",
        "fill-danger":
          "bg-destructive text-destructive-foreground hover:bg-[#e42939]",
        "weak-primary": "bg-[#e8f3ff] text-[#2272eb] hover:bg-[#d7eaff]",
        "weak-neutral": "bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]",
        "weak-danger": "bg-[#ffe7e9] text-[#e42939] hover:bg-[#ffd8dc]",
        default: "bg-primary text-primary-foreground hover:bg-[#2272eb]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[#e42939]",
        outline:
          "border border-input bg-background text-[#4e5968] hover:bg-[#f2f4f6] hover:text-[#333d4b]",
        secondary:
          "bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]",
        ghost: "text-[#4e5968] hover:bg-[#f2f4f6] hover:text-[#333d4b]",
        link: "h-auto rounded-none px-0 text-[#2272eb] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-5 text-base",
        xl: "h-13 rounded-xl px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    compoundVariants: [
      {
        variant: "link",
        className: "h-auto px-0 py-0",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
