"use client";

import Link from "next/link";
import { OPEN_SEARCH_EVENT } from "@/components/CommandPalette";
import { SECTIONS, href } from "@/config/sections";
import { site } from "@/config/site";

const LINKS = [
  { href: href("model"), label: SECTIONS.model.label },
  { href: href("demo"), label: SECTIONS.demo.label },
  { href: "#fine-tuned", label: "Fine-tunes", wide: true },
  { href: "#leaderboard", label: "Leaderboard", wide: true },
  { href: href("dataset"), label: SECTIONS.dataset.label },
  { href: href("library"), label: SECTIONS.library.label },
];

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="display inline-flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-hover to-brand font-semibold text-brand-fg"
      style={{ width: size, height: size, fontSize: size * 0.5, lineHeight: 1 }}
    >
      {site.mark}
    </span>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 h-14">
      <div className="border-b border-line bg-ink/70 backdrop-blur-lg">
        <nav className="mx-auto flex h-14 w-full max-w-[1400px] items-center px-4">
          <a href="#" className="inline-flex items-center gap-2.5">
            <Logo />
            <span className="display text-lg text-fg">
              {site.name}
              <span className="hidden font-normal text-muted 2xl:inline"></span>
            </span>
          </a>
          <ul className="flex items-center gap-1 px-6 text-sm text-muted max-lg:hidden">
            {LINKS.map((l) => (
              <li key={l.href} className={l.wide ? "max-xl:hidden" : undefined}>
                <a href={l.href} className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-surface-2 hover:text-fg">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="ms-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
              className="inline-flex w-[200px] items-center gap-2 rounded-full border border-line bg-surface-2/50 p-1.5 ps-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg max-md:w-auto"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span className="max-md:sr-only">Search</span>
              <span className="ms-auto inline-flex gap-0.5 max-md:hidden">
                <kbd className="rounded-md border border-line bg-ink px-1.5">⌘</kbd>
                <kbd className="rounded-md border border-line bg-ink px-1.5">K</kbd>
              </span>
            </button>
            <a
              href={site.githubUrl}
              target="_blank"
              rel="noopener"
              aria-label="GitHub"
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <GitHubIcon className="size-5" />
            </a>
            <Link
              href="/login"
              className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg max-sm:hidden"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover"
            >
              Sign up
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

export function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
