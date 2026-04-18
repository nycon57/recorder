"use client";

import { useState } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────────────────────── */

interface PricingTier {
  mark: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  cta: string;
  ctaHref: string;
  ctaStyle: "primary" | "ghost";
}

const PRICING_TIERS: PricingTier[] = [
  {
    mark: "T-01",
    name: "Starter",
    description:
      "One senior rep, a handful of clips, see if the rest of the team asks it questions.",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      "5 recordings per month",
      "AI transcription (Whisper)",
      "Basic search",
      "Personal workspace",
      "1 GB storage",
      "Community support",
    ],
    cta: "Start free",
    ctaHref: "/sign-up",
    ctaStyle: "ghost",
  },
  {
    mark: "T-02",
    name: "Pro",
    description:
      "Support and ops teams who want every new hire trained on the same answers.",
    monthlyPrice: 29,
    annualPrice: 290,
    features: [
      "Unlimited recordings",
      "AI transcription · 95%+ accuracy",
      "Semantic search",
      "Auto documentation",
      "AI RAG assistant",
      "Knowledge graph",
      "Team sharing · up to 10",
      "50 GB storage",
      "Priority support",
    ],
    highlighted: true,
    badge: "MOST ADOPTED",
    cta: "Start Pro trial",
    ctaHref: "/sign-up",
    ctaStyle: "primary",
  },
  {
    mark: "T-03",
    name: "Enterprise",
    description:
      "Larger teams with SSO, data-residency, and IT-review requirements.",
    monthlyPrice: 99,
    annualPrice: 990,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Advanced RBAC",
      "SSO · SAML",
      "Bidirectional sync",
      "Custom integrations",
      "On-premise option",
      "Dedicated support",
      "99.9% SLA guarantee",
    ],
    cta: "Contact sales",
    ctaHref: "/contact",
    ctaStyle: "ghost",
  },
];

interface ComparisonRow {
  feature: string;
  category?: boolean;
  sharepoint: string | boolean;
  google: string | boolean;
  manual: string | boolean;
  tribora: string | boolean;
  triboraHighlight?: boolean;
}

const COMPARISON_DATA: ComparisonRow[] = [
  { feature: "Knowledge Capture", category: true, sharepoint: false, google: false, manual: false, tribora: false },
  { feature: "Visual / screen recording", sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: "AI transcription", sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: "Workflow extraction", sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: "Auto documentation", sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: "Search & Answers", category: true, sharepoint: false, google: false, manual: false, tribora: false },
  { feature: "Semantic search", sharepoint: "basic", google: "basic", manual: false, tribora: "advanced AI", triboraHighlight: true },
  { feature: "Knowledge graph", sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: "AI assistant (RAG)", sharepoint: "Copilot ($)", google: "Gemini ($)", manual: false, tribora: "included", triboraHighlight: true },
  { feature: "Cross-source linking", sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
  { feature: "Integration", category: true, sharepoint: false, google: false, manual: false, tribora: false },
  { feature: "Bidirectional sync", sharepoint: "one-way", google: "one-way", manual: false, tribora: "full sync", triboraHighlight: true },
  { feature: "Publish back to source", sharepoint: false, google: false, manual: false, tribora: true, triboraHighlight: true },
];

interface FaqItem {
  id: string;
  mark: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-1",
    mark: "Q-01",
    question: "What's in the free plan?",
    answer:
      "Five recordings a month, AI transcription, 1 GB of storage, basic search. A fine way for one senior rep to record a handful of clips and see if the rest of the team actually asks them questions before moving up a tier.",
  },
  {
    id: "faq-2",
    mark: "Q-02",
    question: "How does the 14-day Pro trial work?",
    answer:
      "Sign up for Pro, get everything Pro has for 14 days, no credit card. At the end you either subscribe or drop back to free. Your recordings and data stay put either way.",
  },
  {
    id: "faq-3",
    mark: "Q-03",
    question: "Can I change plans later?",
    answer:
      "Upgrade any time — new features are live immediately. Downgrade takes effect at the end of your billing period. Your data stays accessible through both.",
  },
  {
    id: "faq-4",
    mark: "Q-04",
    question: "Payment methods?",
    answer:
      "Visa, Mastercard, Amex. Enterprise can be invoiced. Payments run through Stripe with bank-level encryption.",
  },
  {
    id: "faq-5",
    mark: "Q-05",
    question: "Is my data secure?",
    answer:
      "AES-256 at rest, TLS 1.3 in transit, SOC 2 Type II, GDPR-ready. Enterprise can self-host on-premise for full data sovereignty.",
  },
  {
    id: "faq-6",
    mark: "Q-06",
    question: "Which integrations are live?",
    answer:
      "Google Drive, Microsoft SharePoint, OneDrive, Notion — more on the roadmap. Sync runs both directions: enriched content can publish back to source. It's not a silo.",
  },
  {
    id: "faq-7",
    mark: "Q-07",
    question: "Nonprofit / education discounts?",
    answer:
      "Fifty percent off for qualifying nonprofits, educational institutions, and open-source projects. Email sales with proof of status.",
  },
];

