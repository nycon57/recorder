"use client";

/**
 * §02 / HOW IT WORKS
 *
 * Three plain-English steps. Demystifies the mechanism before the reader
 * has to learn the four surfaces. This section exists because the prior
 * iteration led with "four surfaces, one instrument" and readers couldn't
 * tell what the product was.
 *
 * Voice: Head of Support explaining to her CFO. Numbers, not adjectives.
 * Source of truth: tasks/messaging.md §9 homepage narrative.
 */

type Step = {
  n: string; // 01 / 02 / 03
  verb: string; // RECORD / ORGANIZE / TEACH
  headline: string;
  body: string;
  evidence: Array<{ k: string; v: string }>;
};

const STEPS: Step[] = [
  {
    n: "01",
    verb: "RECORD",
    headline: "Someone on your team explains the thing once.",
    body: "Ninety seconds of screen + voice. One click to start, one click to stop. No editing, no titles, no tagging. The most-senior person on your team contributes the top ten questions they get asked. That's the entire rollout.",
    evidence: [
      { k: "TIME", v: "90S MEDIAN" },
      { k: "CLICKS", v: "1 TO START · 1 TO STOP" },
      { k: "EDITING", v: "NONE REQUIRED" },
    ],
  },
  {
    n: "02",
    verb: "ORGANIZE",
    headline: "Tribora turns the clip into a cited answer.",
    body: "The recording is transcribed, structured, and linked into your team's knowledge base automatically. Every sentence anchors to the second it was spoken. The answer is searchable roughly ninety seconds after stop.",
    evidence: [
      { k: "STOP → SEARCHABLE", v: "≤ 90S" },
      { k: "CITATIONS", v: "LINE-LEVEL · INLINE" },
      { k: "WRITING REQUIRED", v: "ZERO" },
    ],
  },
  {
    n: "03",
    verb: "TEACH",
    headline: "Every new hire gets an always-on tutor.",
    body: "The next time someone asks the question — in Slack, in Zendesk, in your own app — the tutor answers in the tool they're already using. Plays the clip. Highlights the exact sentence. Cites the source. The senior person on your team never gets the ping.",
    evidence: [
      { k: "ANSWER TIME", v: "< 2S ROUND-TRIP" },
      { k: "WHERE IT LIVES", v: "EVERY WEB APP · YOUR BRAND" },
      { k: "TRAINED ON", v: "YOUR TEAM · NOT THE INTERNET" },
    ],
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="trb-section"
      aria-labelledby="how-it-works-head"
      style={{
        paddingTop: "clamp(5rem, 8vw, 9rem)",
        paddingBottom: "clamp(4.5rem, 7vw, 8rem)",
        borderTop: "1px solid var(--trb-line)",
        position: "relative",
      }}
    >
      <div className="trb-inner">
        {/* Section header */}
        <header
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(0, 560px)",
            gap: "clamp(1.5rem, 3vw, 3rem)",
            alignItems: "end",
            marginBottom: "clamp(2.5rem, 5vw, 4.5rem)",
          }}
          className="how-it-works-header"
        >
          <div>
            <div
              className="flex items-center gap-3"
              style={{ marginBottom: "0.875rem" }}
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
                / HOW IT WORKS
              </span>
            </div>
            <h2
              id="how-it-works-head"
              className="trb-display"
              style={{
                fontSize: "var(--trb-size-display-l)",
                maxWidth: "18ch",
              }}
            >
              Three steps.
              <br />
              <span style={{ color: "var(--trb-ink-muted)" }}>
                Ninety seconds in. Answers out.
              </span>
            </h2>
          </div>
          <p
            style={{
              color: "var(--trb-ink-muted)",
              fontSize: "var(--trb-size-body-l)",
              lineHeight: 1.55,
              maxWidth: "52ch",
              paddingBottom: "0.375rem",
            }}
          >
            Your team already records training videos, already writes wikis,
            already answers tickets. Tribora is what happens when those three
            loops actually compound instead of getting re-done every quarter.
          </p>
        </header>

        {/* Step rows */}
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderTop: "1px solid var(--trb-line-strong)",
          }}
        >
          {STEPS.map((step, i) => (
            <StepRow
              key={step.n}
              step={step}
              isLast={i === STEPS.length - 1}
              delay={i}
            />
          ))}
        </ol>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.how-it-works-header) {
            grid-template-columns: 1fr !important;
            align-items: start !important;
            row-gap: 1.25rem;
          }
        }
        @media (max-width: 860px) {
          :global(.step-row) {
            grid-template-columns: 1fr !important;
            column-gap: 0 !important;
            row-gap: 1.25rem !important;
          }
        }
      `}</style>
    </section>
  );
}

function StepRow({
  step,
  isLast,
  delay,
}: {
  step: Step;
  isLast: boolean;
  delay: number;
}) {
  return (
    <li
      data-reveal
      className="step-row"
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(0, 110px) minmax(0, 1.4fr) minmax(240px, 340px)",
        columnGap: "clamp(1rem, 2.5vw, 2.75rem)",
        padding: "clamp(2rem, 3vw, 2.75rem) 0",
        borderBottom: isLast ? "none" : "1px solid var(--trb-line-strong)",
        alignItems: "start",
        // @ts-expect-error custom CSS var
        "--trb-reveal-delay": `${delay * 80}ms`,
      }}
    >
      {/* Left rail: oversized number + verb */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--trb-font-display)",
            fontSize: "clamp(2.75rem, 1.5rem + 3vw, 4.25rem)",
            fontWeight: 500,
            lineHeight: 0.85,
            letterSpacing: "-0.02em",
            color: "var(--trb-signal)",
          }}
        >
          {step.n}
        </span>
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            fontSize: 11,
            letterSpacing: "0.16em",
            fontWeight: 600,
          }}
        >
          {step.verb}
        </span>
      </div>

      {/* Middle: headline + body */}
      <div style={{ minWidth: 0 }}>
        <h3
          className="trb-display"
          style={{
            fontSize: "clamp(1.5rem, 0.85rem + 1.8vw, 2.25rem)",
            lineHeight: 1.05,
            marginBottom: "0.875rem",
            maxWidth: "24ch",
          }}
        >
          {step.headline}
        </h3>
        <p
          style={{
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            color: "var(--trb-ink-muted)",
            maxWidth: "58ch",
          }}
        >
          {step.body}
        </p>
      </div>

      {/* Right: evidence panel */}
      <aside
        aria-label={`${step.verb} evidence`}
        style={{
          border: "1px solid var(--trb-line)",
          padding: "0.875rem 1rem 1rem",
          background: "var(--trb-surface-1)",
          minWidth: 0,
        }}
      >
        <div
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            marginBottom: "0.75rem",
            paddingBottom: "0.5rem",
            borderBottom: "1px solid var(--trb-line)",
            fontSize: 10,
            letterSpacing: "0.14em",
          }}
        >
          STEP {step.n} · EVIDENCE
        </div>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(112px, auto) 1fr",
            columnGap: "1rem",
            rowGap: "0.5rem",
            margin: 0,
          }}
        >
          {step.evidence.map((row) => (
            <div key={row.k} style={{ display: "contents" }}>
              <dt
                style={{
                  fontFamily: "var(--trb-font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: "var(--trb-ink-faint)",
                  textTransform: "uppercase",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {row.k}
              </dt>
              <dd
                style={{
                  fontFamily: "var(--trb-font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: "var(--trb-ink)",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {row.v}
              </dd>
            </div>
          ))}
        </dl>
      </aside>
    </li>
  );
}
