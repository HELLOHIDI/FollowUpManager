const ROOT_PATH = "/";
const INTERNAL_ORIGIN = "http://localhost";
const PROTECTED_PATH_PREFIXES = ["/projects", "/settings"] as const;

export const LOGIN_PATH = "/login";
export const DEFAULT_AUTHENTICATED_PATH = "/projects";

export const isAuthEntryPath = (pathname: string) => pathname === LOGIN_PATH;

export const isRootPath = (pathname: string) => pathname === ROOT_PATH;

export const shouldProtectPath = (pathname: string) =>
  PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export const getSafeRedirectPath = (redirectedFrom: string | null | undefined) => {
  const candidate = redirectedFrom?.trim();

  if (
    !candidate ||
    !candidate.startsWith(ROOT_PATH) ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);

    if (
      url.origin !== INTERNAL_ORIGIN ||
      isRootPath(url.pathname) ||
      isAuthEntryPath(url.pathname) ||
      !shouldProtectPath(url.pathname)
    ) {
      return DEFAULT_AUTHENTICATED_PATH;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTHENTICATED_PATH;
  }
};

export const buildLoginRedirectPath = (pathname: string) => {
  const searchParams = new URLSearchParams({ redirectedFrom: pathname });
  return `${LOGIN_PATH}?${searchParams.toString()}`;
};
