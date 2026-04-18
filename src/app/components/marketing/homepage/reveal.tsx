"use client";

import { useEffect } from "react";

/**
 * Global `data-reveal` IntersectionObserver. Adds `.is-in` when the element
 * enters the viewport so CSS can transition it in. Disconnects per-element
 * as soon as it's revealed — no work once the page is fully read.
 *
 * `prefers-reduced-motion` short-circuits: everything reveals immediately.
 */
export function Reveal() {
  useEffect(() => {
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nodes = document.querySelectorAll<HTMLElement>(
      "[data-reveal]:not(.is-in)",
    );

    if (reduce) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    nodes.forEach((n) => io.observe(n));

    return () => io.disconnect();
  }, []);

  return null;
}