const TRUST_STRIP = [
  { label: "CARD", value: "NOT REQUIRED" },
  { label: "TRIAL", value: "14 DAYS" },
  { label: "CANCEL", value: "ANY TIME" },
  { label: "ANNUAL", value: "-20% VS MONTHLY" },
];

/* ─────────────────────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────────────────────── */

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <>
      <Hero isAnnual={isAnnual} onToggle={setIsAnnual} />
      <TierGrid isAnnual={isAnnual} />
      <Compare />
      <Faq />
      <Closing />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   HERO
   ──────────────────────────────────────────────────────────────────────── */

function Hero({
  isAnnual,
  onToggle,
}: {
  isAnnual: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <section
      className="trb-section"
      aria-labelledby="pricing-head"
      style={{
        position: "relative",
        paddingTop: "clamp(2.5rem, 3vw + 1rem, 4.5rem)",
        paddingBottom: "clamp(3rem, 4vw + 1rem, 5rem)",
      }}
    >
      <div
        aria-hidden
        className="trb-grid-overlay"
        style={{ inset: 0, position: "absolute", zIndex: 0 }}
      />

      <div className="trb-inner" style={{ position: "relative", zIndex: 1 }}>
        <SectionMarkerRow mark="§01" label="/ PRICING" index="PAGE 02 OF 07" />

        <h1
          id="pricing-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "var(--trb-size-display-l)",
            marginTop: "1.25rem",
            marginBottom: "1.25rem",
            maxWidth: "18ch",
          }}
        >
          Priced per team{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            that actually records
          </span>
          <span style={{ color: "var(--trb-signal)" }}>.</span>
        </h1>

        <p
          data-reveal
          style={{
            maxWidth: "58ch",
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            color: "var(--trb-ink-muted)",
            marginBottom: "2rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          Start free &mdash; one senior rep, a handful of clips. Move up a tier
          when the rest of the team starts asking it questions.
        </p>

        <BillingToggle isAnnual={isAnnual} onToggle={onToggle} />

        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(140px, max-content))",
            gap: "0.25rem 2rem",
            borderTop: "1px solid var(--trb-line)",
            borderBottom: "1px solid var(--trb-line)",
            padding: "0.75rem 0",
            marginTop: "2.25rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "240ms",
          }}
        >
          {TRUST_STRIP.map((item) => (
            <div
              key={item.label}
              style={{ display: "flex", flexDirection: "column", gap: 2 }}
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

      <CornerMarkers fig="FIG-01" caption="PRICING / INDEX" />
    </section>
  );
}

function BillingToggle({
  isAnnual,
  onToggle,
}: {
  isAnnual: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      data-reveal
      role="tablist"
      aria-label="Billing cadence"
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        border: "1px solid var(--trb-line-strong)",
        borderRadius: 2,
        overflow: "hidden",
        background: "var(--trb-surface-1)",
        /* @ts-expect-error custom CSS var */
        "--trb-reveal-delay": "160ms",
      }}
    >
      <ToggleSegment
        active={!isAnnual}
        onClick={() => onToggle(false)}
        label="MONTHLY"
        mark="M-01"
      />
      <span
        aria-hidden
        style={{ width: 1, background: "var(--trb-line-strong)" }}
      />
      <ToggleSegment
        active={isAnnual}
        onClick={() => onToggle(true)}
        label="ANNUAL"
        mark="A-20"
        suffix="−20%"
      />
    </div>
  );
}

