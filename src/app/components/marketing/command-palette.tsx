"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Entry = {
  id: string;
  kind: "JUMP" | "PAGE" | "PRODUCT" | "LEGAL" | "APP";
  label: string;
  hint: string;
  href: string;
};

/**
 * Entries mix homepage-anchor jumps with cross-page navigation.
 * JUMP entries point at #ids on `/`; when the user is on a sub-page,
 * commit() rewrites them to `/#id` so the browser routes home + scrolls.
 */
const ENTRIES: Entry[] = [
  { id: "hero", kind: "JUMP", label: "Hero", hint: "§00", href: "#hero" },
  {
    id: "sound-familiar",
    kind: "JUMP",
    label: "Sound familiar?",
    hint: "§01 · the two pains",
    href: "#sound-familiar",
  },
  {
    id: "how-it-works",
    kind: "JUMP",
    label: "How it works",
    hint: "§02 · three steps",
    href: "#how-it-works",
  },
  {
    id: "surfaces",
    kind: "JUMP",
    label: "Four places your team uses it",
    hint: "§03 · §A—D",
    href: "#surfaces",
  },
  {
    id: "recorder",
    kind: "JUMP",
    label: "Record",
    hint: "§A · the recorder",
    href: "#surface-recorder",
  },
  {
    id: "graph",
    kind: "JUMP",
    label: "Organize",
    hint: "§B · the knowledge base",
    href: "#surface-knowledge-base",
  },
  {
    id: "extension",
    kind: "JUMP",
    label: "Teach",
    hint: "§C · the tutor",
    href: "#surface-tutor",
  },
  {
    id: "console",
    kind: "JUMP",
    label: "Answer",
    hint: "§D · search + chat",
    href: "#surface-search",
  },
  {
    id: "pipeline",
    kind: "JUMP",
    label: "The engine",
    hint: "§04 · capture → retrieve",
    href: "#pipeline",
  },
  {
    id: "metrics",
    kind: "JUMP",
    label: "Outcomes",
    hint: "§05 · instrument panel",
    href: "#metrics",
  },
  {
    id: "case",
    kind: "JUMP",
    label: "Case study",
    hint: "§06 · Borderos · 480 agents",
    href: "#case-study",
  },
  {
    id: "what-about",
    kind: "JUMP",
    label: "What about...?",
    hint: "§07 · adoption + security",
    href: "#what-about",
  },
  {
    id: "proof",
    kind: "JUMP",
    label: "Security brief",
    hint: "§08 · SOC 2 · HIPAA · SSO",
    href: "#proof",
  },
  { id: "features", kind: "PAGE", label: "Features", hint: "§A–F · deep dive", href: "/features" },
  { id: "pricing-page", kind: "PAGE", label: "Pricing", hint: "4 plans · self-serve", href: "/pricing" },
  { id: "about", kind: "PAGE", label: "About", hint: "story · team", href: "/about" },
  { id: "contact", kind: "PAGE", label: "Contact", hint: "talk · demo", href: "/contact" },
  {
    id: "demo",
    kind: "PRODUCT",
    label: "Book a demo",
    hint: "30 min · your actual data",
    href: "/contact?type=demo",
  },
  { id: "signin", kind: "APP", label: "Sign in", hint: "existing customer", href: "/sign-in" },
  { id: "signup", kind: "APP", label: "Create an account", hint: "free 14-day trial", href: "/sign-up" },
  { id: "privacy", kind: "LEGAL", label: "Privacy policy", hint: "updated 2026-Q1", href: "/privacy" },
  { id: "terms", kind: "LEGAL", label: "Terms of service", hint: "v2.4", href: "/terms" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES;
    return ENTRIES.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.hint.toLowerCase().includes(q) ||
        e.kind.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const entry = filtered[active];
        if (entry) commit(entry);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered, active]);

  function commit(entry: Entry) {
    onOpenChange(false);

    // Hash jump: same-page smooth scroll; cross-page routes home + anchors.
    if (entry.href.startsWith("#")) {
      if (pathname === "/") {
        requestAnimationFrame(() => {
          document
            .querySelector(entry.href)
            ?.scrollIntoView({ behavior: "smooth" });
        });
      } else {
        router.push(`/${entry.href}`);
      }
      return;
    }

    // Route push for in-app pages; full load for everything else
    // (sign-in/sign-up may live outside the marketing router tree).
    if (
      entry.href.startsWith("/") &&
      !entry.href.startsWith("/sign-in") &&
      !entry.href.startsWith("/sign-up")
    ) {
      router.push(entry.href);
    } else {
      window.location.assign(entry.href);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{
        padding: "12vh 1rem 1rem",
        backgroundColor: "oklch(0.11 0.008 60 / 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 640,
          background: "var(--trb-surface-3)",
          border: "1px solid var(--trb-line-strong)",
          borderRadius: 4,
          boxShadow: "0 40px 80px -20px oklch(0 0 0 / 0.6)",
        }}
      >
        {/* Header row: mono specimen label + shortcut */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "0.625rem 0.875rem 0.625rem 1rem",
            borderBottom: "1px solid var(--trb-line)",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            TRIBORA · COMMAND PALETTE
          </span>
          <div className="flex items-center gap-2">
            <span className="trb-kbd">esc</span>
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)" }}
            >
              close
            </span>
          </div>
        </div>

        {/* Input */}
        <div
          className="flex items-center gap-3"
          style={{
            padding: "0.875rem 1rem",
            borderBottom: "1px solid var(--trb-line)",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-signal)" }}
          >
            ›
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Jump to a section, a page, or an action…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            aria-label="Search commands"
            style={{
              flex: 1,
              background: "transparent",
              border: 0,
              outline: "none",
              color: "var(--trb-ink)",
              fontFamily: "var(--trb-font-body)",
              fontSize: "0.9375rem",
              letterSpacing: "0.005em",
            }}
          />
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
            {filtered.length} RESULT{filtered.length === 1 ? "" : "S"}
          </span>
        </div>

        {/* Results */}
        <ul
          role="listbox"
          style={{
            maxHeight: 320,
            overflowY: "auto",
            padding: "0.375rem 0",
          }}
        >
          {filtered.length === 0 ? (
            <li
              style={{
                padding: "1rem 1rem",
                color: "var(--trb-ink-dim)",
                fontFamily: "var(--trb-font-mono)",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              NO MATCH · try a different word
            </li>
          ) : (
            filtered.map((entry, i) => (
              <li
                key={entry.id}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => commit(entry)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "78px 1fr auto",
                  alignItems: "baseline",
                  gap: "0.75rem",
                  padding: "0.5625rem 1rem",
                  cursor: "pointer",
                  background:
                    i === active ? "oklch(0.78 0.155 72 / 0.1)" : "transparent",
                  position: "relative",
                }}
              >
                {i === active && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 3,
                      height: 14,
                      background: "var(--trb-signal)",
                    }}
                  />
                )}
                <span
                  className="trb-mono-sm"
                  style={{
                    color:
                      i === active
                        ? "var(--trb-signal)"
                        : "var(--trb-ink-faint)",
                  }}
                >
                  {entry.kind}
                </span>
                <span
                  style={{
                    fontFamily: "var(--trb-font-display)",
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: "var(--trb-ink)",
                  }}
                >
                  {entry.label}
                </span>
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-ink-dim)" }}
                >
                  {entry.hint}
                </span>
              </li>
            ))
          )}
        </ul>

        {/* Footer row */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "0.625rem 0.875rem",
            borderTop: "1px solid var(--trb-line)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="trb-kbd">↑↓</span>
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)" }}
            >
              navigate
            </span>
            <span className="trb-kbd">↵</span>
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)" }}
            >
              commit
            </span>
          </div>
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            NAV-ONLY · in-product palette has 142 entries
          </span>
        </div>
      </div>
    </div>
  );
}
