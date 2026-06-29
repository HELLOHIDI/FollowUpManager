"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Download, LogOut, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { routes, getProjectIdFromPathname } from "@/constants/routes";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh } = useCurrentUser();
  const projectId = getProjectIdFromPathname(pathname);

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
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground" aria-hidden="true">G</span>
            GrantFollow
          </Link>
          <Button variant="outline" disabled title="프로젝트 데이터 연결 후 사용할 수 있습니다.">
            기간 선택
          </Button>
          <div className="relative min-w-52 flex-1 basis-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              aria-label="전체 검색"
              className="h-9 w-full rounded-md border border-input bg-muted/30 pl-9 pr-3 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed"
              placeholder="지출 검색 (데이터 연결 예정)"
              disabled
            />
          </div>
          {projectId ? (
            <Button asChild>
              <Link href={routes.projectExpenses(projectId)}>
                <Plus className="mr-2 size-4" aria-hidden="true" /> 지출
              </Link>
            </Button>
          ) : (
            <Button disabled title="지출 등록은 프로젝트를 선택한 뒤 사용할 수 있습니다.">
              <Plus className="mr-2 size-4" aria-hidden="true" /> 지출
            </Button>
          )}
          {projectId ? (
            <Button asChild variant="outline" size="icon">
              <Link href={routes.projectExport(projectId)} aria-label="내보내기">
                <Download className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" disabled aria-label="내보내기">
              <Download className="size-4" aria-hidden="true" />
            </Button>
          )}
          <span className="max-w-44 truncate text-sm text-muted-foreground" title={user?.email ?? "관리자"}>
            {user?.email ?? "관리자"}
          </span>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="로그아웃">
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="sr-only">검색, 기간 선택, 지출 등록은 데이터 연결 단계에서 활성화됩니다.</p>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
