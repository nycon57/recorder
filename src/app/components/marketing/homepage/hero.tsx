"use client";

import { PipelineSpecimen } from "./pipeline-specimen";

const SPECIMEN_STRIP = [
  { label: "SOC 2", value: "TYPE II" },
  { label: "HIPAA", value: "READY" },
  { label: "SSO", value: "OKTA · ENTRA · GOOGLE" },
  { label: "DATA", value: "US / EU" },
  { label: "SDK", value: "WHITE-LABEL" },
];

export function Hero() {
  return (
    <section
      id="hero"
      className="trb-section"
      aria-labelledby="hero-headline"
      style={{
        position: "relative",
        paddingTop: "clamp(2.5rem, 3vw + 1rem, 4.5rem)",
        paddingBottom: "clamp(3rem, 4vw + 1rem, 6rem)",
      }}
    >
      {/* Subtle dotted grid backdrop, masked out on the sides */}
      <div
        aria-hidden
        className="trb-grid-overlay"
        style={{
          top: 0,
          bottom: 0,
          inset: 0,
          height: "100%",
          position: "absolute",
          zIndex: 0,
        }}
      />

      <div
        className="trb-inner"
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
          gap: "clamp(2rem, 4vw, 5rem)",
          alignItems: "start",
        }}
      >
        {/* Left column — copy */}
        <div style={{ minWidth: 0 }}>
          {/* Specimen marker row */}
          <SpecimenMarkerRow />

          <h1
            id="hero-headline"
            className="trb-display"
            data-reveal
            style={{
              fontSize: "var(--trb-size-display-xl)",
              lineHeight: 0.94,
              marginTop: "1.25rem",
              marginBottom: "1.5rem",
              maxWidth: "15ch",
            }}
          >
            Stop answering the same{" "}
            <span style={{ color: "var(--trb-ink-muted)" }}>
              question forty times
            </span>
            <span style={{ color: "var(--trb-signal)" }}>.</span>
          </h1>

          <p
            data-reveal
            style={{
              maxWidth: "52ch",
              fontSize: "var(--trb-size-body-l)",
              lineHeight: 1.55,
              color: "var(--trb-ink-muted)",
              marginBottom: "2rem",
              letterSpacing: "0.005em",
              // @ts-expect-error custom CSS var
              "--trb-reveal-delay": "80ms",
            }}
          >
            Your senior team already knows the answer. Tribora captures it once,
            in a ninety-second screen share &mdash; then gives every new hire an
            always-on tutor trained on your playbook, not the internet.
          </p>

          {/* CTA row */}
          <div
            data-reveal
            className="flex flex-wrap items-center gap-3"
            style={{
              marginBottom: "2.75rem",
              // @ts-expect-error custom CSS var
              "--trb-reveal-delay": "140ms",
            }}
          >
            <a
              href="#closing"
              className="trb-cta"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("closing")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Book a demo
              <span className="trb-cta-glyph">→</span>
            </a>
            <a
              href="#how-it-works"
              className="trb-ghost"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("how-it-works")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              See how it works
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                §02
              </span>
            </a>
          </div>

          {/* Specimen strip — enterprise readiness mini labels */}
          <div
            data-reveal
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(100px, max-content))",
              gap: "0.25rem 1.5rem",
              borderTop: "1px solid var(--trb-line)",
              borderBottom: "1px solid var(--trb-line)",
              padding: "0.75rem 0",
              // @ts-expect-error custom CSS var
              "--trb-reveal-delay": "220ms",
            }}
          >
            {SPECIMEN_STRIP.map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-ink-faint)" }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--trb-font-mono)",
                    fontSize: 12,
                    letterSpacing: "0.04em",
                    color: "var(--trb-ink-muted)",
                  }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — pipeline specimen */}
        <div
          data-reveal
          style={{
            minWidth: 0,
            position: "relative",
            // @ts-expect-error custom CSS var
            "--trb-reveal-delay": "180ms",
          }}
        >
          <PipelineSpecimen />
        </div>
      </div>

      {/* Corner markers (top-right) */}
      <CornerMarkers />
    </section>
  );
}

function SpecimenMarkerRow() {
  return (
    <div
      className="flex items-center gap-3"
      data-reveal
      style={{
        borderTop: "1px solid var(--trb-line)",
        paddingTop: "0.625rem",
        paddingBottom: "0.25rem",
      }}
    >
      <span
        className="trb-mono-sm"
        style={{ color: "var(--trb-signal)" }}
      >
        §00
      </span>
      <span
        className="trb-mono-sm"
        style={{ color: "var(--trb-ink-dim)" }}
      >
        / HERO
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: "var(--trb-line)",
        }}
      />
      <span
        className="trb-mono-sm"
        style={{ color: "var(--trb-ink-faint)" }}
      >
        TRIBORA · INDEX · PAGE 01 OF 07
      </span>
    </div>
  );
}

function CornerMarkers() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "1.25rem",
        right: "var(--trb-gutter)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        alignItems: "flex-end",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <span
        className="trb-mono-sm"
        style={{ color: "var(--trb-ink-faint)" }}
      >
        FIG-01 / HERO
      </span>
      <span
        className="trb-mono-sm"
        style={{ color: "var(--trb-ink-faint)" }}
      >
        REV 2026-04-17
      </span>
    </div>
  );
}
