"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion/useReducedMotion";

type Line = { kind: "cmd" | "out" | "accent" | "stream"; text: string };

function script(modelId: string): Line[] {
  return [
    { kind: "cmd", text: "pip install -U transformers accelerate" },
    { kind: "out", text: "Successfully installed transformers accelerate" },
    { kind: "cmd", text: "python" },
    { kind: "cmd", text: ">>> from transformers import pipeline" },
    { kind: "cmd", text: `>>> pipe = pipeline("text-generation", model="${modelId}")` },
    { kind: "out", text: "Downloading model.safetensors ━━━━━━━━━━━━━━━━━━━━ 100% 2.2 GB" },
    { kind: "accent", text: "✓ Loaded in 3.1s on cuda:0" },
    { kind: "cmd", text: '>>> pipe("Explain attention in one sentence:")' },
    {
      kind: "stream",
      text: "Attention lets every token weigh every other token, so the model can focus on what matters for the next prediction.",
    },
  ];
}

/** Types out a short install-and-run session, then loops. */
export default function TerminalDemo({ modelId }: { modelId: string }) {
  const lines = useMemo(() => script(modelId), [modelId]);
  const reduced = useReducedMotion();
  const [pos, setPos] = useState({ line: 0, char: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    const cur = lines[pos.line];
    let delay: number;
    let next: typeof pos;
    if (!cur) {
      delay = 3200;
      next = { line: 0, char: 0 };
    } else if (cur.kind === "out" || cur.kind === "accent") {
      delay = 420;
      next = { line: pos.line + 1, char: 0 };
    } else if (pos.char < cur.text.length) {
      delay = cur.kind === "stream" ? 18 : 28 + ((pos.char * 7) % 30);
      next = { line: pos.line, char: pos.char + (cur.kind === "stream" ? 2 : 1) };
    } else {
      delay = 380;
      next = { line: pos.line + 1, char: 0 };
    }
    const id = setTimeout(() => setPos(next), delay);
    return () => clearTimeout(id);
  }, [pos, lines, reduced, visible]);

  const shown = reduced ? lines.map((l) => ({ ...l, partial: l.text })) : lines.slice(0, pos.line + 1).map((l, i) => ({
    ...l,
    partial:
      i < pos.line ? l.text : l.kind === "out" || l.kind === "accent" ? "" : l.text.slice(0, pos.char),
  }));

  return (
    <div ref={ref} className="relative rounded-xl border border-line bg-surface-2 shadow-md">
      <div className="flex items-center gap-2 border-b border-line p-2 text-muted">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m4 17 6-6-6-6M12 19h8" />
        </svg>
        <span className="text-xs font-medium">Terminal</span>
        <span className="me-2 ms-auto size-2 rounded-full bg-red-400" />
      </div>
      <pre className="min-h-[260px] whitespace-pre-wrap break-all p-3 font-mono text-[13px] leading-relaxed text-soft/80">
        <code className="grid">
          {shown.map((l, i) =>
            l.kind === "out" || l.kind === "accent" ? (
              l.partial || reduced || i < pos.line ? (
                <span key={i} className={l.kind === "accent" ? "text-olive" : "text-muted"}>
                  {l.text}
                </span>
              ) : null
            ) : (
              <span key={i} className={l.kind === "stream" ? "text-gold-300" : ""}>
                {l.kind === "cmd" && !l.text.startsWith(">>>") && <span className="text-brand">$ </span>}
                {l.partial}
              </span>
            ),
          )}
          <span>
            <span className="inline-block h-3 w-1.5 animate-cursor bg-fg align-middle" />
          </span>
        </code>
      </pre>
    </div>
  );
}
