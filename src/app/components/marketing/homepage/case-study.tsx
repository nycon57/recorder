"use client";

export function CaseStudy() {
  return (
    <section
      id="case-study"
      className="trb-section"
      aria-labelledby="case-head"
      style={{
        paddingTop: "clamp(5rem, 8vw, 9rem)",
        paddingBottom: "clamp(5rem, 8vw, 9rem)",
        borderTop: "1px solid var(--trb-line)",
        background: "var(--trb-surface-1)",
      }}
    >
      <div className="trb-inner">
        {/* Header strip */}
        <div
          data-reveal
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1rem",
            marginBottom: "clamp(2.5rem, 4vw, 4rem)",
            borderBottom: "1px solid var(--trb-line)",
            paddingBottom: "0.875rem",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-signal)" }}
          >
            §06
          </span>
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-dim)" }}
          >
            / IN PRACTICE
          </span>
          <span
            style={{ flex: 1, height: 1, background: "var(--trb-line)" }}
          />
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            CASE PLATE / 01 OF 01
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 70px) minmax(0, 1fr)",
            gap: "clamp(1.25rem, 3vw, 3rem)",
            alignItems: "start",
          }}
        >
          {/* Left: hanging quotation glyph */}
          <div
            aria-hidden
            data-reveal
            style={{
              fontFamily: "var(--trb-font-display)",
              fontSize: "clamp(3rem, 2rem + 4vw, 5.5rem)",
              color: "var(--trb-signal)",
              lineHeight: 0.8,
              fontWeight: 500,
              paddingTop: "0.25rem",
            }}
          >
            &ldquo;
          </div>

          <div style={{ minWidth: 0 }}>
            <blockquote
              id="case-head"
              data-reveal
              className="trb-display"
              style={{
                fontSize: "clamp(1.65rem, 1rem + 2vw, 2.75rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "var(--trb-ink)",
                maxWidth: "28ch",
                marginBottom: "2rem",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": "60ms",
              }}
            >
              We replaced three separate docs tools. Our support team now
              finds the right answer before the customer finishes their
              sentence.
            </blockquote>

            {/* Author specimen line */}
            <div
              data-reveal
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem 1rem",
                alignItems: "baseline",
                marginBottom: "1.5rem",
                fontFamily: "var(--trb-font-mono)",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": "140ms",
              }}
            >
              <span style={{ color: "var(--trb-ink)" }}>
                M. OKAFOR
              </span>
              <span style={{ color: "var(--trb-ink-faint)" }}>·</span>
              <span style={{ color: "var(--trb-ink-muted)" }}>
                VP CUSTOMER OPS
              </span>
              <span style={{ color: "var(--trb-ink-faint)" }}>·</span>
              <span style={{ color: "var(--trb-ink-muted)" }}>
                BORDEROS
              </span>
              <span style={{ color: "var(--trb-ink-faint)" }}>·</span>
              <span style={{ color: "var(--trb-ink-muted)" }}>
                FINTECH / 480 AGENTS
              </span>
            </div>

            {/* Hairline + supporting paragraph */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
                gap: "clamp(1rem, 2vw, 2.5rem)",
                borderTop: "1px solid var(--trb-line)",
                paddingTop: "1.5rem",
              }}
            >
              <p
                data-reveal
                style={{
                  color: "var(--trb-ink-muted)",
                  fontSize: "var(--trb-size-body-l)",
                  lineHeight: 1.55,
                  maxWidth: "52ch",
                  // @ts-expect-error custom CSS var
                  "--trb-reveal-delay": "200ms",
                }}
              >
                Borderos rolled Tribora to their 480-agent support team over a
                three-week pilot. Four weeks after general availability,
                average first-response time on tier-2 tickets had fallen by
                62% and internal training load for new hires had dropped from
                16 hours to 5.
              </p>

              {/* Small specimen data table */}
              <dl
                data-reveal
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  columnGap: "1rem",
                  rowGap: "0.375rem",
                  border: "1px solid var(--trb-line)",
                  padding: "0.75rem 0.875rem",
                  background: "var(--trb-surface-0)",
                  margin: 0,
                  // @ts-expect-error custom CSS var
                  "--trb-reveal-delay": "280ms",
                }}
              >
                {[
                  ["DEPLOYED", "2026-Q1"],
                  ["USERS", "480 / 4 ORGS"],
                  ["TRAINED ON", "2,108 RECORDINGS"],
                  ["TTR DELTA", "−62%"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt
                      className="trb-mono-sm"
                      style={{ color: "var(--trb-ink-faint)", margin: 0 }}
                    >
                      {k}
                    </dt>
                    <dd
                      style={{
                        fontFamily: "var(--trb-font-mono)",
                        fontSize: 11,
                        letterSpacing: "0.04em",
                        color:
                          k === "TTR DELTA"
                            ? "var(--trb-signal)"
                            : "var(--trb-ink)",
                        margin: 0,
                      }}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Read the full story link */}
            <div
              style={{ marginTop: "1.5rem" }}
              data-reveal
            >
              <a
                href="/customers/borderos"
                className="trb-link"
                style={{
                  fontSize: 14,
                  color: "var(--trb-ink)",
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: "0.5rem",
                }}
              >
                Read the full Borderos story
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-ink-dim)" }}
                >
                  → /customers/borderos
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
