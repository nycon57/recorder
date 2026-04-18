"use client";

import { useEffect, useRef, useState } from "react";

export function ProductSurface() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="surface"
      ref={ref}
      className="trb-section"
      aria-labelledby="surface-head"
      style={{
        paddingTop: "clamp(4rem, 7vw, 7rem)",
        paddingBottom: "clamp(4rem, 7vw, 7rem)",
        borderTop: "1px solid var(--trb-line)",
        background: "oklch(0.152 0.008 60)",
      }}
    >
      <div className="trb-inner">
        {/* Section header row */}
        <div
          data-reveal
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1.25rem",
            marginBottom: "clamp(2rem, 4vw, 3.5rem)",
            borderBottom: "1px solid var(--trb-line)",
            paddingBottom: "0.875rem",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-signal)" }}
          >
            §02
          </span>
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-dim)" }}
          >
            / IN THE APP
          </span>
          <span
            style={{ flex: 1, height: 1, background: "var(--trb-line)" }}
          />
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            FIG-02 / PRODUCT SURFACE
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.8fr)",
            gap: "clamp(1.5rem, 3vw, 3rem)",
            alignItems: "start",
          }}
        >
          {/* Left: narrative copy */}
          <div data-reveal style={{ minWidth: 0, paddingTop: "0.5rem" }}>
            <h2
              id="surface-head"
              className="trb-display"
              style={{
                fontSize: "clamp(1.9rem, 1.1rem + 2.2vw, 2.875rem)",
                lineHeight: 1.02,
                marginBottom: "1rem",
                maxWidth: "14ch",
              }}
            >
              Press{" "}
              <span className="trb-kbd" style={{ fontSize: "0.6em", verticalAlign: "middle" }}>
                ⌘K
              </span>{" "}
              &mdash; you&rsquo;re home.
            </h2>
            <p
              style={{
                color: "var(--trb-ink-muted)",
                fontSize: "var(--trb-size-body-l)",
                lineHeight: 1.55,
                maxWidth: "44ch",
                marginBottom: "1.5rem",
              }}
            >
              One surface, keyboard-first. Capture, transcript, summary, and
              search live behind a single palette — and every result lands on
              the exact second of the recording that answers the question.
            </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxWidth: "30ch",
              }}
            >
              {[
                ["01", "No mouse required"],
                ["02", "Answers, not pages"],
                ["03", "Citations built in"],
              ].map(([n, label]) => (
                <li
                  key={n}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.75rem",
                    alignItems: "baseline",
                    padding: "0.4375rem 0",
                    borderBottom: "1px solid var(--trb-line)",
                  }}
                >
                  <span
                    className="trb-mono-sm"
                    style={{ color: "var(--trb-signal)" }}
                  >
                    {n}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--trb-font-display)",
                      fontSize: 15,
                      fontWeight: 500,
                      color: "var(--trb-ink)",
                    }}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: app mockup */}
          <div data-reveal style={{ minWidth: 0 }}>
            <AppMockup active={active} />
          </div>
        </div>
      </div>
    </section>
  );
}

