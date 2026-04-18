"use client";

import type { ReactNode } from "react";

/**
 * §07 / WHAT ABOUT...?
 *
 * The two objections we get on every sales call, answered on the page so
 * the buyer doesn't have to surface them in a meeting. Adoption is the
 * killer for most knowledge tools; security is the killer for enterprise
 * deals.
 *
 * Kept intentionally short and plain-English — the §08 PROOF data sheet
 * that follows does the detailed security work for the IT reviewer.
 *
 * Source of truth for copy: tasks/messaging.md §4.
 */

type Objection = {
  mark: string; // §07.a / §07.b
  kicker: string; // "ADOPTION" / "SECURITY"
  question: string;
  lede: ReactNode;
  bullets: string[];
  footnote?: ReactNode;
};

const OBJECTIONS: Objection[] = [
  {
    mark: "§07.a",
    kicker: "ADOPTION",
    question: "\u201CMy team won\u2019t actually record.\u201D",
    lede: (
      <>
        Fair. You bought Loom and nobody recorded. You rolled out a wiki and
        nobody wrote in it. Here&rsquo;s why this one is different:{" "}
        <strong style={{ color: "var(--trb-ink)" }}>
          adoption is consumption-led, not contribution-led.
        </strong>
      </>
    ),
    bullets: [
      "Recording is ninety seconds of the work your team is already doing. One click to start, one click to stop. No editing, no titles, no tagging.",
      "You roll out with one person — the senior rep who gets asked everything. Ten recordings from them cover ~80% of inbound questions on most support teams.",
      "Everyone else pulls answers; they don't push content. The tutor shows up in Zendesk, in Slack, in your own app — and the answer is already there.",
    ],
    footnote: (
      <>
        <strong style={{ color: "var(--trb-ink)" }}>The rollout we see:</strong>{" "}
        one senior rep records on day one. Team-wide answer coverage by week two.
        Measured adoption &mdash; <em>answers retrieved, not recordings made</em>{" "}
        &mdash; hits 80%+ in the first month.
      </>
    ),
  },
  {
    mark: "§07.b",
    kicker: "SECURITY",
    question: "\u201CHow do we keep our data secure?\u201D",
    lede: (
      <>
        Your IT team will block the purchase if this isn&rsquo;t bulletproof.
        It is.{" "}
        <strong style={{ color: "var(--trb-ink)" }}>
          Your recordings stay in your region, behind your SSO, on controls
          your security team already accepts.
        </strong>
      </>
    ),
    bullets: [
      "SOC 2 Type II attested 2026-Q1. Report available on NDA. HIPAA-ready with a BAA signed before pilot starts for regulated customers.",
      "US, EU, and Canada data residency. The recording never leaves the region you pick. Encryption at rest and in transit; BYOK opt-in for enterprise.",
      "Single sign-on through Okta, Entra, Google, and JumpCloud on day one. Org-scoped audit log, immutable, 7-year retention.",
      "Delete-on-request in ≤ 7 days with cryptographic shred. We can prove it. Annual independent pen test; report on NDA.",
    ],
    footnote: (
      <>
        Full data sheet &mdash; every control, every disposition &mdash; in the
        next section.{" "}
        <a
          href="#proof"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("proof")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          style={{
            color: "var(--trb-signal)",
            textDecoration: "underline",
            textUnderlineOffset: "0.2em",
            textDecorationColor: "var(--trb-line-strong)",
            fontFamily: "var(--trb-font-mono)",
            fontSize: "0.875em",
            letterSpacing: "0.04em",
          }}
        >
          → JUMP TO THE SECURITY BRIEF
        </a>
      </>
    ),
  },
];

