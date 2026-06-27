"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSafeRedirectPath } from "@/constants/auth";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type LoginPageProps = {
  params: Promise<Record<string, never>>;
};

export default function LoginPage({ params }: LoginPageProps) {
  void params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh, isAuthenticated } = useCurrentUser();
  const [formState, setFormState] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(getSafeRedirectPath(searchParams.get("redirectedFrom")));
    }
  }, [isAuthenticated, router, searchParams]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target;
      setFormState((previous) => ({ ...previous, [name]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const supabase = getSupabaseBrowserClient();
        const result = await supabase.auth.signInWithPassword({
          email: formState.email,
          password: formState.password,
        });

        if (result.error) {
          setErrorMessage(result.error.message || "로그인에 실패했습니다.");
          return;
        }

        await refresh();
        router.replace(getSafeRedirectPath(searchParams.get("redirectedFrom")));
      } catch {
        setErrorMessage("로그인 처리 중 오류가 발생했습니다.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [formState.email, formState.password, refresh, router, searchParams]
  );

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-normal">로그인</h1>
        <p className="text-muted-foreground">
          등록된 내부 관리자 계정으로 로그인하세요.
        </p>
      </header>
      <div className="grid w-full gap-8 md:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-md border bg-card p-5 shadow-xs"
        >
          <label className="flex flex-col gap-2 text-sm text-foreground">
            이메일
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={formState.email}
              onChange={handleChange}
              className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            비밀번호
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={formState.password}
              onChange={handleChange}
              className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </label>
          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "로그인 중" : "로그인"}
          </button>
        </form>
        <div className="grid min-h-80 overflow-hidden rounded-md border bg-card p-5" aria-hidden="true">
          <div className="grid h-full gap-4">
            <div className="rounded-md border bg-muted/40 p-4">
              <div className="h-3 w-24 rounded-full bg-primary/30" />
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="h-16 rounded-md border bg-background" />
                <div className="h-16 rounded-md border bg-background" />
                <div className="h-16 rounded-md border bg-background" />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 rounded-md border bg-background p-4">
              <div className="space-y-2">
                <div className="h-2.5 w-36 rounded-full bg-muted" />
                <div className="h-2.5 w-24 rounded-full bg-muted" />
              </div>
              <div className="size-9 rounded-md bg-primary/15" />
            </div>
            <div className="grid gap-2 rounded-md border bg-background p-4">
              <div className="h-2.5 w-full rounded-full bg-muted" />
              <div className="h-2.5 w-4/5 rounded-full bg-muted" />
              <div className="h-2.5 w-2/3 rounded-full bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
