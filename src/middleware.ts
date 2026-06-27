import { createServerClient } from "@supabase/ssr";
import { match } from "ts-pattern";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_AUTHENTICATED_PATH,
  LOGIN_PATH,
  isAuthEntryPath,
  isRootPath,
  shouldProtectPath,
} from "@/constants/auth";
import { env } from "@/constants/env";
import type { Database } from "@/lib/supabase/types";

const copyCookies = (from: NextResponse, to: NextResponse) => {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set({
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      maxAge: cookie.maxAge,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
    });
  });

  return to;
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  return match({ user, pathname })
    .when(
      ({ user: currentUser, pathname: currentPathname }) =>
        Boolean(currentUser) &&
        (isRootPath(currentPathname) || isAuthEntryPath(currentPathname)),
      () => {
        const projectsUrl = request.nextUrl.clone();
        projectsUrl.pathname = DEFAULT_AUTHENTICATED_PATH;
        projectsUrl.search = "";
        return copyCookies(response, NextResponse.redirect(projectsUrl));
      }
    )
    .when(
      ({ user: currentUser, pathname: currentPathname }) =>
        !currentUser && isRootPath(currentPathname),
      () => {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = LOGIN_PATH;
        loginUrl.search = "";
        return copyCookies(response, NextResponse.redirect(loginUrl));
      }
    )
    .when(
      ({ user: currentUser, pathname: currentPathname }) =>
        !currentUser && shouldProtectPath(currentPathname),
      ({ pathname: currentPathname }) => {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = LOGIN_PATH;
        loginUrl.search = "";
        loginUrl.searchParams.set(
          "redirectedFrom",
          `${currentPathname}${request.nextUrl.search}`
        );
        return copyCookies(response, NextResponse.redirect(loginUrl));
      }
    )
    .otherwise(() => response);
}

export const config = {
  matcher: [
    "/((?!_health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
