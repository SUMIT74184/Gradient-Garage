"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/motion/useReducedMotion";

/** Cycles through words with a 3D flip, like the reference site's compare picker. */
export default function WordFlip({
  words,
  interval = 2200,
  className = "",
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || words.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [reduced, words.length, interval]);

  return (
    <span className="inline-block [perspective:600px]" aria-live="polite">
      <span
        key={i}
        className={`inline-block origin-bottom [animation:word-flip_700ms_cubic-bezier(0.2,0.7,0.2,1)_both] ${className}`}
      >
        {words[i]}
      </span>
    </span>
  );
}
