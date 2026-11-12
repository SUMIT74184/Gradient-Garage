import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { sectionBySlug } from "@/lib/admin/schema";

/**
 * CSV download for one section, as the signed-in user. Proxied so the session token
 * stays in the httpOnly cookie; the API checks the role (Viewer and up).
 */
export async function GET(req: Request, ctx: RouteContext<"/admin/export/[section]">) {
  const { section: slug } = await ctx.params;
  const section = sectionBySlug(slug);
  if (!section) return NextResponse.json({ detail: "unknown section" }, { status: 404 });
  const token = await getToken();
  if (!token) return NextResponse.redirect(new URL(`/login?next=/admin/${slug}`, req.url));
  if (!API_URL) return NextResponse.json({ detail: "API_URL is not set" }, { status: 503 });

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (process.env.INTERNAL_API_SECRET) headers["X-Internal-Secret"] = process.env.INTERNAL_API_SECRET;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/admin/export.csv?type=${section.type}`, { headers, cache: "no-store" });
  } catch {
    return NextResponse.json({ detail: "Can't reach the API" }, { status: 503 });
  }
  if (res.status === 401) return NextResponse.redirect(new URL(`/login?next=/admin/${slug}`, req.url));
  if (!res.ok) return NextResponse.json({ detail: `Export failed (${res.status})` }, { status: res.status });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${section.slug}-${day}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
