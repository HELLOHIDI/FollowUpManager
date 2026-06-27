"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CircleDashed } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PageHeading({
  eyebrow,
  title,
  description,
  backHref,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  backHref?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backHref ? (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            돌아가기
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="mb-1 text-sm font-medium text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardHeader>
        <span
          className="mb-2 grid size-10 place-items-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <CircleDashed className="size-5" />
        </span>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="max-w-2xl leading-6">
          {description}
        </CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}
