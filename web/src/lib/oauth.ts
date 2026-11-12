/** GitHub and Google OAuth (authorization code + PKCE), run entirely on the website's server. */
import { createHash, randomBytes } from "node:crypto";

export type Provider = "github" | "google";
export type Identity = { providerUserId: string; email: string; emailVerified: boolean; name: string; avatarUrl: string | null };

export const OAUTH_COOKIE = "gg_oauth";

const CONFIG = {
  github: {
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    id: () => process.env.GITHUB_CLIENT_ID ?? "",
    secret: () => process.env.GITHUB_CLIENT_SECRET ?? "",
  },
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    id: () => process.env.GOOGLE_CLIENT_ID ?? "",
    secret: () => process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
} as const;

export function isProvider(p: string): p is Provider {
  return p === "github" || p === "google";
}

export function configured(p: Provider) {
  return !!(CONFIG[p].id() && CONFIG[p].secret());
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function newFlow() {
  const verifier = b64url(randomBytes(32));
  return { state: b64url(randomBytes(24)), verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export function redirectUri(p: Provider, origin: string) {
  const base = (process.env.APP_URL || origin).replace(/\/$/, "");
  return `${base}/auth/${p}/callback`;
}

export function authorizeUrl(p: Provider, { state, challenge, redirect }: { state: string; challenge: string; redirect: string }) {
  const c = CONFIG[p];
  const q = new URLSearchParams({
    client_id: c.id(),
    redirect_uri: redirect,
    scope: c.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (p === "github") q.set("allow_signup", "false");
  else {
    q.set("response_type", "code");
    q.set("prompt", "select_account");
  }
  return `${c.authorize}?${q}`;
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** Exchange the code and read a verified identity from the provider. */
export async function fetchIdentity(p: Provider, code: string, verifier: string, redirect: string): Promise<Identity> {
  const c = CONFIG[p];
  const body = new URLSearchParams({
    client_id: c.id(),
    client_secret: c.secret(),
    code,
    redirect_uri: redirect,
    code_verifier: verifier,
  });
  if (p === "google") body.set("grant_type", "authorization_code");
  const tok = await json<{ access_token?: string; error?: string }>(
    await fetch(c.token, { method: "POST", body, headers: { Accept: "application/json" }, cache: "no-store" }),
    "token exchange",
  );
  if (!tok.access_token) throw new Error(`token exchange failed: ${tok.error ?? "no token"}`);
  const auth = { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json", "User-Agent": "gradient-garage-admin" };

  if (p === "github") {
    const [user, emails] = await Promise.all([
      json<{ id: number; login: string; name: string | null; avatar_url: string | null }>(await fetch("https://api.github.com/user", { headers: auth, cache: "no-store" }), "GitHub user"),
      json<{ email: string; primary: boolean; verified: boolean }[]>(await fetch("https://api.github.com/user/emails", { headers: auth, cache: "no-store" }), "GitHub emails"),
    ]);
    const primary = emails.find((e) => e.primary) ?? emails.find((e) => e.verified);
    return {
      providerUserId: String(user.id),
      email: primary?.email ?? "",
      emailVerified: !!primary?.verified,
      name: user.name || user.login,
      avatarUrl: user.avatar_url,
    };
  }
  const info = await json<{ sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string }>(
    await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: auth, cache: "no-store" }),
    "Google userinfo",
  );
  return { providerUserId: info.sub, email: info.email ?? "", emailVerified: !!info.email_verified, name: info.name ?? "", avatarUrl: info.picture ?? null };
}
