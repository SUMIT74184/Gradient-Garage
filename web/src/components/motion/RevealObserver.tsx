"use client";

import { useEffect } from "react";

/**
 * Mount once per page. Any element with `data-reveal` fades up when it scrolls
 * into view. Set `style={{"--reveal-delay": "120ms"}}` to stagger.
 */
export default function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-shown", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
