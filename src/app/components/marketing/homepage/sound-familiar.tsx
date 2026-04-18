"use client";

/**
 * §01 / SOUND FAMILIAR?
 *
 * Pain-mirror section. Four customer-voice quotes that the Head of Support
 * has heard (or said) this month. The buyer reads this section and thinks:
 * "that's us." No mention of product yet — this is pure recognition.
 *
 * Source of truth: tasks/messaging.md §3 (the two pains).
 */

type PainQuote = {
  mark: string; // §01.a → §01.d
  quote: string;
  voice: string; // who says it
  kind: "QUESTION-FATIGUE" | "STAFFING-RISK" | "ATTENDANCE" | "ROT";
};

const PAINS: PainQuote[] = [
  {
    mark: "§01.a",
    quote: "Same question. Different person. Fortieth time this quarter.",
    voice: "THE SENIOR SUPPORT REP",
    kind: "QUESTION-FATIGUE",
  },
  {
    mark: "§01.b",
    quote: "We'd be screwed the day Priya leaves.",
    voice: "THE HEAD OF OPERATIONS",
    kind: "STAFFING-RISK",
  },
  {
    mark: "§01.c",
    quote: "The training ran an hour. Eight people out of forty showed up.",
    voice: "THE HEAD OF ENABLEMENT",
    kind: "ATTENDANCE",
  },
  {
    mark: "§01.d",
    quote: "Our wiki is a graveyard. Everyone knows it's out of date.",
    voice: "THE DIRECTOR OF CUSTOMER EXPERIENCE",
    kind: "ROT",
  },
];

export function SoundFamiliar() {
  return (
    <section
      id="sound-familiar"
      className="trb-section"
      aria-labelledby="sound-familiar-head"
      style={{
        paddingTop: "clamp(5rem, 8vw, 9rem)",
        paddingBottom: "clamp(4.5rem, 7vw, 8rem)",
        borderTop: "1px solid var(--trb-line)",
        background: "var(--trb-surface-1)",
        position: "relative",
      }}
    >
      <div className="trb-inner">
        {/* Section header */}
        <header
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(0, 540px)",
            gap: "clamp(1.5rem, 3vw, 3rem)",
            alignItems: "end",
            marginBottom: "clamp(2.5rem, 4vw, 4rem)",
          }}
          className="sound-familiar-header"
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
                §01
              </span>
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                / SOUND FAMILIAR?
              </span>
            </div>
            <h2
              id="sound-familiar-head"
              className="trb-display"
              style={{
                fontSize: "var(--trb-size-display-l)",
                maxWidth: "20ch",
              }}
            >
              If any of these
              <br />
              <span style={{ color: "var(--trb-ink-muted)" }}>
                got said on your team this month,
              </span>
              <br />
              you&rsquo;re the buyer we built this for.
            </h2>
          </div>
          <p
            style={{
              color: "var(--trb-ink-muted)",
              fontSize: "var(--trb-size-body-l)",
              lineHeight: 1.55,
              maxWidth: "48ch",
              paddingBottom: "0.5rem",
            }}
          >
            The same four sentences run every support team. They don&rsquo;t
            sound like a tooling problem &mdash; they sound like staffing,
            training, or culture. They are all the same problem:{" "}
            <em>the answer lives in one person&rsquo;s head, not in yours.</em>
          </p>
        </header>

        {/* Quote grid — 2×2 on wide, stacked on narrow */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 0,
            borderTop: "1px solid var(--trb-line-strong)",
            borderLeft: "1px solid var(--trb-line-strong)",
          }}
          className="pain-grid"
        >
          {PAINS.map((pain, i) => (
            <PainCell key={pain.mark} pain={pain} index={i} />
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.sound-familiar-header) {
            grid-template-columns: 1fr !important;
            align-items: start !important;
            row-gap: 1.25rem;
          }
        }
      `}</style>
    </section>
  );
}

function PainCell({ pain, index }: { pain: PainQuote; index: number }) {
  return (
    <figure
      data-reveal
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        padding: "clamp(1.75rem, 3vw, 2.5rem) clamp(1.25rem, 2.5vw, 2rem)",
        borderRight: "1px solid var(--trb-line-strong)",
        borderBottom: "1px solid var(--trb-line-strong)",
        background: "var(--trb-surface-0)",
        minHeight: 220,
        // @ts-expect-error custom CSS var
        "--trb-reveal-delay": `${index * 60}ms`,
      }}
    >
      {/* Specimen marker row */}
      <div
        className="flex items-center justify-between"
        style={{ gap: "0.75rem" }}
      >
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-signal)",
            fontSize: 10,
            letterSpacing: "0.14em",
          }}
        >
          {pain.mark}
        </span>
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            fontSize: 10,
            letterSpacing: "0.12em",
          }}
        >
          {pain.kind}
        </span>
      </div>

      {/* The quote itself — treated as display type */}
      <blockquote
        style={{
          margin: 0,
          flex: 1,
          fontFamily: "var(--trb-font-display)",
          fontSize: "clamp(1.25rem, 0.75rem + 1.3vw, 1.75rem)",
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: "-0.015em",
          color: "var(--trb-ink)",
          position: "relative",
          paddingLeft: "1.25rem",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: "-0.15em",
            fontFamily: "var(--trb-font-display)",
            fontSize: "2.25em",
            color: "var(--trb-signal)",
            lineHeight: 1,
            fontWeight: 500,
          }}
        >
          &ldquo;
        </span>
        {pain.quote}
      </blockquote>

      {/* Attribution */}
      <figcaption
        className="trb-mono-sm"
        style={{
          color: "var(--trb-ink-faint)",
          fontSize: 11,
          letterSpacing: "0.1em",
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--trb-line)",
        }}
      >
        &mdash; {pain.voice}
      </figcaption>
    </figure>
  );
}
