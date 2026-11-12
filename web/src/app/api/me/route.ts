import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";
import { adminApi, getToken } from "@/lib/auth";

/**
 * Who's signed in, plus their saved items. Read by the site header after the page loads, so
 * the home page itself stays prerendered.
 */
export async function GET() {
  const empty = NextResponse.json({ user: null, bookmarks: [] }, { headers: { "Cache-Control": "private, no-store" } });
  if (!(await getToken())) return empty;
  try {
    const state = await adminApi<{ user: unknown; bookmarks: unknown[] }>("/auth/me/state");
    return NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return empty;
    return NextResponse.json({ user: null, bookmarks: [], error: "unavailable" }, { status: 503 });
  }
}