export function WhatAbout() {
  return (
    <section
      id="what-about"
      className="trb-section"
      aria-labelledby="what-about-head"
      style={{
        paddingTop: "clamp(5rem, 8vw, 9rem)",
        paddingBottom: "clamp(4.5rem, 7vw, 8rem)",
        borderTop: "1px solid var(--trb-line)",
        background: "var(--trb-surface-1)",
        position: "relative",
      }}
    >
      <div className="trb-inner">
        {/* Header */}
        <header
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(0, 520px)",
            gap: "clamp(1.5rem, 3vw, 3rem)",
            alignItems: "end",
            marginBottom: "clamp(2.5rem, 4vw, 4rem)",
          }}
          className="what-about-header"
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
                §07
              </span>
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                / WHAT ABOUT...?
              </span>
            </div>
            <h2
              id="what-about-head"
              className="trb-display"
              style={{
                fontSize: "var(--trb-size-display-l)",
                maxWidth: "18ch",
              }}
            >
              The two questions
              <br />
              <span style={{ color: "var(--trb-ink-muted)" }}>
                we get on every call.
              </span>
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
            Answered here so you don&rsquo;t have to ask. If you have a third
            one, we want to hear it &mdash;{" "}
            <a
              href="mailto:hello@tribora.com"
              style={{
                color: "var(--trb-ink)",
                textDecoration: "underline",
                textUnderlineOffset: "0.25em",
                textDecorationColor: "var(--trb-line-strong)",
              }}
            >
              email hello@tribora.com
            </a>
            .
          </p>
        </header>

        {/* Objection rows */}
        <div
          style={{
            borderTop: "1px solid var(--trb-line-strong)",
          }}
        >
          {OBJECTIONS.map((o, i) => (
            <ObjectionRow
              key={o.mark}
              objection={o}
              isLast={i === OBJECTIONS.length - 1}
              delay={i}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.what-about-header) {
            grid-template-columns: 1fr !important;
            align-items: start !important;
            row-gap: 1.25rem;
          }
        }
        @media (max-width: 860px) {
          :global(.objection-row) {
            grid-template-columns: 1fr !important;
            column-gap: 0 !important;
            row-gap: 1.25rem !important;
          }
        }
      `}</style>
    </section>
  );
}

function ObjectionRow({
  objection,
  isLast,
  delay,
}: {
  objection: Objection;
  isLast: boolean;
  delay: number;
}) {
  return (
    <article
      data-reveal
      className="objection-row"
      aria-labelledby={`objection-${objection.kicker.toLowerCase()}`}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 140px) minmax(0, 1fr)",
        columnGap: "clamp(1.25rem, 2.5vw, 2.75rem)",
        padding: "clamp(2.25rem, 3.5vw, 3.25rem) 0",
        borderBottom: isLast ? "none" : "1px solid var(--trb-line-strong)",
        alignItems: "start",
        // @ts-expect-error custom CSS var
        "--trb-reveal-delay": `${delay * 80}ms`,
      }}
    >
      {/* Left rail: mark + kicker */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          paddingTop: "0.5rem",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-signal)",
            fontSize: 11,
            letterSpacing: "0.16em",
            fontWeight: 600,
          }}
        >
          {objection.mark}
        </span>
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            fontSize: 11,
            letterSpacing: "0.14em",
          }}
        >
          {objection.kicker}
        </span>
      </div>

      {/* Right: question + answer */}
      <div style={{ minWidth: 0, maxWidth: "68ch" }}>
        <h3
          id={`objection-${objection.kicker.toLowerCase()}`}
          className="trb-display"
          style={{
            fontSize: "clamp(1.5rem, 0.85rem + 1.8vw, 2.25rem)",
            lineHeight: 1.1,
            marginBottom: "1.25rem",
            fontStyle: "italic",
            fontWeight: 500,
            color: "var(--trb-ink)",
          }}
        >
          {objection.question}
        </h3>
        <p
          style={{
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            color: "var(--trb-ink-muted)",
            marginBottom: "1.5rem",
          }}
        >
          {objection.lede}
        </p>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
            marginBottom: objection.footnote ? "1.5rem" : 0,
            borderTop: "1px solid var(--trb-line)",
            paddingTop: "1.25rem",
          }}
        >
          {objection.bullets.map((bullet, i) => (
            <li
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "0.75rem",
                alignItems: "baseline",
              }}
            >
              <span
                className="trb-mono-sm"
                style={{
                  color: "var(--trb-signal)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  paddingTop: "0.35em",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: "var(--trb-size-body-m)",
                  lineHeight: 1.55,
                  color: "var(--trb-ink-muted)",
                }}
              >
                {bullet}
              </span>
            </li>
          ))}
        </ul>

        {objection.footnote && (
          <p
            style={{
              fontSize: "var(--trb-size-body-m)",
              lineHeight: 1.55,
              color: "var(--trb-ink-muted)",
              borderLeft: "none",
              paddingTop: "1rem",
              borderTop: "1px solid var(--trb-line)",
              marginTop: 0,
            }}
          >
            {objection.footnote}
          </p>
        )}
      </div>
    </article>
  );
}
