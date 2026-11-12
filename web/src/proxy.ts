import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ADMIN = /^\/admin\/(login|invite|reset)(\/|$)/;
const SESSION = "gg_session";

/**
 * Optimistic check only: no session cookie → straight to /login. The panel layout
 * and the API validate the session for real on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_ADMIN.test(pathname) || request.cookies.has(SESSION)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin", "/admin/:path*", "/account"] };
