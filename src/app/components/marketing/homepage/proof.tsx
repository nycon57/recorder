"use client";

const ROWS = [
  { k: "SOC 2 TYPE II", v: "ATTESTED 2026-Q1", status: "VERIFIED" },
  { k: "HIPAA", v: "READY · BAA ON REQUEST", status: "VERIFIED" },
  { k: "DATA RESIDENCY", v: "US · EU · CA", status: "REGIONAL" },
  { k: "SSO & SAML", v: "OKTA · ENTRA · GOOGLE · JUMPCLOUD", status: "ENTERPRISE" },
  { k: "DELETE ON REQUEST", v: "≤ 7 DAYS · CRYPTOGRAPHIC SHRED", status: "POLICY" },
  { k: "AUDIT LOG", v: "ORG-SCOPED · IMMUTABLE · 7Y RETAIN", status: "ENTERPRISE" },
  { k: "ENCRYPTION", v: "AT REST · IN TRANSIT · BYOK OPT-IN", status: "POLICY" },
  { k: "PEN TEST", v: "ANNUAL · INDEPENDENT · REPORT ON NDA", status: "VERIFIED" },
];

export function Proof() {
  return (
    <section
      id="proof"
      className="trb-section"
      aria-labelledby="proof-head"
      style={{
        paddingTop: "clamp(4.5rem, 7vw, 8rem)",
        paddingBottom: "clamp(4.5rem, 7vw, 8rem)",
        borderTop: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        {/* Header */}
        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(0, 500px)",
            gap: "clamp(1.5rem, 3vw, 3rem)",
            alignItems: "end",
            marginBottom: "clamp(2.5rem, 4vw, 4rem)",
          }}
        >
          <div>
            <div
              className="flex items-center gap-3"
              style={{ marginBottom: "0.75rem" }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-signal)" }}
              >
                §08
              </span>
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                / THE SECURITY BRIEF
              </span>
            </div>
            <h2
              id="proof-head"
              className="trb-display"
              style={{
                fontSize: "var(--trb-size-display-l)",
                maxWidth: "18ch",
              }}
            >
              For the IT reviewer
              <br />
              <span style={{ color: "var(--trb-ink-muted)" }}>
                who has to sign off.
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
            No stickers, no trust-badge collage. Your security team wants a
            data sheet &mdash; so that&rsquo;s what we printed. Every line
            here is a control your procurement reviewer can verify. Reports
            and attestations available on NDA.
          </p>
        </div>

        {/* Data sheet */}
        <div
          style={{
            border: "1px solid var(--trb-line)",
            background: "oklch(0.15 0.008 60)",
          }}
        >
          {/* Column header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 1fr) minmax(0, 2fr) minmax(120px, auto)",
              gap: "1rem",
              padding: "0.5rem 1rem",
              borderBottom: "1px solid var(--trb-line-strong)",
              background: "oklch(0.165 0.008 60)",
            }}
          >
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-dim)", fontSize: 10 }}
            >
              CONTROL
            </span>
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-dim)", fontSize: 10 }}
            >
              DISPOSITION
            </span>
            <span
              className="trb-mono-sm"
              style={{
                color: "var(--trb-ink-dim)",
                fontSize: 10,
                textAlign: "right",
              }}
            >
              STATUS
            </span>
          </div>

          {ROWS.map((r, i) => (
            <div
              key={r.k}
              data-reveal
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(180px, 1fr) minmax(0, 2fr) minmax(120px, auto)",
                gap: "1rem",
                padding: "0.8125rem 1rem",
                alignItems: "center",
                borderBottom:
                  i === ROWS.length - 1
                    ? "none"
                    : "1px solid var(--trb-line)",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": `${i * 30}ms`,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--trb-font-mono)",
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  color: "var(--trb-ink)",
                  fontWeight: 500,
                }}
              >
                {r.k}
              </span>
              <span
                style={{
                  fontFamily: "var(--trb-font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: "var(--trb-ink-muted)",
                }}
              >
                {r.v}
              </span>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    background:
                      r.status === "VERIFIED"
                        ? "var(--trb-signal)"
                        : "var(--trb-ink-faint)",
                    boxShadow:
                      r.status === "VERIFIED"
                        ? "0 0 0 3px oklch(0.78 0.155 72 / 0.2)"
                        : "none",
                  }}
                />
                <span
                  className="trb-mono-sm"
                  style={{
                    color:
                      r.status === "VERIFIED"
                        ? "var(--trb-signal)"
                        : "var(--trb-ink-faint)",
                  }}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
