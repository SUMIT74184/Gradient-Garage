"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { GitHubIcon } from "@/components/Navbar";

type Mode = "login" | "signup";
type Provider = "google" | "github";

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Log in to save models, track evals and pull private weights.",
    submit: "Log in",
    switchText: "New here?",
    switchLabel: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account",
    subtitle: "Free forever. Bookmark models, compare benchmarks, publish fine-tunes.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLabel: "Log in",
    switchHref: "/login",
  },
} as const;

const PROVIDER_NAME: Record<Provider, string> = { google: "Google", github: "GitHub" };

const inputClass =
  "w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm text-fg placeholder:text-muted outline-none transition-colors focus:border-brand/60 focus:bg-surface-2";

/**
 * Login / sign-up card. UI only for now: OAuth and email submission show a notice
 * instead of calling a provider.
 */
export default function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onProvider = (p: Provider) =>
    setNotice(`${PROVIDER_NAME[p]} sign-in isn't connected yet. This page is a UI preview.`);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotice("Email sign-in isn't connected yet. This page is a UI preview.");
  };

  return (
    <div className="w-full max-w-[400px]">
      <h1 className="display text-3xl text-fg md:text-4xl">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.subtitle}</p>

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onProvider("google")}
          className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-fg px-5 py-3 text-sm font-medium tracking-tight text-ink transition-colors hover:bg-white"
        >
          <GoogleIcon className="size-[18px]" />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => onProvider("github")}
          className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface-2 px-5 py-3 text-sm font-medium tracking-tight text-fg transition-colors hover:bg-surface"
        >
          <GitHubIcon className="size-[18px]" />
          Continue with GitHub
        </button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <label className="flex flex-col gap-1.5 text-sm text-soft">
            Name
            <input name="name" type="text" autoComplete="name" required placeholder="Ada Lovelace" className={inputClass} />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm text-soft">
          Email
          <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-soft">
          <span className="flex items-center justify-between">
            Password
            {mode === "login" && (
              <button
                type="button"
                onClick={() => setNotice("Password reset isn't connected yet. This page is a UI preview.")}
                className="text-xs text-muted transition-colors hover:text-brand"
              >
                Forgot password?
              </button>
            )}
          </span>
          <span className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              className={`${inputClass} pe-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 end-3 my-auto h-fit text-xs text-muted transition-colors hover:text-fg"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>

        <button
          type="submit"
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 font-medium tracking-tight text-brand-fg transition-colors hover:bg-brand-hover"
        >
          {copy.submit}
        </button>
      </form>

      <p role="status" aria-live="polite" className={`mt-4 min-h-5 text-center text-xs text-gold-300 ${notice ? "" : "invisible"}`}>
        {notice}
      </p>

      <p className="mt-4 text-center text-sm text-muted">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="font-medium text-fg underline-offset-4 hover:text-brand hover:underline">
          {copy.switchLabel}
        </Link>
      </p>

      {mode === "signup" && (
        <p className="mt-6 text-center text-xs text-muted">
          By creating an account you agree to the Terms and Privacy Policy.
        </p>
      )}
    </div>
  );
}

export function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}
