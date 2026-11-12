"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { confirmEmail, login, requestPasswordReset, resetPassword, signup, type FormState } from "@/app/admin/auth-actions";
import { GitHubIcon } from "@/components/Navbar";

const inputClass =
  "w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm text-fg placeholder:text-muted outline-none transition-colors focus:border-brand/60 focus:bg-surface-2 aria-[invalid=true]:border-red-400/60";
const primary =
  "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 font-medium tracking-tight text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-60";

function Notice({ state, initial }: { state: FormState; initial?: string }) {
  const msg = state?.error ?? initial;
  return msg ? (
    <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-200">
      {msg}
    </p>
  ) : null;
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <span className="mt-1 block text-xs text-red-300">{msg}</span> : null;
}

function Password({ name, label, autoComplete, error, minLength, extra }: { name: string; label: string; autoComplete: string; error?: string; minLength?: number; extra?: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <label className="flex flex-col gap-1.5 text-sm text-soft">
      <span className="flex items-center justify-between">
        {label}
        {extra}
      </span>
      <span className="relative">
        <input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} aria-invalid={!!error} className={`${inputClass} pe-16`} />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 end-3 my-auto h-fit text-xs text-muted transition-colors hover:text-fg">
          {show ? "Hide" : "Show"}
        </button>
      </span>
      <FieldError msg={error} />
    </label>
  );
}

/** GitHub / Google buttons, only for providers that are configured. */
export function Providers({ github, google, next }: { github: boolean; google: boolean; next?: string }) {
  if (!github && !google) return null;
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <>
      <div className="mt-8 flex flex-col gap-3">
        {google && (
          <a href={`/auth/google${q}`} className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-fg px-5 py-3 text-sm font-medium tracking-tight text-ink transition-colors hover:bg-white">
            <GoogleIcon className="size-[18px]" />
            Continue with Google
          </a>
        )}
        {github && (
          <a href={`/auth/github${q}`} className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface-2 px-5 py-3 text-sm font-medium tracking-tight text-fg transition-colors hover:bg-surface">
            <GitHubIcon className="size-[18px]" />
            Continue with GitHub
          </a>
        )}
      </div>
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <>
      <h1 className="display text-3xl text-fg md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
    </>
  );
}

type ProviderFlags = { github: boolean; google: boolean };

export function LoginCard({ next, error, providers }: { next?: string; error?: string; providers: ProviderFlags }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <>
      <Heading title="Welcome back" subtitle="Log in to your saved models and recently viewed." />
      <Providers {...providers} next={next} />
      <form action={action} className={`flex flex-col gap-4 ${providers.github || providers.google ? "" : "mt-8"}`}>
        <Notice state={state} initial={state ? undefined : error} />
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="flex flex-col gap-1.5 text-sm text-soft">
          Email
          <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" className={inputClass} />
        </label>
        <Password
          name="password"
          label="Password"
          autoComplete="current-password"
          extra={
            <Link href="/forgot-password" className="text-xs text-muted transition-colors hover:text-brand">
              Forgot password?
            </Link>
          }
        />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-fg underline-offset-4 hover:text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export function SignupCard({ next, providers }: { next?: string; providers: ProviderFlags }) {
  const [state, action, pending] = useActionState(signup, null);
  const f = state?.fields ?? {};
  return (
    <>
      <Heading title="Create your account" subtitle="Free. Save models and datasets, and pick up where you left off." />
      <Providers {...providers} next={next} />
      <form action={action} className={`flex flex-col gap-4 ${providers.github || providers.google ? "" : "mt-8"}`}>
        <Notice state={state} />
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="flex flex-col gap-1.5 text-sm text-soft">
          Name
          <input name="name" type="text" autoComplete="name" required placeholder="Ada Lovelace" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-soft">
          Email
          <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" aria-invalid={!!f.email} className={inputClass} />
          <FieldError msg={f.email} />
        </label>
        <Password name="password" label="Password" autoComplete="new-password" minLength={10} error={f.password} />
        <p className="-mt-2 text-xs text-muted">At least 10 characters. We&apos;ll email you a link to confirm your address.</p>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-fg underline-offset-4 hover:text-brand hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}

export function ForgotCard() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state?.done) {
    return (
      <>
        <Heading title="Check your email" subtitle="If that address has an account, a reset link is on its way. It works for 24 hours." />
        <p className="mt-6 text-sm text-muted">
          Nothing arrived? Check spam, or{" "}
          <Link href="/forgot-password" className="text-fg hover:text-brand">
            try again
          </Link>
          . Signed up with GitHub or Google? Use that button on the{" "}
          <Link href="/login" className="text-fg hover:text-brand">
            log in page
          </Link>
          .
        </p>
      </>
    );
  }
  return (
    <>
      <Heading title="Reset your password" subtitle="Enter your email and we'll send you a link." />
      <form action={action} className="mt-8 flex flex-col gap-4">
        <Notice state={state} />
        <label className="flex flex-col gap-1.5 text-sm text-soft">
          Email
          <input name="email" type="email" autoComplete="email" required autoFocus className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="hover:text-fg">
          ← Back to log in
        </Link>
      </p>
    </>
  );
}

export function ResetCard({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(resetPassword.bind(null, token), null);
  const f = state?.fields ?? {};
  return (
    <>
      <Heading title="Choose a new password" subtitle={<>for <span className="text-fg">{email}</span>. You&apos;ll be signed out everywhere else.</>} />
      <form action={action} className="mt-8 flex flex-col gap-4">
        <Notice state={state} />
        <Password name="password" label="New password" autoComplete="new-password" minLength={10} error={f.password} />
        <Password name="confirm" label="Repeat it" autoComplete="new-password" minLength={10} error={f.confirm} />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Saving…" : "Save and log in"}
        </button>
      </form>
    </>
  );
}

export function VerifyCard({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmEmail.bind(null, token), null);
  if (state?.done) {
    return (
      <>
        <Heading title="Email confirmed" subtitle="Thanks! Your address is confirmed." />
        <Link href="/account" className={`${primary} mt-8`}>
          Go to your account
        </Link>
      </>
    );
  }
  return (
    <>
      <Heading title="Confirm your email" subtitle="One click and you're done." />
      <form action={action} className="mt-8 flex flex-col gap-4">
        <Notice state={state} />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Confirming…" : "Confirm my email"}
        </button>
      </form>
    </>
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
