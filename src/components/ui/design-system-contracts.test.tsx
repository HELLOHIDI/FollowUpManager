import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, badgeVariants } from "./badge";
import { Button, buttonVariants } from "./button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Input } from "./input";

describe("design system component contracts", () => {
  it("keeps button density and primary token defaults stable", () => {
    expect(buttonVariants({ size: "default" })).toContain("h-9");
    expect(buttonVariants({ size: "sm" })).toContain("h-8");
    expect(buttonVariants({ size: "sm" })).toContain("text-xs");
    expect(buttonVariants({ size: "lg" })).toContain("h-10");
    expect(buttonVariants({ size: "icon" })).toContain("h-9");
    expect(buttonVariants({ size: "icon" })).toContain("w-9");
    expect(buttonVariants({ variant: "default" })).toContain("bg-primary");

    render(<Button disabled>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "disabled:opacity-40",
    );
  });

  it("keeps input sizing, border, and focus token contracts stable", () => {
    render(<Input aria-label="Amount" disabled />);

    expect(screen.getByLabelText("Amount")).toHaveClass(
      "h-9",
      "border-input",
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "disabled:opacity-40",
    );
  });

  it("keeps semantic badge variants tokenized", () => {
    expect(badgeVariants({ variant: "success" })).toContain("bg-success/10");
    expect(badgeVariants({ variant: "success" })).toContain("text-success");
    expect(badgeVariants({ variant: "warning" })).toContain("bg-warning/15");
    expect(badgeVariants({ variant: "info" })).toContain("bg-info/10");
    expect(badgeVariants({ variant: "neutral" })).toContain("bg-muted");

    render(<Badge variant="destructive">Rejected</Badge>);

    expect(screen.getByText("Rejected")).toHaveClass(
      "bg-destructive",
      "text-destructive-foreground",
    );
  });

  it("keeps card surfaces compact and border-first", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Actions</CardFooter>
      </Card>,
    );

    expect(screen.getByText("Summary").closest(".rounded-md")).toHaveClass(
      "border",
      "bg-card",
      "shadow-xs",
    );
    expect(screen.getByText("Summary")).toHaveClass(
      "text-lg",
      "tracking-normal",
    );
    expect(screen.getByText("Body")).toHaveClass("p-5", "pt-0");
    expect(screen.getByText("Actions")).toHaveClass("p-5", "pt-0");
  });
});
