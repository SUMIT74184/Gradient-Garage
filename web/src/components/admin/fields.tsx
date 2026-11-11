"use client";

import { useId, useState, type ReactNode } from "react";
import { buttonClass, inputClass } from "@/components/admin/ui";
import type { BenchmarkRow } from "@/lib/admin/types";

export function Field({
  label,
  help,
  error,
  htmlFor,
  wide,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  htmlFor?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1 text-xs text-muted">{help}</p>
      ) : null}
    </div>
  );
}

/** Free-text chips: Enter or comma adds, Backspace on empty removes the last, paste splits on commas. */
export function ChipsInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions,
  invalid,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const lower = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const p of parts) {
      if (!lower.has(p.toLowerCase())) {
        next.push(p);
        lower.add(p.toLowerCase());
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div
      className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border bg-ink/60 px-2 py-1.5 transition focus-within:border-brand/60 ${
        invalid ? "border-red-400/60" : "border-line"
      }`}
    >
      {value.map((v, i) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-fg/10 py-0.5 pl-2 pr-1 text-xs text-fg">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label={`Remove ${v}`}
            className="rounded px-1 text-muted hover:bg-fg/10 hover:text-fg"
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        list={suggestions ? listId : undefined}
        onChange={(e) => {
          // Picking a datalist suggestion fires a change with the full value
          if (suggestions?.includes(e.target.value)) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text.includes(",")) {
            e.preventDefault();
            add(text);
          }
        }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-sm text-fg outline-none placeholder:text-muted/70"
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      )}
    </div>
  );
}

export function BenchmarksEditor({
  value,
  onChange,
  error,
}: {
  value: BenchmarkRow[];
  onChange: (v: BenchmarkRow[]) => void;
  error?: string;
}) {
  const set = (i: number, patch: Partial<BenchmarkRow>) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="hidden grid-cols-[1fr_6rem_5rem_auto_auto] gap-2 px-1 text-[11px] uppercase tracking-wider text-muted sm:grid">
          <span>Benchmark</span>
          <span>Score</span>
          <span>Unit</span>
          <span>Lower wins</span>
          <span />
        </div>
      )}
      {value.map((b, i) => (
        <div key={i} className="grid grid-cols-2 items-center gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_6rem_5rem_auto_auto] sm:border-0 sm:p-0">
          <input
            aria-label="Benchmark name"
            value={b.name}
            onChange={(e) => set(i, { name: e.target.value })}
            placeholder="MMLU"
            className={`${inputClass} col-span-2 sm:col-span-1`}
          />
          <input
            aria-label="Score"
            type="number"
            step="any"
            value={Number.isFinite(b.score) ? b.score : ""}
            onChange={(e) => set(i, { score: e.target.value === "" ? NaN : Number(e.target.value) })}
            className={inputClass}
          />
          <input aria-label="Unit" value={b.unit ?? ""} onChange={(e) => set(i, { unit: e.target.value || null })} placeholder="%" className={inputClass} />
          <label className="flex items-center gap-1.5 text-xs text-soft sm:justify-center">
            <input
              type="checkbox"
              checked={!!b.lowerIsBetter}
              onChange={(e) => set(i, { lowerIsBetter: e.target.checked })}
              className="size-4 accent-[var(--color-brand)]"
            />
            <span className="sm:sr-only">Lower is better (WER, perplexity)</span>
          </label>
          <div className="flex justify-end gap-0.5">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className={buttonClass.ghost}>
              ↑
            </button>
            <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className={buttonClass.ghost}>
              ↓
            </button>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove benchmark" className={`${buttonClass.ghost} hover:!text-red-300`}>
              ×
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button type="button" onClick={() => onChange([...value, { name: "", score: NaN, unit: "%", lowerIsBetter: false }])} className={buttonClass.secondary}>
        + Add benchmark
      </button>
    </div>
  );
}
