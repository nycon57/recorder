"use client";

import { useEffect, useState } from "react";

const TICKS = [
  { id: "hero", label: "§00 · HERO" },
  { id: "sound-familiar", label: "§01 · PAIN" },
  { id: "how-it-works", label: "§02 · HOW" },
  { id: "surfaces", label: "§03 · PLACES" },
  { id: "pipeline", label: "§04 · ENGINE" },
  { id: "metrics", label: "§05 · OUTCOMES" },
  { id: "case-study", label: "§06 · CASE" },
  { id: "what-about", label: "§07 · OBJECTIONS" },
  { id: "proof", label: "§08 · SECURITY" },
  { id: "closing", label: "§09 · DEMO" },
];

export function Rail() {
  const [active, setActive] = useState<string>("hero");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const onIntersect: IntersectionObserverCallback = (entries) => {
      // Pick the topmost intersecting entry
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActive(entry.target.id);
        }
      }
    };
    const io = new IntersectionObserver(onIntersect, {
      rootMargin: "-40% 0px -55% 0px",
      threshold: 0,
    });
    for (const tick of TICKS) {
      const el = document.getElementById(tick.id);
      if (el) io.observe(el);
    }
    observers.push(io);
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <nav
      className="trb-rail"
      aria-label="Section index"
    >
      {TICKS.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById(t.id)
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="trb-rail-tick"
          data-active={active === t.id}
          style={{ pointerEvents: "auto" }}
          aria-current={active === t.id ? "true" : undefined}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
