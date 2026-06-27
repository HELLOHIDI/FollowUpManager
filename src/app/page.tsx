"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_AUTHENTICATED_PATH,
  LOGIN_PATH,
} from "@/constants/auth";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    router.replace(isAuthenticated ? DEFAULT_AUTHENTICATED_PATH : LOGIN_PATH);
  }, [isAuthenticated, isLoading, router]);

  return null;
}
