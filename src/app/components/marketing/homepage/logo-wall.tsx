"use client";

/**
 * Placeholder specimen logo grid. Per the brief, real customer logos
 * aren't ready yet — we render neutral wordmarks sized for the real
 * thing. Industry tags underneath signal category diversity without
 * fabricating a customer name.
 */
const PLACEHOLDERS = [
  { name: "BORDEROS", tag: "FIN" },
  { name: "MAYVEN&Co", tag: "HEALTH" },
  { name: "NORTHLINE", tag: "GOV" },
  { name: "OSAKI", tag: "MFG" },
  { name: "QUORUM/LABS", tag: "EDU" },
  { name: "RIDGEPOINT", tag: "FIN" },
  { name: "SILVERFIELD", tag: "HEALTH" },
  { name: "STRATOGRAPH", tag: "SAAS" },
  { name: "TRELLIS", tag: "LEGAL" },
  { name: "WESTHAVEN", tag: "RETAIL" },
];

export function LogoWall() {
  return (
    <section
      className="trb-section"
      aria-label="Customer logo specimen"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        background: "var(--trb-surface-1)",
        borderTop: "1px solid var(--trb-line)",
        borderBottom: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        {/* Header */}
        <div
          data-reveal
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1rem",
            borderBottom: "1px solid var(--trb-line)",
            paddingBottom: "0.875rem",
            marginBottom: "2rem",
            flexWrap: "wrap",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-dim)" }}
          >
            § INDEX
          </span>
          <span
            style={{
              fontFamily: "var(--trb-font-display)",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--trb-ink)",
              letterSpacing: "-0.005em",
            }}
          >
            In use at 34 teams across finance, health, and public sector.
          </span>
          <span
            style={{
              flex: 1,
              height: 1,
              background: "var(--trb-line)",
              minWidth: 40,
            }}
          />
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            PARTIAL / SPECIMEN PLATE
          </span>
        </div>

        {/* Grid */}
        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            columnGap: 0,
            rowGap: 0,
            border: "1px solid var(--trb-line)",
            background: "oklch(0.15 0.008 60)",
          }}
        >
          {PLACEHOLDERS.map((p, i) => (
            <LogoCell key={p.name} logo={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LogoCell({
  logo,
  index,
}: {
  logo: { name: string; tag: string };
  index: number;
}) {
  return (
    <div
      style={{
        padding: "1.25rem 1rem 1.125rem",
        borderRight: "1px solid var(--trb-line)",
        borderBottom: "1px solid var(--trb-line)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "0.75rem",
        minHeight: 110,
        position: "relative",
        transition: "background-color var(--trb-dur-fast) var(--trb-ease)",
      }}
      className="logo-cell"
    >
      {/* Mono index corner */}
      <span
        className="trb-mono-sm"
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          color: "var(--trb-ink-faint)",
          fontSize: 9,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Wordmark */}
      <div
        style={{
          fontFamily: "var(--trb-font-display)",
          fontSize: "clamp(0.9375rem, 0.7rem + 0.5vw, 1.0625rem)",
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: "var(--trb-ink-muted)",
          marginTop: "0.875rem",
          transition: "color var(--trb-dur-fast) var(--trb-ease)",
        }}
      >
        {logo.name}
      </div>

      <div
        className="trb-mono-sm"
        style={{
          color: "var(--trb-ink-faint)",
          fontSize: 9,
        }}
      >
        SECTOR · {logo.tag}
      </div>

      <style jsx>{`
        .logo-cell:hover > div:nth-child(2) {
          color: var(--trb-ink) !important;
        }
      `}</style>
    </div>
  );
}
