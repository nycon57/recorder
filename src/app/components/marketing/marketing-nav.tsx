"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "./command-palette";

const LINKS = [
  { label: "Features", href: "/features", meta: "§A–D" },
  { label: "Pricing", href: "/pricing", meta: "4 plans" },
  { label: "About", href: "/about", meta: "story" },
  { label: "Contact", href: "/contact", meta: "talk" },
];

/**
 * Marketing-route nav — page-route variant of the homepage specimen nav.
 * Sticky, underscores active pathname, same amber CTA.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-40 border-b"
      style={{
        borderColor: scrolled ? "var(--trb-line)" : "transparent",
        backgroundColor: scrolled
          ? "oklch(0.135 0.008 60 / 0.86)"
          : "transparent",
        backdropFilter: scrolled ? "blur(12px) saturate(110%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px) saturate(110%)" : "none",
        transition:
          "background-color var(--trb-dur-med) var(--trb-ease), border-color var(--trb-dur-med) var(--trb-ease)",
      }}
    >
      <div className="trb-section">
        <div
          className="trb-inner flex items-center justify-between"
          style={{ height: 62 }}
        >
          <Link
            href="/"
            className="flex items-center gap-3 group"
            aria-label="Tribora home"
          >
            <TriboraMark />
            <span
              className="trb-mono-sm"
              style={{
                color: "var(--trb-ink-faint)",
                letterSpacing: "0.14em",
              }}
            >
              v2.4.1
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {LINKS.map((link) => (
              <NavLink
                key={link.href}
                {...link}
                active={pathname === link.href}
              />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="hidden sm:inline-flex items-center gap-2.5 group"
              style={{
                fontFamily: "var(--trb-font-mono)",
                fontSize: 12,
                letterSpacing: "0.06em",
                padding: "0.4375rem 0.6875rem 0.4375rem 0.625rem",
                color: "var(--trb-ink-muted)",
                background: "var(--trb-surface-1)",
                border: "1px solid var(--trb-line)",
                borderRadius: 3,
                cursor: "pointer",
                transition:
                  "border-color var(--trb-dur-fast) var(--trb-ease), color var(--trb-dur-fast) var(--trb-ease)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--trb-ink-faint)";
                e.currentTarget.style.color = "var(--trb-ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--trb-line)";
                e.currentTarget.style.color = "var(--trb-ink-muted)";
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 11 11"
                fill="none"
                aria-hidden
                style={{ opacity: 0.75 }}
              >
                <circle
                  cx="4.6"
                  cy="4.6"
                  r="3.4"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M7.3 7.3L10 10"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="square"
                />
              </svg>
              <span>Jump to</span>
              <span
                className="trb-kbd"
                style={{
                  padding: "0.0625rem 0.3125rem 0.125rem",
                  fontSize: 10,
                  background: "transparent",
                }}
              >
                ⌘K
              </span>
            </button>

            <Link
              href="/sign-in"
              className="trb-link hidden sm:inline-flex"
              style={{
                fontSize: 13,
                color: "var(--trb-ink-muted)",
              }}
            >
              Sign in
            </Link>
            <Link
              href="/contact?type=demo"
              className="trb-cta"
              style={{
                padding: "0.5rem 0.9375rem 0.5625rem",
                fontSize: "0.875rem",
              }}
            >
              Book a demo
              <span className="trb-cta-glyph">→</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
    <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

function NavLink({
  label,
  href,
  meta,
  active,
}: {
  label: string;
  href: string;
  meta: string;
  active: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const reveal = hovered || active;
  return (
    <Link
      href={href}
      className="relative flex items-baseline gap-2 trb-link"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ color: active ? "var(--trb-signal)" : "var(--trb-ink)" }}
    >
      <span>{label}</span>
      <span
        className="trb-mono-sm"
        style={{
          color: active ? "var(--trb-signal)" : "var(--trb-ink-faint)",
          opacity: reveal ? 1 : 0,
          transform: reveal ? "translateX(0)" : "translateX(-4px)",
          transition:
            "opacity var(--trb-dur-med) var(--trb-ease), transform var(--trb-dur-med) var(--trb-ease)",
          pointerEvents: "none",
        }}
      >
        · {meta}
      </span>
    </Link>
  );
}

function TriboraMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "flex-end",
          gap: 3,
          height: 18,
        }}
      >
        <span
          style={{
            width: 2,
            height: 6,
            background: "var(--trb-ink-muted)",
            display: "block",
          }}
        />
        <span
          style={{
            width: 2,
            height: 14,
            background: "var(--trb-signal)",
            display: "block",
          }}
        />
        <span
          style={{
            width: 2,
            height: 10,
            background: "var(--trb-ink-muted)",
            display: "block",
          }}
        />
      </span>
      <span
        style={{
          fontFamily: "var(--trb-font-display)",
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--trb-ink)",
        }}
      >
        Tribora
      </span>
    </span>
  );
}
