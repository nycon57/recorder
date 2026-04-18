"use client";

const COLS = [
  {
    heading: "PRODUCT",
    links: [
      { label: "Capture", href: "/features/capture" },
      { label: "Transcribe", href: "/features/transcribe" },
      { label: "Structure", href: "/features/structure" },
      { label: "Retrieve", href: "/features/retrieve" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "USE CASES",
    links: [
      { label: "Customer ops", href: "/use/customer-ops" },
      { label: "L&D", href: "/use/learning" },
      { label: "Internal comms", href: "/use/comms" },
      { label: "Incident review", href: "/use/incident" },
    ],
  },
  {
    heading: "COMPANY",
    links: [
      { label: "About", href: "/about" },
      { label: "Customers", href: "/customers" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "RESOURCES",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "SDK", href: "/sdk" },
      { label: "Pricing", href: "/pricing" },
      { label: "Status", href: "https://status.tribora.com" },
    ],
  },
];

const COMPLIANCE = [
  "SOC 2 TYPE II",
  "HIPAA READY",
  "SSO & SAML",
  "DATA · US / EU",
  "AUDIT LOG · 7Y",
];

export function Footer() {
  return (
    <footer
      className="trb-section"
      style={{
        borderTop: "1px solid var(--trb-line)",
        paddingTop: "clamp(3rem, 5vw, 5rem)",
        paddingBottom: "clamp(2rem, 3vw, 3rem)",
      }}
    >
      <div className="trb-inner">
        {/* Top colophon row: wordmark + tagline specimen */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2.2fr)",
            gap: "clamp(1.5rem, 3vw, 3rem)",
            borderBottom: "1px solid var(--trb-line)",
            paddingBottom: "clamp(1.5rem, 3vw, 2.5rem)",
            marginBottom: "clamp(1.5rem, 3vw, 2.5rem)",
          }}
        >
          <div>
            <Wordmark />
            <p
              className="trb-mono-sm"
              style={{
                marginTop: "0.875rem",
                color: "var(--trb-ink-faint)",
                letterSpacing: "0.1em",
                maxWidth: "28ch",
              }}
            >
              THE KNOWLEDGE INTELLIGENCE LAYER / SPECIMEN PLATE / 2026
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "clamp(1rem, 2vw, 2.5rem)",
            }}
            className="footer-cols"
          >
            {COLS.map((c) => (
              <div key={c.heading}>
                <div
                  className="trb-mono-sm"
                  style={{
                    color: "var(--trb-ink-faint)",
                    marginBottom: "0.75rem",
                    letterSpacing: "0.14em",
                  }}
                >
                  {c.heading}
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        className="trb-link"
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--trb-ink-muted)",
                        }}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance specimen strip */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.375rem 0.5rem",
            marginBottom: "1.25rem",
          }}
        >
          {COMPLIANCE.map((c) => (
            <span
              key={c}
              className="trb-mono-sm"
              style={{
                color: "var(--trb-ink-dim)",
                padding: "0.3125rem 0.5rem",
                border: "1px solid var(--trb-line)",
                background: "oklch(0.15 0.008 60)",
                letterSpacing: "0.08em",
              }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Bottom stamp row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "0.5rem",
            borderTop: "1px solid var(--trb-line)",
            paddingTop: "1rem",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)", fontSize: 10 }}
          >
            © 2026 TRIBORA, INC. · ALL RIGHTS RESERVED
          </span>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a
              href="/privacy"
              className="trb-mono-sm"
              style={{
                color: "var(--trb-ink-faint)",
                fontSize: 10,
              }}
            >
              PRIVACY
            </a>
            <a
              href="/terms"
              className="trb-mono-sm"
              style={{
                color: "var(--trb-ink-faint)",
                fontSize: 10,
              }}
            >
              TERMS
            </a>
            <a
              href="/security"
              className="trb-mono-sm"
              style={{
                color: "var(--trb-ink-faint)",
                fontSize: 10,
              }}
            >
              SECURITY
            </a>
            <span
              className="trb-mono-sm"
              style={{
                color: "var(--trb-ink-faint)",
                fontSize: 10,
              }}
            >
              BUILD 8f3a1c · TRIBORA-WEB v2.4.1
            </span>
          </div>
        </div>
      </div>

      {/* Mobile collapse footer columns */}
      <style jsx>{`
        @media (max-width: 900px) {
          :global(.footer-cols) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 560px) {
          :global(.footer-cols) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "flex-end",
          gap: 3,
          height: 22,
        }}
      >
        <span
          style={{
            width: 2.5,
            height: 8,
            background: "var(--trb-ink-muted)",
            display: "block",
          }}
        />
        <span
          style={{
            width: 2.5,
            height: 18,
            background: "var(--trb-signal)",
            display: "block",
          }}
        />
        <span
          style={{
            width: 2.5,
            height: 13,
            background: "var(--trb-ink-muted)",
            display: "block",
          }}
        />
      </span>
      <span
        style={{
          fontFamily: "var(--trb-font-display)",
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: "var(--trb-ink)",
        }}
      >
        Tribora
      </span>
    </span>
  );
}
