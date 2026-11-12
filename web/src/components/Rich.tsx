import { Fragment, type ReactNode } from "react";

export type RichVars = Record<string, string | number | ReactNode>;

const TOKEN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`|\{[A-Za-z]+\})/g;

/** Hand-drawn underline used by ~word~ */
function Underlined({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block text-brand">
      {children}
      <svg viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full" aria-hidden="true">
        <path
          d="M3 14 C 50 4, 120 4, 197 10"
          fill="none"
          stroke="#f07a2a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="220"
          style={{ animation: "draw-line 1.2s 0.4s cubic-bezier(.2,.7,.2,1) both", ["--len" as string]: 220 }}
        />
      </svg>
    </span>
  );
}

/**
 * Renders admin-edited copy: *orange*, _dim_, ~underlined~, `code`, {placeholders}, and
 * line breaks. Plain text only; nothing is ever injected as HTML.
 */
export default function Rich({
  text,
  vars = {},
  accent = "text-brand",
  dim = "text-fg/55",
  code = "font-mono text-brand",
}: {
  text: string;
  vars?: RichVars;
  accent?: string;
  dim?: string;
  code?: string;
}) {
  // Simple values are substituted first so they can sit inside markup, e.g. "*{name}*"
  const filled = text.replace(/\{([A-Za-z]+)\}/g, (m, k: string) =>
    typeof vars[k] === "string" || typeof vars[k] === "number" ? String(vars[k]) : m,
  );

  const renderLine = (line: string, li: number) =>
    line.split(TOKEN).map((part, i) => {
      const key = `${li}-${i}`;
      if (!part) return null;
      const inner = part.slice(1, -1);
      if (part.length > 2 && part[0] === "*" && part.endsWith("*")) return <span key={key} className={accent}>{inner}</span>;
      if (part.length > 2 && part[0] === "_" && part.endsWith("_")) return <span key={key} className={dim}>{inner}</span>;
      if (part.length > 2 && part[0] === "~" && part.endsWith("~")) return <Underlined key={key}>{inner}</Underlined>;
      if (part.length > 2 && part[0] === "`" && part.endsWith("`")) return <code key={key} className={code}>{inner}</code>;
      if (part[0] === "{" && part.endsWith("}") && inner in vars) return <Fragment key={key}>{vars[inner]}</Fragment>;
      return <Fragment key={key}>{part}</Fragment>;
    });

  const lines = filled.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {renderLine(line, li)}
        </Fragment>
      ))}
    </>
  );
}

/** Same placeholders as <Rich>, for attributes and plain strings (titles, alt text). */
export function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{([A-Za-z]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
