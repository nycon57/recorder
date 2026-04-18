import "@/app/components/marketing/tribora.css";
import { Reveal } from "@/app/components/marketing/homepage/reveal";

export const dynamic = "force-dynamic";

/**
 * Auth routes layout — specimen-sheet frame.
 *
 * The auth surface is a quiet instrument panel: warm off-dark ground,
 * a masked dotted grid, a single hairline-bracketed column, and corner
 * markers that match the marketing catalog. No orbs, no gradient text,
 * no aurora glow — the signal color (Warm Amber) is reserved for the
 * primary action and focus rings only.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="tribora relative min-h-dvh overflow-hidden"
      style={{ backgroundColor: "var(--trb-surface-0)" }}
    >
      {/* Dotted specimen grid — masked radially so it fades at the edges */}
      <div
        aria-hidden
        className="trb-grid-overlay"
        style={{ position: "fixed", inset: 0, zIndex: 0 }}
      />

      {/* Single surgical amber radial — the "signal reception" cue.
          Scarce by design; sits behind the form at roughly 20% intensity. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 45% at 50% 42%, oklch(0.78 0.155 72 / 0.08), transparent 65%)",
        }}
      />

      {/* Top corner markers — catalog identity, matches hero chrome */}
      <FrameTopBar />

      {/* Bottom corner markers — specimen revision line */}
      <FrameBottomBar />

      {/* Content */}
      <div
        style={{ position: "relative", zIndex: 1 }}
        className="min-h-dvh"
      >
        {children}
      </div>

      <Reveal />
    </div>
  );
}

function FrameTopBar() {
  return (
    <div
      aria-hidden
      className="trb-section"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        paddingTop: "1.125rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid var(--trb-line-faint)",
      }}
    >
      <div
        className="trb-inner"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <TriboraMark />
        <span
          className="trb-mono-sm"
          style={{ color: "var(--trb-ink-faint)" }}
        >
          v2.4.1
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--trb-line-faint)" }} />
        <span
          className="trb-mono-sm"
          style={{ color: "var(--trb-ink-faint)" }}
        >
          AUTH · SECURE CHANNEL
        </span>
      </div>
    </div>
  );
}

function FrameBottomBar() {
  return (
    <div
      aria-hidden
      className="trb-section"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        paddingTop: "0.75rem",
        paddingBottom: "1.125rem",
        borderTop: "1px solid var(--trb-line-faint)",
      }}
    >
      <div
        className="trb-inner"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{ color: "var(--trb-ink-faint)" }}
        >
          TRIBORA · AUTH · REV 2026-04-18
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--trb-line-faint)" }} />
        <span
          className="trb-mono-sm"
          style={{ color: "var(--trb-ink-faint)" }}
        >
          TLS 1.3 · AES-256 · ZERO-LOG
        </span>
      </div>
    </div>
  );
}

function TriboraMark() {
  return (
    <span
      aria-label="Tribora"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.625rem",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "flex-end",
          gap: 3,
          height: 18,
        }}
      >
        <span style={{ width: 2, height: 6, background: "var(--trb-ink-muted)" }} />
        <span style={{ width: 2, height: 14, background: "var(--trb-signal)" }} />
        <span style={{ width: 2, height: 10, background: "var(--trb-ink-muted)" }} />
      </span>
      <span
        style={{
          fontFamily: "var(--trb-font-display)",
          fontSize: 17,
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
