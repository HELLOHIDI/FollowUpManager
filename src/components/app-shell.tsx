"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleHelp, LogOut, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, refresh } = useCurrentUser();

  const handleSignOut = async () => {
    await getSupabaseBrowserClient().auth.signOut();
    await refresh();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <header className="border-b bg-card" aria-label="전역 도구">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={routes.projects} className="mr-1 flex min-h-10 items-center gap-2 rounded-md font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Image src="/brand/fumanager-logo.png" alt="" width={44} height={29} className="h-8 w-auto object-contain" priority />
            <span>FuManager</span>
          </Link>
          <div className="flex-1" />
          <Button asChild size="sm" variant="outline">
            <Link href={routes.faq}>
              <CircleHelp className="size-4" aria-hidden="true" />
              FAQ
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="border-[#5865F2] bg-[#5865F2] text-white hover:border-[#4752C4] hover:bg-[#4752C4]"
          >
            <Link href={routes.discordSettings}>
              <MessageCircle className="size-4" aria-hidden="true" />
              Discord
            </Link>
          </Button>
          <span className="max-w-44 truncate text-sm text-muted-foreground" title={user?.email ?? "관리자"}>
            {user?.email ?? "관리자"}
          </span>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="로그아웃">
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
