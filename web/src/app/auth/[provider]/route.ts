import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { OAUTH_COOKIE, authorizeUrl, configured, isProvider, newFlow, redirectUri } from "@/lib/oauth";

/** Starts GitHub / Google sign-in: remembers state + PKCE verifier in a short-lived cookie, then redirects. */
export async function GET(request: NextRequest, { params }: RouteContext<"/auth/[provider]">) {
  const { provider } = await params;
  if (!isProvider(provider) || !configured(provider)) return new NextResponse("Not found", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const flow = newFlow();
  const redirect = redirectUri(provider, request.nextUrl.origin);
  (await cookies()).set(
    OAUTH_COOKIE,
    Buffer.from(
      JSON.stringify({ p: provider, s: flow.state, v: flow.verifier, n: safeNext(sp.get("next")), i: sp.get("invite") ?? "" }),
    ).toString("base64url"),
    { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/auth", maxAge: 600 },
  );
  return NextResponse.redirect(authorizeUrl(provider, { state: flow.state, challenge: flow.challenge, redirect }));
}
