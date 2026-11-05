import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import { PREVIEW_COOKIE, verifyPreview } from "@/lib/modules/portal/preview";

/** Paths that work without signing in. `/api/v1` checks its own Bearer API key; `/api/cron` checks `CRON_SECRET`. */
const PUBLIC_PATHS = ["/login", "/invite", "/reset", "/auth", "/api/v1", "/api/cron"];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Refreshes the Supabase session cookie on every request and sends signed-out users to /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put code between createServerClient and getClaims(): it refreshes the token.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const dropPreview = stalePreview(request, data?.claims?.sub);

  if (!signedIn && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/") url.searchParams.set("next", next);
    const redirect = NextResponse.redirect(url);
    if (dropPreview) redirect.cookies.delete(PREVIEW_COOKIE);
    return redirect;
  }

  if (dropPreview) response.cookies.delete(PREVIEW_COOKIE);
  return response;
}

/** A "See as client" cookie that is forged, expired or someone else's: the app ignores it and this clears it. */
function stalePreview(request: NextRequest, userId: unknown) {
  const token = request.cookies.get(PREVIEW_COOKIE)?.value;
  if (!token) return false;
  const p = verifyPreview(token, process.env.SUPABASE_SECRET_KEY);
  return !p || p.staffId !== userId;
}
