import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { api, ApiError } from "@/lib/api";
import { clientHeaders, safeNext, setSessionCookie } from "@/lib/auth";
import { OAUTH_COOKIE, fetchIdentity, isProvider, redirectUri } from "@/lib/oauth";

type Flow = { p: string; s: string; v: string; n: string; i: string };

/** Provider sends the user back here: check state, read the verified identity, ask the API for a session. */
export async function GET(request: NextRequest, { params }: RouteContext<"/auth/[provider]/callback">) {
  const { provider } = await params;
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/auth" });

  const fail = (code: string, flow?: Flow | null) => {
    const back = flow?.i ? `/admin/invite/${encodeURIComponent(flow.i)}` : "/admin/login";
    const url = new URL(back, request.nextUrl.origin);
    if (!flow?.i) url.searchParams.set("error", code);
    return NextResponse.redirect(url);
  };

  let flow: Flow | null = null;
  try {
    flow = raw ? (JSON.parse(Buffer.from(raw, "base64url").toString()) as Flow) : null;
  } catch {
    flow = null;
  }
  const sp = request.nextUrl.searchParams;
  if (!isProvider(provider) || !flow || flow.p !== provider || !sp.get("code") || sp.get("state") !== flow.s) {
    return fail("oauth_state", flow);
  }

  let session: { token: string };
  try {
    const identity = await fetchIdentity(provider, sp.get("code")!, flow.v, redirectUri(provider, request.nextUrl.origin));
    session = await api<{ token: string }>("/auth/oauth", {
      method: "POST",
      headers: await clientHeaders(),
      body: JSON.stringify({ provider, ...identity, inviteToken: flow.i || null }),
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404 || e.status === 409)) {
      // e.g. no team account for this email; the message is safe to show and has no secrets
      const url = new URL("/admin/login", request.nextUrl.origin);
      url.searchParams.set("error", String(e.body.detail ?? "That account can't sign in here."));
      return NextResponse.redirect(url);
    }
    console.error("OAuth sign-in failed", e);
    return fail("oauth_failed", flow);
  }
  await setSessionCookie(session.token);
  return NextResponse.redirect(new URL(safeNext(flow.n), request.nextUrl.origin));
}
