"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { buildLoginRedirectPath } from "@/constants/auth";
import { AppShell } from "@/components/app-shell";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { isAuthenticated, isLoading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(buildLoginRedirectPath(pathname));
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (!isAuthenticated) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
