"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/admin/ui";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-xl border border-red-400/25 bg-red-400/5 p-6">
      <h1 className="text-lg font-semibold text-fg">Couldn&apos;t load this page</h1>
      <p className="mt-2 text-sm text-soft">{message}</p>
      <p className="mt-3 text-xs text-muted">
        Check the API is running (<code className="font-mono">uvicorn app.main:app</code> in <code className="font-mono">api/</code>),
        Postgres is up (<code className="font-mono">docker compose up -d db</code>) and <code className="font-mono">API_URL</code> is
        set in <code className="font-mono">web/.env.local</code>.
      </p>
      <button type="button" onClick={retry} className={`${buttonClass.secondary} mt-5`}>
        Try again
      </button>
    </div>
  );
}
