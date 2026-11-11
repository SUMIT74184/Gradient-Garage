"use client";

import { useState } from "react";

export default function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-2 py-1.5 pl-4 pr-1.5 font-mono text-sm text-muted shadow-sm">
      <code className="min-w-0 flex-1 truncate">{command}</code>
      <span
        aria-hidden="true"
        className={`hidden shrink-0 text-xs font-medium text-brand transition-opacity duration-200 sm:inline-block ${copied ? "opacity-100" : "opacity-0"}`}
      >
        Copied
      </span>
      <button
        type="button"
        aria-label="Copy command"
        title="Copy"
        onClick={async () => {
          await navigator.clipboard.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 transition-colors hover:bg-surface hover:text-fg"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </button>
    </div>
  );
}
