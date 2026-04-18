"use client";

export function Closing() {
  return (
    <section
      id="closing"
      className="trb-section"
      aria-labelledby="closing-head"
      style={{
        paddingTop: "clamp(6rem, 10vw, 11rem)",
        paddingBottom: "clamp(6rem, 10vw, 11rem)",
        borderTop: "1px solid var(--trb-line)",
        textAlign: "center",
        position: "relative",
      }}
    >
      {/* Ambient dotted backdrop */}
      <div
        aria-hidden
        className="trb-grid-overlay"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.45,
        }}
      />

      <div
        className="trb-inner"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(1.5rem, 3vw, 2.5rem)",
        }}
      >
        <div
          className="flex items-center gap-3"
          data-reveal
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-signal)" }}
          >
            §09
          </span>
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-dim)" }}
          >
            / BOOK A DEMO
          </span>
        </div>

        <h2
          id="closing-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(2.75rem, 1.5rem + 5vw, 5.5rem)",
            lineHeight: 0.98,
            maxWidth: "20ch",
            // @ts-expect-error custom CSS var
            "--trb-reveal-delay": "80ms",
          }}
        >
          See it answer a question{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            from your actual data. Live.
          </span>
        </h2>

        <p
          data-reveal
          style={{
            color: "var(--trb-ink-muted)",
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            maxWidth: "58ch",
            // @ts-expect-error custom CSS var
            "--trb-reveal-delay": "160ms",
          }}
        >
          Thirty minutes. Your team. Your data. We&rsquo;ll record one of the
          questions your senior rep gets asked every week, watch it land in
          your knowledge base, then pull the answer out &mdash; citation
          included. If any of it falls over, that&rsquo;s worth knowing too.
        </p>

        <div
          data-reveal
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.75rem",
            marginTop: "0.25rem",
            // @ts-expect-error custom CSS var
            "--trb-reveal-delay": "240ms",
          }}
        >
          <a
            href="/book-demo"
            className="trb-cta"
            style={{
              padding: "0.9375rem 1.625rem 1rem",
              fontSize: "1rem",
            }}
          >
            Book a demo
            <span className="trb-cta-glyph">→</span>
          </a>
          <a
            href="mailto:hello@tribora.com"
            className="trb-ghost"
            style={{
              padding: "0.875rem 1.5rem",
            }}
          >
            Or email us
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-dim)" }}
            >
              hello@tribora.com
            </span>
          </a>
        </div>

        <div
          data-reveal
          className="flex items-center justify-center gap-2"
          style={{
            marginTop: "1rem",
            // @ts-expect-error custom CSS var
            "--trb-reveal-delay": "320ms",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            THIRTY MINUTES · YOUR DATA · NO MQL GAUNTLET
          </span>
        </div>
      </div>
    </section>
  );
}
