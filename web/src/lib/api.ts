/**
 * Base URL of the FastAPI backend (server-side only), e.g. http://127.0.0.1:8000.
 * When unset the site falls back to the static files in src/data.
 */
export const API_URL = process.env.API_URL?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { detail?: unknown; [key: string]: unknown },
  ) {
    super(typeof body.detail === "string" ? body.detail : `API error ${status}`);
  }
}

/** JSON request to the backend. Throws ApiError on non-2xx; returns null for 204. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError(503, { detail: "API_URL is not set" });
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, { detail: `Can't reach the API at ${API_URL}. Is it running?` });
  }
  if (res.status === 204) return null as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