function ToggleSegment({
  active,
  onClick,
  label,
  mark,
  suffix,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  mark: string;
  suffix?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.6875rem 1.125rem",
        fontFamily: "var(--trb-font-mono)",
        fontSize: 12,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: active ? "var(--trb-signal-soft)" : "transparent",
        color: active ? "var(--trb-signal)" : "var(--trb-ink-muted)",
        border: "none",
        cursor: "pointer",
        transition:
          "color var(--trb-dur-fast) var(--trb-ease), background-color var(--trb-dur-fast) var(--trb-ease)",
      }}
    >
      <span
        style={{
          color: active ? "var(--trb-signal)" : "var(--trb-ink-faint)",
          fontSize: 10,
        }}
      >
        {mark}
      </span>
      <span>{label}</span>
      {suffix ? (
        <span
          style={{
            color: active ? "var(--trb-signal)" : "var(--trb-ink-dim)",
            fontSize: 11,
            letterSpacing: "0.04em",
          }}
        >
          {suffix}
        </span>
      ) : null}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TIER GRID
   ──────────────────────────────────────────────────────────────────────── */

function TierGrid({ isAnnual }: { isAnnual: boolean }) {
  return (
    <section
      className="trb-section"
      aria-labelledby="tiers-head"
      style={{
        position: "relative",
        paddingTop: "clamp(3rem, 5vw, 5rem)",
        paddingBottom: "clamp(3rem, 5vw, 5rem)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§02" label="/ TIERS" index="3 PLANS" />

        <h2
          id="tiers-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.375rem)",
            marginTop: "1.25rem",
            marginBottom: "2.5rem",
            maxWidth: "32ch",
          }}
        >
          Three plans.{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            One of them probably fits.
          </span>
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 0,
            border: "1px solid var(--trb-line)",
          }}
        >
          {PRICING_TIERS.map((tier, i) => (
            <TierColumn
              key={tier.name}
              tier={tier}
              isAnnual={isAnnual}
              delay={i * 80}
              isLast={i === PRICING_TIERS.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TierColumn({
  tier,
  isAnnual,
  delay,
  isLast,
}: {
  tier: PricingTier;
  isAnnual: boolean;
  delay: number;
  isLast: boolean;
}) {
  const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
  const monthlyEq =
    isAnnual && tier.annualPrice > 0
      ? Math.round(tier.annualPrice / 12)
      : tier.monthlyPrice;
  const isEnterprise = tier.name === "Enterprise";
  const isFree = price === 0;

  return (
    <div
      data-reveal
      style={{
        padding: "1.75rem 1.5rem 2rem",
        borderRight: isLast ? "none" : "1px solid var(--trb-line)",
        background: tier.highlighted
          ? "var(--trb-signal-soft)"
          : "transparent",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        position: "relative",
        /* @ts-expect-error custom CSS var */
        "--trb-reveal-delay": `${delay}ms`,
      }}
    >
      {/* Tier header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid var(--trb-line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            className="trb-mono-sm"
            style={{
              color: tier.highlighted
                ? "var(--trb-signal)"
                : "var(--trb-ink-faint)",
            }}
          >
            {tier.mark}
          </span>
          <span
            className="trb-mono-sm"
            style={{
              color: "var(--trb-ink-dim)",
              letterSpacing: "0.14em",
            }}
          >
            / {tier.name.toUpperCase()}
          </span>
        </div>
        {tier.badge ? (
          <span
            className="trb-mono-sm"
            style={{
              color: "var(--trb-signal)",
              fontSize: 10,
              letterSpacing: "0.14em",
            }}
          >
            {tier.badge}
          </span>
        ) : null}
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: "var(--trb-size-body-s)",
          lineHeight: 1.55,
          color: "var(--trb-ink-muted)",
          minHeight: "4.4em",
        }}
      >
        {tier.description}
      </p>

      {/* Price block */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {isEnterprise ? (
          <>
            <span
              className="trb-display trb-num"
              style={{
                fontSize: "clamp(2rem, 1.4rem + 1.5vw, 2.75rem)",
                lineHeight: 1,
              }}
            >
              Custom
            </span>
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)" }}
            >
              CONTACT FOR QUOTE
            </span>
          </>
        ) : isFree ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "0.375rem",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--trb-font-mono)",
                  fontSize: 14,
                  color: "var(--trb-ink-faint)",
                }}
              >
                $
              </span>
              <span
                className="trb-display trb-num"
                style={{
                  fontSize: "clamp(2.25rem, 1.6rem + 2vw, 3.25rem)",
                  lineHeight: 1,
                }}
              >
                0
              </span>
            </div>
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)" }}
            >
              FREE · FOREVER
            </span>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "0.375rem",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--trb-font-mono)",
                  fontSize: 14,
                  color: "var(--trb-ink-faint)",
                }}
              >
                $
              </span>
              <span
                className="trb-display trb-num"
                style={{
                  fontSize: "clamp(2.25rem, 1.6rem + 2vw, 3.25rem)",
                  lineHeight: 1,
                }}
              >
                {monthlyEq}
              </span>
              <span
                className="trb-mono-sm"
                style={{
                  color: "var(--trb-ink-muted)",
                  letterSpacing: "0.08em",
                }}
              >
                / MONTH
              </span>
            </div>
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)" }}
            >
              {isAnnual ? `$${price} / YEAR · BILLED ANNUALLY` : "BILLED MONTHLY"}
            </span>
          </>
        )}
      </div>

      {/* CTA */}
      <Link
        href={tier.ctaHref}
        className={tier.ctaStyle === "primary" ? "trb-cta" : "trb-ghost"}
        style={{
          justifyContent: "space-between",
          width: "100%",
          padding: "0.75rem 1rem 0.8125rem",
          fontSize: "0.875rem",
        }}
      >
        {tier.cta}
        <span className={tier.ctaStyle === "primary" ? "trb-cta-glyph" : "trb-mono-sm"}>
          →
        </span>
      </Link>

      {/* Features list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        <div
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            paddingBottom: "0.5rem",
            borderBottom: "1px solid var(--trb-line-faint)",
            marginBottom: "0.5rem",
          }}
        >
          INCLUDES
        </div>
        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {tier.features.map((feat, idx) => (
            <li
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2.5rem 1fr",
                alignItems: "baseline",
                gap: "0.5rem",
                fontSize: "var(--trb-size-body-s)",
                lineHeight: 1.45,
              }}
            >
              <span
                className="trb-mono-sm"
                style={{
                  color: tier.highlighted
                    ? "var(--trb-signal)"
                    : "var(--trb-ink-faint)",
                }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span style={{ color: "var(--trb-ink)" }}>{feat}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   COMPARISON TABLE
   ──────────────────────────────────────────────────────────────────────── */

function Compare() {
  return (
    <section
      className="trb-section"
      aria-labelledby="compare-head"
      style={{
        position: "relative",
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§03" label="/ COMPARE" index="4 COLUMNS" />

        <h2
          id="compare-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.375rem)",
            marginTop: "1.25rem",
            marginBottom: "0.75rem",
            maxWidth: "30ch",
          }}
        >
          An always-on tutor{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            trained on your team.
          </span>
        </h2>

        <p
          data-reveal
          style={{
            maxWidth: "60ch",
            fontSize: "var(--trb-size-body-m)",
            color: "var(--trb-ink-muted)",
            marginBottom: "2.5rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          We don&rsquo;t replace your docs. We answer from them, with citations.
        </p>

        <div
          data-reveal
          style={{
            border: "1px solid var(--trb-line)",
            overflowX: "auto",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "140ms",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 720,
              borderCollapse: "collapse",
              fontFamily: "var(--trb-font-body)",
              fontSize: "var(--trb-size-body-s)",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--trb-line)",
                  background: "var(--trb-surface-1)",
                }}
              >
                <th style={headerCellStyle("left")}>FEATURE</th>
                <th style={headerCellStyle("center")}>SHAREPOINT</th>
                <th style={headerCellStyle("center")}>GOOGLE DRIVE</th>
                <th style={headerCellStyle("center")}>MANUAL</th>
                <th
                  style={{
                    ...headerCellStyle("center"),
                    color: "var(--trb-signal)",
                    background: "var(--trb-signal-soft)",
                  }}
                >
                  TRIBORA
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_DATA.map((row, i) => {
                if (row.category) {
                  return (
                    <tr
                      key={i}
                      style={{
                        background: "var(--trb-surface-1)",
                        borderBottom: "1px solid var(--trb-line)",
                      }}
                    >
                      <td
                        colSpan={5}
                        className="trb-mono-sm"
                        style={{
                          padding: "0.625rem 1rem",
                          color: "var(--trb-ink-dim)",
                          letterSpacing: "0.14em",
                        }}
                      >
                        / {row.feature.toUpperCase()}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--trb-line-faint)" }}
                  >
                    <td
                      style={{
                        padding: "0.875rem 1rem",
                        color: "var(--trb-ink)",
                        verticalAlign: "middle",
                      }}
                    >
                      {row.feature}
                    </td>
                    <td style={cellStyle("center")}>
                      <CompareValue value={row.sharepoint} />
                    </td>
                    <td style={cellStyle("center")}>
                      <CompareValue value={row.google} />
                    </td>
                    <td style={cellStyle("center")}>
                      <CompareValue value={row.manual} />
                    </td>
                    <td
                      style={{
                        ...cellStyle("center"),
                        background: row.triboraHighlight
                          ? "var(--trb-signal-soft)"
                          : "transparent",
                      }}
                    >
                      <CompareValue
                        value={row.tribora}
                        isHighlighted={row.triboraHighlight}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          data-reveal
          style={{
            marginTop: "1.5rem",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "200ms",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            INTEGRATES · GOOGLE DRIVE · SHAREPOINT · NOTION · MORE
          </span>
          <Link
            href="/sign-up"
            className="trb-ghost"
            style={{ padding: "0.6875rem 1.125rem" }}
          >
            Get started free
            <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FAQ
   ──────────────────────────────────────────────────────────────────────── */

function Faq() {
  return (
    <section
      className="trb-section"
      aria-labelledby="faq-head"
      style={{
        position: "relative",
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow
          mark="§04"
          label="/ QUESTIONS"
          index={`${FAQ_ITEMS.length} ENTRIES`}
        />

        <h2
          id="faq-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.375rem)",
            marginTop: "1.25rem",
            marginBottom: "2.5rem",
            maxWidth: "28ch",
          }}
        >
          Everything you&rsquo;d ask{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            before you swipe a card.
          </span>
        </h2>

        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            borderTop: "1px solid var(--trb-line)",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          {FAQ_ITEMS.map((item) => (
            <FaqRow key={item.id} item={item} />
          ))}
        </div>

        <div
          data-reveal
          style={{
            marginTop: "2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "160ms",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            STILL HAVE QUESTIONS?
          </span>
          <Link href="/contact" className="trb-link">
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}

function FaqRow({ item }: { item: FaqItem }) {
  return (
    <details
      style={{
        borderBottom: "1px solid var(--trb-line)",
        padding: "1.25rem 0",
      }}
    >
      <summary
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "baseline",
          gap: "1rem",
          cursor: "pointer",
          listStyle: "none",
          userSelect: "none",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            letterSpacing: "0.14em",
          }}
        >
          {item.mark}
        </span>
        <span
          style={{
            fontFamily: "var(--trb-font-display)",
            fontSize: "clamp(1.0625rem, 0.95rem + 0.4vw, 1.1875rem)",
            fontWeight: 500,
            letterSpacing: "-0.005em",
            color: "var(--trb-ink)",
          }}
        >
          {item.question}
        </span>
        <span
          aria-hidden
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-dim)",
            transition: "transform var(--trb-dur-fast) var(--trb-ease)",
          }}
        >
          +
        </span>
      </summary>
      <p
        style={{
          marginTop: "0.875rem",
          marginLeft: "calc(3ch + 1rem)",
          fontSize: "var(--trb-size-body-m)",
          lineHeight: 1.6,
          color: "var(--trb-ink-muted)",
          maxWidth: "70ch",
        }}
      >
        {item.answer}
      </p>
    </details>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CLOSING
   ──────────────────────────────────────────────────────────────────────── */

function Closing() {
  return (
    <section
      className="trb-section"
      aria-labelledby="pricing-closing"
      style={{
        paddingTop: "clamp(5rem, 8vw, 8rem)",
        paddingBottom: "clamp(5rem, 8vw, 8rem)",
        borderTop: "1px solid var(--trb-line)",
        position: "relative",
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        className="trb-grid-overlay"
        style={{ inset: 0, position: "absolute", opacity: 0.45 }}
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
        <div data-reveal className="flex items-center gap-3">
          <span className="trb-mono-sm" style={{ color: "var(--trb-signal)" }}>
            §05
          </span>
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
            / BOOK A DEMO
          </span>
        </div>

        <h2
          id="pricing-closing"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(2.25rem, 1.5rem + 3vw, 4rem)",
            lineHeight: 1,
            maxWidth: "22ch",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          Thirty minutes,{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            your team, your data.
          </span>
        </h2>

        <p
          data-reveal
          style={{
            color: "var(--trb-ink-muted)",
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            maxWidth: "58ch",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "160ms",
          }}
        >
          We&rsquo;ll record one of the questions your senior rep gets every
          week, watch it land in your knowledge base, then pull the answer out
          &mdash; citation included.
        </p>

        <div
          data-reveal
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.75rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "240ms",
          }}
        >
          <Link
            href="/contact?type=demo"
            className="trb-cta"
            style={{ padding: "0.9375rem 1.625rem 1rem", fontSize: "1rem" }}
          >
            Book a demo
            <span className="trb-cta-glyph">→</span>
          </Link>
          <Link
            href="/sign-up"
            className="trb-ghost"
            style={{ padding: "0.875rem 1.5rem" }}
          >
            Start free instead
            <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
              →
            </span>
          </Link>
        </div>

        <div
          data-reveal
          style={{
            marginTop: "0.5rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "320ms",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            NO MQL GAUNTLET · NO SLIDES · ONE HONEST HOUR
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SHARED FRAGMENTS
   ──────────────────────────────────────────────────────────────────────── */

function SectionMarkerRow({
  mark,
  label,
  index,
}: {
  mark: string;
  label: string;
  index: string;
}) {
  return (
    <div
      data-reveal
      className="flex items-center gap-3"
      style={{
        borderTop: "1px solid var(--trb-line)",
        paddingTop: "0.625rem",
        paddingBottom: "0.25rem",
      }}
    >
      <span className="trb-mono-sm" style={{ color: "var(--trb-signal)" }}>
        {mark}
      </span>
      <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
        {label}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: "var(--trb-line)",
        }}
      />
      <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
        {index}
      </span>
    </div>
  );
}

function CornerMarkers({ fig, caption }: { fig: string; caption: string }) {
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
      <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
        {fig} / {caption}
      </span>
      <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
        REV 2026-04-17
      </span>
    </div>
  );
}

function CompareValue({
  value,
  isHighlighted,
}: {
  value: string | boolean;
  isHighlighted?: boolean;
}) {
  if (typeof value === "boolean") {
    if (value) {
      return (
        <span
          className="trb-mono-sm"
          style={{
            color: isHighlighted ? "var(--trb-signal)" : "var(--trb-ink)",
            letterSpacing: "0.14em",
          }}
        >
          ✓
        </span>
      );
    }
    return (
      <span
        className="trb-mono-sm"
        style={{ color: "var(--trb-ink-faint)" }}
      >
        —
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: "var(--trb-font-mono)",
        fontSize: 12,
        letterSpacing: "0.04em",
        color: isHighlighted ? "var(--trb-signal)" : "var(--trb-ink-muted)",
      }}
    >
      {value}
    </span>
  );
}

function headerCellStyle(align: "left" | "center"): React.CSSProperties {
  return {
    fontFamily: "var(--trb-font-mono)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.14em",
    textAlign: align,
    color: "var(--trb-ink-dim)",
    padding: "0.75rem 1rem",
    textTransform: "uppercase",
  };
}

function cellStyle(align: "left" | "center"): React.CSSProperties {
  return {
    padding: "0.875rem 1rem",
    textAlign: align,
    verticalAlign: "middle",
    color: "var(--trb-ink-muted)",
  };
}
