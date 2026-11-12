"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/admin/auth-actions";
import { Card, buttonClass, inputClass } from "@/components/admin/ui";

export default function DeleteAccount({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card title="Delete account">
      <p className="text-sm text-muted">Deletes your account, saved items and history. This can&apos;t be undone.</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`${buttonClass.danger} mt-3`}>
          Delete my account…
        </button>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await deleteAccount(hasPassword ? value : "", hasPassword ? "" : value);
              if (r && !r.ok) setError(r.error);
            });
          }}
        >
          <label className="block text-xs text-soft">
            {hasPassword ? "Your password" : `Type ${email} to confirm`}
            <input
              type={hasPassword ? "password" : "text"}
              autoComplete={hasPassword ? "current-password" : "off"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className={`${inputClass} mt-1`}
            />
          </label>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending || !value} className={buttonClass.danger}>
              {pending ? "Deleting…" : "Delete forever"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass.ghost}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
