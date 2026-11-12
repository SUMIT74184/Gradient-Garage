import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";

/**
 * Serves uploaded images from the API on this site's own origin (the particle canvas can
 * only read same-origin pixels). Reads API_URL at runtime, so it works in Docker too.
 */
export async function GET(_: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params;
  // Storage keys are "<hex>.<ext>"; refuse anything else
  if (!API_URL || path.length !== 1 || !/^[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(path[0])) {
    return new NextResponse("Not found", { status: 404 });
  }
  const upstream = await fetch(`${API_URL}/media/${path[0]}`, { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new NextResponse("Not found", { status: upstream?.status === 404 ? 404 : 502 });
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      // Keys are random and never reused, so the bytes never change
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
