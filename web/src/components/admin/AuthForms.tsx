"use client";

import { useActionState, useState } from "react";
import { acceptInvite, login, resetPassword, type FormState } from "@/app/admin/auth-actions";
import { GitHubIcon } from "@/components/Navbar";
import { buttonClass, inputClass } from "@/components/admin/ui";

function FieldError({ msg }: { msg?: string }) {
  return msg ? <span className="mt-1 block text-xs text-red-300">{msg}</span> : null;
}

function FormError({ state }: { state: FormState }) {
  return state?.error ? (
    <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
      {state.error}
    </p>
  ) : null;
}

function PasswordInput({ name, label, autoComplete, error, minLength }: { name: string; label: string; autoComplete: string; error?: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-sm text-soft">
      {label}
      <span className="relative mt-1.5 block">
        <input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} aria-invalid={!!error} className={`${inputClass} pe-14`} />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 end-2 my-auto h-fit text-xs text-muted hover:text-fg">
          {show ? "Hide" : "Show"}
        </button>
      </span>
      <FieldError msg={error} />
    </label>
  );
}

export function ProviderButtons({ github, google, query }: { github: boolean; google: boolean; query: string }) {
  if (!github && !google) return null;
  return (
    <div className="space-y-2">
      {github && (
        <a href={`/auth/github${query}`} className={`${buttonClass.secondary} w-full`}>
          <GitHubIcon className="size-4" /> Continue with GitHub
        </a>
      )}
      {google && (
        <a href={`/auth/google${query}`} className={`${buttonClass.secondary} w-full`}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z" />
            <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
          </svg>
          Continue with Google
        </a>
      )}
      <div className="flex items-center gap-3 py-2 text-[11px] uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, action, pending] = useActionState(login, initialError ? { error: initialError } : null);
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block text-sm text-soft">
        Email
        <input name="email" type="email" autoComplete="email" required autoFocus className={`${inputClass} mt-1.5`} />
      </label>
      <PasswordInput name="password" label="Password" autoComplete="current-password" />
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full !py-2.5`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-muted">Forgot your password? Ask an Owner for a reset link.</p>
    </form>
  );
}

export function SetPasswordForm({ token, mode, minLength = 10 }: { token: string; mode: "invite" | "reset"; minLength?: number }) {
  const bound = mode === "invite" ? acceptInvite.bind(null, token) : resetPassword.bind(null, token);
  const [state, action, pending] = useActionState(bound, null);
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      {mode === "invite" && (
        <label className="block text-sm text-soft">
          Your name
          <input name="name" autoComplete="name" required className={`${inputClass} mt-1.5`} />
        </label>
      )}
      <PasswordInput name="password" label={mode === "invite" ? "Choose a password" : "New password"} autoComplete="new-password" minLength={minLength} error={state?.fields?.password} />
      <PasswordInput name="confirm" label="Repeat it" autoComplete="new-password" minLength={minLength} error={state?.fields?.confirm} />
      <p className="text-xs text-muted">At least {minLength} characters. A short sentence works well.</p>
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full !py-2.5`}>
        {pending ? "Saving…" : mode === "invite" ? "Join the team" : "Set password and sign in"}
      </button>
    </form>
  );
}