function AppMockup({ active }: { active: boolean }) {
  return (
    <div
      style={{
        background: "oklch(0.128 0.008 60)",
        border: "1px solid var(--trb-line-strong)",
        borderRadius: 4,
        overflow: "hidden",
        boxShadow: "0 30px 80px -30px oklch(0 0 0 / 0.7)",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "0.5rem 0.75rem 0.5rem 0.875rem",
          borderBottom: "1px solid var(--trb-line)",
          background: "oklch(0.158 0.008 60)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "oklch(0.32 0.006 60)",
            }}
          />
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "oklch(0.32 0.006 60)",
            }}
          />
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "oklch(0.32 0.006 60)",
            }}
          />
        </div>
        <div
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            fontSize: 10,
          }}
        >
          tribora.app / library / rec_018fj3
        </div>
        <div className="flex items-center gap-2">
          <span className="trb-pip" />
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-live, oklch(0.76 0.155 148))", fontSize: 10 }}
          >
            INDEXED 00:04 AGO
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px minmax(0, 1.4fr) minmax(0, 1fr)",
          minHeight: 420,
        }}
      >
        {/* Left: recording list */}
        <div
          style={{
            borderRight: "1px solid var(--trb-line)",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
            background: "oklch(0.138 0.008 60)",
          }}
        >
          <div
            className="trb-mono-sm"
            style={{
              color: "var(--trb-ink-faint)",
              padding: "0.25rem 0.125rem 0.625rem",
            }}
          >
            LIBRARY / 247
          </div>
          {[
            { t: "Onboarding — hire #14", meta: "09:24 · ACCT-TEAM" },
            { t: "Incident RCA — 04-12", meta: "18:06 · ENG-SRE", active: true },
            { t: "Sales demo — Acme", meta: "22:41 · GTM" },
            { t: "Vendor intake — Figma", meta: "14:07 · OPS" },
            { t: "QBR recap — Q1", meta: "36:19 · LEAD" },
            { t: "Playbook — refunds", meta: "11:52 · SUPPORT" },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                padding: "0.5rem 0.5rem",
                background: r.active
                  ? "oklch(0.78 0.155 72 / 0.1)"
                  : "transparent",
                border: r.active
                  ? "1px solid oklch(0.78 0.155 72 / 0.32)"
                  : "1px solid transparent",
                borderRadius: 2,
                position: "relative",
              }}
            >
              {r.active && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    background: "var(--trb-signal)",
                  }}
                />
              )}
              <div
                style={{
                  fontFamily: "var(--trb-font-display)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: r.active ? "var(--trb-ink)" : "var(--trb-ink-muted)",
                  marginBottom: 2,
                }}
              >
                {r.t}
              </div>
              <div
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)", fontSize: 9 }}
              >
                {r.meta}
              </div>
            </div>
          ))}
        </div>

        {/* Middle: transcript + waveform */}
        <div
          style={{
            borderRight: "1px solid var(--trb-line)",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {/* Waveform */}
          <div
            style={{
              padding: "0.75rem 0.875rem",
              borderBottom: "1px solid var(--trb-line)",
              background: "oklch(0.145 0.008 60)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)" }}
              >
                WAVEFORM / 18:06
              </span>
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-signal)" }}
              >
                ▶ 09:42
              </span>
            </div>
            <Waveform active={active} />
          </div>

          {/* Transcript */}
          <div style={{ padding: "0.875rem", flex: 1, overflow: "hidden" }}>
            <div
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)", marginBottom: "0.625rem" }}
            >
              TRANSCRIPT / DIARIZED
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6875rem",
              }}
            >
              {[
                {
                  speaker: "R. CHEN",
                  ts: "09:38",
                  text: "We traced it back to a stale pgvector index — rebuilt in place with CONCURRENTLY and the p50 came right back.",
                },
                {
                  speaker: "J. PARK",
                  ts: "09:42",
                  text: "Fix was in — can you grab the exact command so we add it to the runbook?",
                  highlight: true,
                },
                {
                  speaker: "R. CHEN",
                  ts: "09:48",
                  text: "`REINDEX INDEX CONCURRENTLY idx_chunks_embedding;` — ran it during low traffic, zero downtime.",
                },
              ].map((line, i) => (
                <div key={i} style={{ display: "grid", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.625rem",
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      className="trb-mono-sm"
                      style={{
                        color: line.highlight
                          ? "var(--trb-signal)"
                          : "var(--trb-ink-faint)",
                        fontSize: 10,
                      }}
                    >
                      {line.speaker}
                    </span>
                    <span
                      className="trb-mono-sm"
                      style={{ color: "var(--trb-ink-faint)", fontSize: 10 }}
                    >
                      {line.ts}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      color: line.highlight
                        ? "var(--trb-ink)"
                        : "var(--trb-ink-muted)",
                      background: line.highlight
                        ? "oklch(0.78 0.155 72 / 0.08)"
                        : "transparent",
                      padding: line.highlight ? "0.25rem 0.375rem" : "0",
                      borderLeft: line.highlight
                        ? "1px solid oklch(0.78 0.155 72 / 0.42)"
                        : "0",
                      marginLeft: line.highlight ? "-0.375rem" : 0,
                    }}
                  >
                    {line.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: summary doc + search */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {/* Search strip at top */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 0.75rem",
              borderBottom: "1px solid var(--trb-line)",
              background: "oklch(0.138 0.008 60)",
            }}
          >
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-signal)" }}
            >
              ›
            </span>
            <div
              style={{
                flex: 1,
                fontFamily: "var(--trb-font-body)",
                fontSize: 12,
                color: "var(--trb-ink)",
              }}
            >
              how did we fix the index stall<span className="trb-caret" />
            </div>
            <span className="trb-kbd" style={{ fontSize: 9 }}>
              ⌘K
            </span>
          </div>

          {/* Summary doc */}
          <div
            style={{
              padding: "0.875rem 0.875rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              flex: 1,
            }}
          >
            <div
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)" }}
            >
              STRUCTURED / SUMMARY
            </div>

            <div>
              <div
                style={{
                  fontFamily: "var(--trb-font-display)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--trb-ink)",
                  marginBottom: "0.375rem",
                  lineHeight: 1.15,
                }}
              >
                Rebuild the embedding index concurrently.
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--trb-ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                Run{" "}
                <code
                  style={{
                    fontFamily: "var(--trb-font-mono)",
                    fontSize: 10.5,
                    background: "oklch(0.172 0.008 60)",
                    padding: "0.0625rem 0.25rem",
                    border: "1px solid var(--trb-line)",
                  }}
                >
                  REINDEX INDEX CONCURRENTLY
                </code>{" "}
                during low traffic. Zero downtime; p50 latency returns to
                baseline within 30s.
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.375rem",
                  marginTop: "0.4375rem",
                  flexWrap: "wrap",
                }}
              >
                <Citation ts="09:42" />
                <Citation ts="09:48" />
              </div>
            </div>

            <div
              style={{
                height: 1,
                background: "var(--trb-line)",
              }}
            />

            <div>
              <div
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)", marginBottom: "0.4375rem" }}
              >
                ACTIONS / 3
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3125rem",
                }}
              >
                {[
                  "Add command to SRE runbook",
                  "Schedule index audit · weekly",
                  "Ping on-call if p50 > 800ms",
                ].map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "16px 1fr",
                      gap: "0.4375rem",
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        border: "1px solid var(--trb-ink-faint)",
                        background: i === 0 ? "var(--trb-signal)" : "transparent",
                        borderColor:
                          i === 0 ? "var(--trb-signal)" : "var(--trb-ink-faint)",
                        marginTop: 3,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color:
                          i === 0
                            ? "var(--trb-ink-dim)"
                            : "var(--trb-ink-muted)",
                        textDecoration: i === 0 ? "line-through" : "none",
                      }}
                    >
                      {a}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0.375rem 0.75rem",
          borderTop: "1px solid var(--trb-line)",
          background: "oklch(0.158 0.008 60)",
        }}
      >
        <div
          className="trb-mono-sm"
          style={{ color: "var(--trb-ink-faint)", fontSize: 10 }}
        >
          ORG / ACME-RND · RLS ENFORCED · AUDIT LOG ON
        </div>
        <div
          className="trb-mono-sm"
          style={{ color: "var(--trb-ink-faint)", fontSize: 10 }}
        >
          TRIBORA v2.4.1 · BUILD 8f3a1c
        </div>
      </div>

      {/* Embedded keyframes for the caret + waveform play cursor */}
      <style jsx>{`
        :global(.trb-caret) {
          display: inline-block;
          width: 7px;
          height: 12px;
          background: var(--trb-signal);
          margin-left: 2px;
          vertical-align: middle;
          animation: trb-blink 1s steps(2, end) infinite;
        }
        @keyframes trb-blink {
          50% {
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.trb-caret) {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function Citation({ ts }: { ts: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--trb-font-mono)",
        fontSize: 10,
        color: "var(--trb-signal)",
        padding: "0.125rem 0.375rem",
        border: "1px solid oklch(0.78 0.155 72 / 0.34)",
        background: "oklch(0.78 0.155 72 / 0.06)",
      }}
    >
      @ {ts}
    </span>
  );
}

function Waveform({ active }: { active: boolean }) {
  // Pseudo-random heights for a stable, specimen-y waveform
  const bars = [
    4, 6, 10, 14, 18, 12, 16, 22, 28, 24, 18, 14, 10, 14, 20, 26, 32, 28, 22, 18,
    14, 10, 12, 18, 24, 30, 34, 28, 22, 16, 12, 8, 10, 14, 18, 22, 26, 22, 18,
    14, 12, 16, 20, 24, 28, 32, 28, 22, 16, 12, 10, 14, 18, 22, 26, 30, 26, 20,
    14, 10, 8, 10, 12, 14,
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1.5,
        height: 40,
        position: "relative",
      }}
    >
      {bars.map((h, i) => {
        const isPast = i < Math.floor((bars.length / 18) * 9.7); // aligned with 09:42
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}px`,
              background: isPast
                ? "oklch(0.60 0.08 70)"
                : "oklch(0.32 0.012 64)",
              transition: "background-color var(--trb-dur-slow) var(--trb-ease)",
            }}
          />
        );
      })}
      {/* Playhead marker */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -4,
          bottom: -4,
          left: "54%",
          width: 1.5,
          background: "var(--trb-signal)",
          boxShadow: "0 0 0 3px oklch(0.78 0.155 72 / 0.2)",
        }}
      />
    </div>
  );
}
