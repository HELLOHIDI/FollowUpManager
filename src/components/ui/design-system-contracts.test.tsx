import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Badge, badgeVariants } from "./badge";
import { Button, buttonVariants } from "./button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Input, inputVariants } from "./input";
import { NumberInput, digitsOnly, formatNumberInput } from "./number-input";

describe("design system component contracts", () => {
  it("keeps Toss-style fill and weak button contracts stable", () => {
    expect(buttonVariants({ size: "default" })).toContain("h-10");
    expect(buttonVariants({ size: "sm" })).toContain("h-8");
    expect(buttonVariants({ size: "sm" })).toContain("text-xs");
    expect(buttonVariants({ size: "lg" })).toContain("h-12");
    expect(buttonVariants({ size: "icon" })).toContain("h-10");
    expect(buttonVariants({ size: "icon" })).toContain("w-10");
    expect(buttonVariants({ variant: "fill-primary" })).toContain(
      "bg-primary",
    );
    expect(buttonVariants({ variant: "weak-primary" })).toContain(
      "bg-[#e8f3ff]",
    );
    expect(buttonVariants({ variant: "default" })).toContain("bg-primary");

    render(<Button disabled>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "disabled:opacity-40",
    );

    render(<Button variant="link">Details</Button>);

    expect(screen.getByRole("button", { name: "Details" })).toHaveClass(
      "h-auto",
      "px-0",
      "py-0",
    );
  });

  it("keeps Toss-style input variants stable", () => {
    expect(inputVariants({ variant: "box" })).toContain("h-11");
    expect(inputVariants({ variant: "box" })).toContain("bg-[#f9fafb]");
    expect(inputVariants({ variant: "amount" })).toContain("text-right");
    expect(inputVariants({ variant: "amount" })).toContain("tabular-nums");
    expect(inputVariants({ variant: "compact" })).toContain("h-8");

    render(<Input aria-label="Amount" disabled variant="amount" />);

    expect(screen.getByLabelText("Amount")).toHaveClass(
      "h-11",
      "text-right",
      "tabular-nums",
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "disabled:opacity-40",
    );
  });

  it("formats numeric input while emitting raw digits", () => {
    expect(formatNumberInput("1234567")).toBe("1,234,567");
    expect(digitsOnly("1,234,567원")).toBe("1234567");

    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Budget" onValueChange={onValueChange} value="1234567" />);

    const input = screen.getByLabelText("Budget");
    expect(input).toHaveValue("1,234,567");
    fireEvent.change(input, { target: { value: "9,876" } });
    expect(onValueChange).toHaveBeenCalledWith("9876");
  });

  it("keeps Toss-style weak and fill badge variants stable", () => {
    expect(badgeVariants({ variant: "weak-primary" })).toContain(
      "bg-[#e8f3ff]",
    );
    expect(badgeVariants({ variant: "weak-green" })).toContain(
      "bg-[#e6f8f1]",
    );
    expect(badgeVariants({ variant: "weak-yellow" })).toContain(
      "bg-[#fff4d6]",
    );
    expect(badgeVariants({ variant: "weak-gray" })).toContain("bg-[#f2f4f6]");
    expect(badgeVariants({ variant: "fill-red" })).toContain(
      "bg-destructive",
    );

    render(<Badge variant="fill-red">Rejected</Badge>);

    expect(screen.getByText("Rejected")).toHaveClass(
      "bg-destructive",
      "text-destructive-foreground",
    );
  });

  it("keeps Toss-style card surfaces stable", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Actions</CardFooter>
      </Card>,
    );

    expect(screen.getByText("Summary").closest(".rounded-xl")).toHaveClass(
      "border-0",
      "bg-card",
      "shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
    );
    expect(screen.getByText("Summary")).toHaveClass(
      "text-lg",
      "font-bold",
      "tracking-normal",
    );
    expect(screen.getByText("Body")).toHaveClass("p-6", "pt-0");
    expect(screen.getByText("Actions")).toHaveClass("p-6", "pt-0");
  });
});
